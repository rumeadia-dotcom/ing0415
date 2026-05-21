/**
 * 로젠택배 Open API SDK — 4 메서드 클라이언트.
 *
 * 마스터:
 *   - docs/spec/PRD-v2-shipping.md §2.2, §2.3, §3
 *   - CLAUDE.md "외부 API 로깅 패턴"
 *
 * 사용처:
 *   - Edge Function `logen-verify-credential` (verify ping = getSlipNo qty=1)
 *   - Edge Function `logen-register-shipment` (PR6 별도)
 *   - 브라우저: outSlipPrintPop URL 빌더 (window.open 용)
 *
 * 강제:
 *   - 모든 외부 호출에 timeout (기본 15s) + correlationId 부여.
 *   - 응답은 모두 zod 스키마 통과 → LogenError 또는 도메인 객체 반환.
 *   - userId / custCd 는 로그에 길이만 노출 (마스킹). slipNo 도 동일 (운송장 = 식별자).
 *   - retry / backoff 는 본 SDK 가 수행하지 않음 — 호출측 (Edge Function 오케스트레이터) 책임.
 *
 * base URL:
 *   - 개발: https://topenapi.ilogen.com
 *   - 운영: https://openapi.ilogen.com
 *   - 호출측이 createLogenClient({ baseUrl }) 로 주입.
 */

import type { z } from 'zod'
import { LogenError, httpStatusToLogenCode, resultCdToLogenCode } from './errors'
import {
  BuildPrintPopupUrlReqSchema,
  GetSlipNoReqSchema,
  GetSlipNoResSchema,
  GetSlipNoResultSchema,
  InquirySlipNoMultiReqSchema,
  InquirySlipNoMultiResSchema,
  InquirySlipNoMultiResultSchema,
  RegisterOrderDataReqSchema,
  RegisterOrderDataResSchema,
  RegisterOrderDataResultSchema,
  type BuildPrintPopupUrlReq,
  type GetSlipNoResult,
  type InquirySlipNoMultiResult,
  type RegisterOrderDataReq,
  type RegisterOrderDataResult,
} from './schemas'

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

const PATH_GET_SLIP_NO = '/lrm02b-edi/edi/getSlipNo'
const PATH_REGISTER_ORDER_DATA = '/lrm02b-edi/edi/registerOrderData'
const PATH_OUT_SLIP_PRINT_POP = '/lrm02b-edi/edi/outSlipPrintPop'
const PATH_INQUIRY_SLIP_NO_MULTI = '/lrm02b-edi/edi/inquirySlipNoMulti'

const DEFAULT_TIMEOUT_MS = 15_000

// ─────────────────────────────────────────────
// 옵션 / 로거 인터페이스 (FE / Edge 양쪽 호환)
// ─────────────────────────────────────────────

/**
 * 호출측이 주입하는 구조화 로거.
 * 프론트의 `logger` 와 Edge 의 `createLogger()` 가 모두 호환되도록 최소 형태로 정의.
 * (FE 의 logger 는 console-shim 이라 ctx, msg 시그니처 미지원 — 어댑터 래핑 가능.)
 */
export interface LogenLogger {
  info(ctx: Record<string, unknown>, msg: string): void
  warn(ctx: Record<string, unknown>, msg: string): void
  error(ctx: Record<string, unknown>, msg: string): void
}

/** 호출자에게 노출할 한 줄 콘솔용 stub. */
export function consoleLogenLogger(): LogenLogger {
  return {
    info: (ctx, msg) => {
      console.info(JSON.stringify({ level: 'info', msg, ...ctx }))
    },
    warn: (ctx, msg) => {
      console.warn(JSON.stringify({ level: 'warn', msg, ...ctx }))
    },
    error: (ctx, msg) => {
      console.error(JSON.stringify({ level: 'error', msg, ...ctx }))
    },
  }
}

export interface CreateLogenClientOptions {
  /** Logen Open API base URL (https://topenapi.ilogen.com | https://openapi.ilogen.com) */
  baseUrl: string
  /** Logen 연동업체코드 — 셀러 credentials 에서 주입 */
  userId: string
  /** Logen 거래처코드 — 셀러 credentials 에서 주입 */
  custCd: string
  /** 로그 상관관계 (선택, 미지정 시 메서드별 자동 생성) */
  correlationId?: string
  /** Internal seller UUID — 로그에만. */
  sellerId?: string
  /** 호출당 timeout (ms). 기본 15s. */
  timeoutMs?: number
  /** 의존성 주입 — 단위 테스트용 */
  fetchImpl?: typeof fetch
  logger?: LogenLogger
}

export interface LogenClient {
  getSlipNo(input: { slipQty: number }): Promise<GetSlipNoResult>
  registerOrderData(
    payload: Omit<RegisterOrderDataReq, 'userId' | 'custCd'>,
  ): Promise<RegisterOrderDataResult>
  buildPrintPopupUrl(input: BuildPrintPopupUrlReq): string
  inquirySlipNoMulti(input: { slipNos: string[] }): Promise<InquirySlipNoMultiResult>
}

// ─────────────────────────────────────────────
// 내부 유틸
// ─────────────────────────────────────────────

function newCorrelationId(): string {
  // FE / Edge 양쪽에서 crypto.randomUUID 사용 가능.
  return crypto.randomUUID()
}

function maskShort(value: string): { length: number } {
  return { length: value.length }
}

/**
 * 공통 POST(JSON). timeout / 에러 변환 / 응답 JSON parse.
 */
async function logenPostJson<T extends z.ZodTypeAny>(args: {
  baseUrl: string
  path: string
  body: unknown
  schema: T
  correlationId: string
  timeoutMs: number
  fetchImpl: typeof fetch
  logger: LogenLogger
  sellerId?: string
}): Promise<z.infer<T>> {
  const {
    baseUrl,
    path,
    body,
    schema,
    correlationId,
    timeoutMs,
    fetchImpl,
    logger,
    sellerId,
  } = args

  const url = `${baseUrl}${path}`
  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), timeoutMs)

  logger.info(
    {
      market: 'logen',
      method: 'POST',
      url,
      correlationId,
      ...(sellerId !== undefined ? { sellerId } : {}),
    },
    '→ market request',
  )

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Accept: 'application/json',
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timerId)
    const isAbort =
      e instanceof DOMException && e.name === 'AbortError'
    const code = isAbort ? 'network' : 'network'
    const message = isAbort
      ? `로젠 API timeout (${timeoutMs}ms)`
      : '로젠 API 네트워크 오류'
    logger.error(
      {
        market: 'logen',
        correlationId,
        errCode: code,
        errMsg: message,
      },
      '← market error',
    )
    throw new LogenError(code, message, { correlationId, cause: e })
  }
  clearTimeout(timerId)

  const text = await response.text().catch(() => '')

  logger.info(
    {
      market: 'logen',
      status: response.status,
      correlationId,
    },
    '← market response',
  )

  if (!response.ok) {
    const code = httpStatusToLogenCode(response.status)
    throw new LogenError(code, `로젠 API ${response.status}`, {
      status: response.status,
      correlationId,
      // 응답 body 는 마스킹 전에 길이만.
      resultMsg: text.slice(0, 200),
    })
  }

  let raw: unknown
  try {
    raw = text.length === 0 ? {} : JSON.parse(text)
  } catch (e) {
    throw new LogenError('server', '로젠 API 응답 JSON 파싱 실패', {
      status: response.status,
      correlationId,
      cause: e,
    })
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new LogenError('server', '로젠 API 응답 스키마 불일치', {
      status: response.status,
      correlationId,
      cause: parsed.error,
    })
  }
  return parsed.data
}

// ─────────────────────────────────────────────
// createLogenClient
// ─────────────────────────────────────────────

export function createLogenClient(opts: CreateLogenClientOptions): LogenClient {
  if (!opts.baseUrl || !opts.baseUrl.startsWith('http')) {
    throw new LogenError('validation', 'Logen baseUrl invalid', {
      resultMsg: 'baseUrl required',
    })
  }
  if (!opts.userId || opts.userId.length === 0) {
    throw new LogenError('validation', 'Logen userId required', {})
  }
  if (!opts.custCd || opts.custCd.length === 0) {
    throw new LogenError('validation', 'Logen custCd required', {})
  }

  const baseUrl = opts.baseUrl.replace(/\/$/, '')
  const userId = opts.userId
  const custCd = opts.custCd
  const sellerId = opts.sellerId
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const fetchImpl = opts.fetchImpl ?? fetch
  const logger = opts.logger ?? consoleLogenLogger()

  // 인스턴스 단위 correlation 은 별도 갱신 가능. 메서드별로도 새로 발급 가능.
  const baseCorrelation = opts.correlationId ?? newCorrelationId()

  // 초기 로그 — userId / custCd 는 길이만.
  logger.info(
    {
      market: 'logen',
      correlationId: baseCorrelation,
      userIdLen: maskShort(userId).length,
      custCdLen: maskShort(custCd).length,
      ...(sellerId !== undefined ? { sellerId } : {}),
    },
    'logen client created',
  )

  return {
    async getSlipNo(input): Promise<GetSlipNoResult> {
      const correlationId = newCorrelationId()
      const req = GetSlipNoReqSchema.parse({ userId, slipQty: input.slipQty })

      const res = await logenPostJson({
        baseUrl,
        path: PATH_GET_SLIP_NO,
        body: req,
        schema: GetSlipNoResSchema,
        correlationId,
        timeoutMs,
        fetchImpl,
        logger,
        ...(sellerId !== undefined ? { sellerId } : {}),
      })

      // resultCd 검증
      const errCode = resultCdToLogenCode(res.resultCd)
      if (errCode !== null) {
        const resultMsg = res.resultMsg ?? res.errorMsg ?? res.errMsg
        throw new LogenError(errCode, 'getSlipNo 실패', {
          resultCd: res.resultCd,
          ...(resultMsg !== undefined ? { resultMsg } : {}),
          correlationId,
        })
      }

      // normalize — slipNo / slipNoList 중 하나.
      const slipNo = res.slipNo ?? res.slipNoList ?? []
      if (
        !res.startSlipNo ||
        !res.closeSlipNo ||
        slipNo.length === 0
      ) {
        throw new LogenError('server', 'getSlipNo 응답 필수 필드 누락', {
          resultCd: res.resultCd,
          correlationId,
        })
      }
      return GetSlipNoResultSchema.parse({
        startSlipNo: res.startSlipNo,
        closeSlipNo: res.closeSlipNo,
        slipNo,
      })
    },

    async registerOrderData(payload): Promise<RegisterOrderDataResult> {
      const correlationId = newCorrelationId()
      const req = RegisterOrderDataReqSchema.parse({
        userId,
        custCd,
        ...payload,
      })

      const res = await logenPostJson({
        baseUrl,
        path: PATH_REGISTER_ORDER_DATA,
        body: req,
        schema: RegisterOrderDataResSchema,
        correlationId,
        timeoutMs,
        fetchImpl,
        logger,
        ...(sellerId !== undefined ? { sellerId } : {}),
      })

      const errCode = resultCdToLogenCode(res.resultCd)
      if (errCode !== null) {
        const resultMsg = res.resultMsg ?? res.errorMsg ?? res.errMsg
        throw new LogenError(errCode, 'registerOrderData 실패', {
          resultCd: res.resultCd,
          ...(resultMsg !== undefined ? { resultMsg } : {}),
          correlationId,
        })
      }

      // 응답이 fixTakeNo 를 echo 하지 않으면 요청값 사용 (Logen 명세 변종 대응).
      const fixTakeNo = res.fixTakeNo ?? req.fixTakeNo
      return RegisterOrderDataResultSchema.parse({
        fixTakeNo,
        resultCd: res.resultCd,
      })
    },

    buildPrintPopupUrl(input): string {
      // 입력 검증
      const parsed = BuildPrintPopupUrlReqSchema.parse(input)
      const params = new URLSearchParams({
        userId,
        custCd,
        takeDt: parsed.takeDt,
      })
      return `${baseUrl}${PATH_OUT_SLIP_PRINT_POP}?${params.toString()}`
    },

    async inquirySlipNoMulti(input): Promise<InquirySlipNoMultiResult> {
      const correlationId = newCorrelationId()
      const parsed = InquirySlipNoMultiReqSchema.parse(input)
      // Logen API 요청 형식은 명세에 따라 { slipNos: [...] } 또는 { slipNoList: [...] }.
      // 두 형태로 모두 전송하여 호환성 확보 (Logen 측이 인식하는 쪽만 처리).
      const body = {
        userId,
        custCd,
        slipNos: parsed.slipNos,
        slipNoList: parsed.slipNos,
      }
      const res = await logenPostJson({
        baseUrl,
        path: PATH_INQUIRY_SLIP_NO_MULTI,
        body,
        schema: InquirySlipNoMultiResSchema,
        correlationId,
        timeoutMs,
        fetchImpl,
        logger,
        ...(sellerId !== undefined ? { sellerId } : {}),
      })

      const errCode = resultCdToLogenCode(res.resultCd)
      if (errCode !== null) {
        const resultMsg = res.resultMsg ?? res.errorMsg ?? res.errMsg
        throw new LogenError(errCode, 'inquirySlipNoMulti 실패', {
          resultCd: res.resultCd,
          ...(resultMsg !== undefined ? { resultMsg } : {}),
          correlationId,
        })
      }

      const items = res.list ?? res.data ?? res.items ?? []
      return InquirySlipNoMultiResultSchema.parse({
        slipNo: items.map((it) => it.slipNo),
        status: items.map((it) => it.status),
      })
    },
  }
}
