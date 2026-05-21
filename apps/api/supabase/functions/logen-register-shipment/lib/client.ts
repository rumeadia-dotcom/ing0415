/**
 * 로젠택배 OpenAPI 클라이언트 (Deno fetch + zod).
 *
 * 마스터:
 *   - docs/spec/PRD-v2-shipping.md §2.2 / §3
 *
 * 강제:
 *   - timeout 명시 (8s) — fetch AbortController.
 *   - 응답은 zod 로 검증 후 도메인 객체화.
 *   - 토큰·자격증명(userId / custCd) 평문 로깅 금지 — masked 필드만.
 *   - 재시도·백오프는 본 모듈 바깥 (lib/register.ts) 에서 담당.
 *   - PR3 가 본 모듈을 `_shared/logen/` 로 이동시 import 경로만 교체되는 인터페이스로 유지.
 */

import { MarketError } from '../../_shared/index.ts'
import type { Logger } from '../../_shared/index.ts'
import {
  isLogenSuccess,
  RegisterOrderDataResponseSchema,
  SlipNoResponseSchema,
  type RegisterOrderDataPayload,
  type RegisterOrderDataResponse,
  type SlipNoResponse,
} from './types.ts'

const LOGEN_BASE_URL_PROD = 'https://openapi.ilogen.com'
const LOGEN_BASE_URL_DEV = 'https://topenapi.ilogen.com'

const DEFAULT_TIMEOUT_MS = 8_000

const MARKET_ID_FOR_LOG = 'logen'

export interface LogenClientOptions {
  /** APP_MODE = 'real' → 운영 / debug → 개발 URL */
  readonly baseUrl?: string
  readonly timeoutMs?: number
  readonly logger: Logger
  readonly correlationId: string
}

export interface LogenClient {
  getSlipNo(args: {
    userId: string
    slipQty: number
  }): Promise<SlipNoResponse>

  registerOrderData(
    payload: RegisterOrderDataPayload,
  ): Promise<RegisterOrderDataResponse>
}

/**
 * fetch 기반 로젠 클라이언트 생성.
 *
 * 본 함수는 단일 요청에 대한 단일 호출만 보장 — 재시도는 호출측이 withRetry 또는
 * lib/register.ts 의 지수 백오프 루프에서 담당.
 */
export function createLogenClient(opts: LogenClientOptions): LogenClient {
  const baseUrl =
    opts.baseUrl ?? (Deno.env.get('LOGEN_BASE_URL') ?? LOGEN_BASE_URL_PROD)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const logger = opts.logger
  const correlationId = opts.correlationId

  async function postJson<T>(
    path: string,
    body: Record<string, unknown>,
    opLabel: string,
  ): Promise<T> {
    const url = `${baseUrl}${path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const startedAt = Date.now()
    logger.info(
      {
        market: MARKET_ID_FOR_LOG,
        method: 'POST',
        url,
        op: opLabel,
        correlationId,
      },
      '→ market request',
    )

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (e) {
      clearTimeout(timer)
      const isAbort =
        e instanceof Error && e.name === 'AbortError'
      const code = isAbort ? 'network' : 'network'
      logger.error(
        {
          market: MARKET_ID_FOR_LOG,
          op: opLabel,
          correlationId,
          err: isAbort ? 'timeout' : 'fetch_failed',
          latencyMs: Date.now() - startedAt,
        },
        '← market error',
      )
      throw new MarketError(code, isAbort ? 'logen request timeout' : 'logen network error', {
        market: MARKET_ID_FOR_LOG,
        cause: e,
      })
    }
    clearTimeout(timer)

    logger.info(
      {
        market: MARKET_ID_FOR_LOG,
        op: opLabel,
        status: res.status,
        correlationId,
        latencyMs: Date.now() - startedAt,
      },
      '← market response',
    )

    if (res.status === 401 || res.status === 403) {
      throw new MarketError('unauthorized', 'logen credential invalid', {
        market: MARKET_ID_FOR_LOG,
        status: res.status,
      })
    }
    if (res.status === 429) {
      const retryAfterHeader = res.headers.get('retry-after')
      const retryAfterMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : undefined
      throw new MarketError('rate_limit', 'logen rate limited', {
        market: MARKET_ID_FOR_LOG,
        status: res.status,
        retryAfterMs,
      })
    }
    if (res.status >= 500) {
      throw new MarketError('server', `logen 5xx (${res.status})`, {
        market: MARKET_ID_FOR_LOG,
        status: res.status,
      })
    }
    if (!res.ok) {
      throw new MarketError('validation', `logen ${res.status}`, {
        market: MARKET_ID_FOR_LOG,
        status: res.status,
      })
    }

    let raw: unknown
    try {
      raw = await res.json()
    } catch (e) {
      throw new MarketError('server', 'logen response not JSON', {
        market: MARKET_ID_FOR_LOG,
        cause: e,
      })
    }
    return raw as T
  }

  return {
    async getSlipNo({ userId, slipQty }) {
      if (slipQty <= 0 || !Number.isInteger(slipQty)) {
        throw new MarketError('validation', 'slipQty must be positive integer', {
          market: MARKET_ID_FOR_LOG,
        })
      }
      const raw = await postJson<unknown>(
        '/lrm02b-edi/edi/getSlipNo',
        { userId, slipQty },
        'getSlipNo',
      )
      const parsed = SlipNoResponseSchema.safeParse(raw)
      if (!parsed.success) {
        throw new MarketError('server', 'getSlipNo response malformed', {
          market: MARKET_ID_FOR_LOG,
        })
      }
      return parsed.data
    },

    async registerOrderData(payload) {
      const raw = await postJson<unknown>(
        '/lrm02b-edi/edi/registerOrderData',
        // payload 그대로 전송. 평문 PII 포함이라 본 호출에서만 사용 (로깅 금지).
        payload as unknown as Record<string, unknown>,
        'registerOrderData',
      )
      const parsed = RegisterOrderDataResponseSchema.safeParse(raw)
      if (!parsed.success) {
        throw new MarketError(
          'server',
          'registerOrderData response malformed',
          { market: MARKET_ID_FOR_LOG },
        )
      }
      if (!isLogenSuccess(parsed.data.resultCd)) {
        // 비즈니스 실패 — 재시도 가능 여부를 모르므로 validation 로 분류 (재시도 안 함).
        // 단, 결과 조회 누락 / 일시적 장애 코드는 추후 별도 코드로 격상 검토.
        throw new MarketError(
          'validation',
          `logen registerOrderData failed (resultCd=${parsed.data.resultCd})`,
          {
            market: MARKET_ID_FOR_LOG,
            marketErrorCode: parsed.data.resultCd,
            marketErrorMessage: parsed.data.resultMsg,
          },
        )
      }
      return parsed.data
    },
  }
}

/** 운영 / 개발 URL 노출 — 호출측에서 APP_MODE 분기 시 사용. */
export const LOGEN_URLS = {
  prod: LOGEN_BASE_URL_PROD,
  dev: LOGEN_BASE_URL_DEV,
} as const
