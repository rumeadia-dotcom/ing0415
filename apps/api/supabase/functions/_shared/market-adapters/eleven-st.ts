/**
 * 11번가 Open API real 어댑터 (Edge Function / Deno 측).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9
 *   - docs/architecture/v1/features/markets.md §3 (5마켓 활성)
 *   - eleven-st-map.ts (XML 빌드/파싱 결과 매핑 — 순수 함수, Vitest 테스트)
 *
 * 인증 방식: API Key (credential kind = 'api_key').
 *   - refreshToken 없음 (영구 키).
 *   - authenticate = 입력 API Key 를 StoredCredential 로 저장 (네트워크 없음).
 *   - 모든 호출은 key querystring + `openapikey` 헤더 둘 다 부여, 게이트웨이(고정 IP) 경유.
 *
 * API 기반 (v1 정식 — 5마켓 전부 동작):
 *   - ELEVEN_ST_API_BASE = https://openapi.11st.co.kr/openapi/OpenApiService.tmall
 *   - 카테고리 / 상품등록 / 주문조회 / 발송처리 = apiCode 분기 (eleven-st-map.ts 상수)
 *   - 응답 XML(EUC-KR/CP949) → euc-kr 디코딩 후 fast-xml-parser 파싱.
 *
 * 보안 강제:
 *   - apiKey 절대 로그 금지 (querystring 은 maskUrlForLog 가 제거). PII 직접 로그 금지.
 *   - 모든 외부 호출에 correlationId.
 */

import { XMLParser } from 'npm:fast-xml-parser@4.4.1'
import { MarketError } from '../errors.ts'
import { createLogger } from '../logger.ts'
import { generateCorrelationId } from '../correlation.ts'
import { gatewayFetch } from '../gatewayFetch.ts'
import type {
  AuthInput,
  CategoryNode,
  CreateProductResult,
  MarketMapping,
  MarketPayload,
  Product,
  StoredCredential,
} from '../schemas.ts'
import type { MarketAdapter, SubmitTrackingResult } from '../market-adapter.ts'
import type { FetchOrdersInput, MarketOrder } from '../market-orders.ts'
import { FetchOrdersInputSchema, MarketOrderSchema } from '../market-orders.ts'
import {
  buildElevenStProductRaw,
  buildElevenStProductXml,
  buildElevenStShipmentXml,
  ELEVEN_ST_API_BASE,
  ELEVEN_ST_API_CODES,
  extractElevenStProductNo,
  isElevenStShipmentOk,
  mapElevenStCategories,
  mapElevenStOrders,
  toElevenStDate,
} from './eleven-st-map.ts'

export { ELEVEN_ST_API_BASE } from './eleven-st-map.ts'

const MARKET = '11st' as const
const DEFAULT_TIMEOUT_MS = 15_000
const CATEGORY_TIMEOUT_MS = 10_000

const logger = createLogger('market-adapter:11st')

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: true,
  trimValues: true,
})

/** 11번가 응답 바이트(EUC-KR/CP949) → UTF-8 문자열. 게이트웨이는 byte 투명 프록시. */
function decodeElevenStBody(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('euc-kr').decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

function parseElevenStXml(text: string): Record<string, unknown> {
  try {
    const parsed = xmlParser.parse(text) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch (e) {
    throw new MarketError('server', '11번가 XML 응답 파싱 실패', {
      market: MARKET,
      cause: e,
    })
  }
}

interface ApiKeyCred {
  apiKey: string
}

interface ElevenStResponse {
  status: number
  ok: boolean
  text: string
}

function httpStatusToMarketError(
  status: number,
  message: string,
  correlationId: string,
): MarketError {
  if (status === 401 || status === 403) {
    return new MarketError('unauthorized', `11번가 인증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorCode: String(status),
    })
  }
  if (status === 429) {
    return new MarketError('rate_limit', '11번가 API rate limit', {
      market: MARKET,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError('server', `11번가 서버 오류 (${status})`, {
      market: MARKET,
      status,
      marketErrorCode: String(status),
    })
  }
  if (status === 400 || status === 422) {
    return new MarketError('validation', `11번가 요청 검증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorCode: String(status),
    })
  }
  return new MarketError(
    'unknown',
    `11번가 API 오류 (${status}) correlationId=${correlationId}`,
    { market: MARKET, status },
  )
}

/** 11번가 OpenAPI fetch — apiCode + key querystring + 게이트웨이 경유 + EUC-KR 디코딩. */
async function elevenStFetch(opts: {
  apiCode: string
  apiKey: string
  method: 'GET' | 'POST' | 'PUT'
  params?: Record<string, string>
  body?: string
  correlationId: string
  timeoutMs?: number
}): Promise<ElevenStResponse> {
  const { apiCode, apiKey, method, params, body, correlationId, timeoutMs } = opts

  const qs = new URLSearchParams({ apiCode, key: apiKey, ...(params ?? {}) })
  const url = `${ELEVEN_ST_API_BASE}?${qs.toString()}`
  const reqLogger = logger.with({ correlationId, market: MARKET })
  reqLogger.info({ method, apiCode }, '→ market request (gateway)')

  const start = Date.now()
  try {
    const response = await gatewayFetch(MARKET, url, {
      correlationId,
      method,
      headers: {
        'Content-Type': 'application/xml;charset=EUC-KR',
        openapikey: apiKey,
        'X-Correlation-Id': correlationId,
      },
      body,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    })
    const buf = await response.arrayBuffer()
    const text = decodeElevenStBody(buf)
    reqLogger.info(
      { status: response.status, latencyMs: Date.now() - start },
      '← market response (gateway)',
    )
    return { status: response.status, ok: response.ok, text }
  } catch (err) {
    reqLogger.error({ latencyMs: Date.now() - start }, '← market error (gateway)')
    if (err instanceof MarketError) {
      throw new MarketError(err.code, `11번가 ${err.message}`, {
        market: MARKET,
        cause: err,
        status: err.context.status,
      })
    }
    throw new MarketError('network', '11번가 API 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  }
}

export function createElevenStAdapter(): MarketAdapter {
  let cred: ApiKeyCred | null = null

  function getCredOrThrow(): ApiKeyCred {
    if (!cred) {
      throw new MarketError(
        'unauthorized',
        '11번가 어댑터: authenticate / hydrate 를 먼저 호출해주세요',
        { market: MARKET },
      )
    }
    return cred
  }

  return {
    market: MARKET,
    credentialKind: 'api_key',

    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (input.kind !== 'api_key') {
        throw new MarketError(
          'validation',
          `11번가: api_key 입력 필요 (받은 kind: ${input.kind})`,
          { market: MARKET },
        )
      }
      if (!input.apiKey) {
        throw new MarketError('validation', '11번가: apiKey 필수', { market: MARKET })
      }
      cred = { apiKey: input.apiKey }
      return {
        kind: 'api_key',
        payload: { apiKey: input.apiKey },
        expiresAt: null,
      }
    },

    hydrate(stored: StoredCredential): void {
      if (stored.kind !== 'api_key') {
        throw new MarketError(
          'validation',
          `11번가: api_key 자격증명 필요 (받은 kind: ${stored.kind})`,
          { market: MARKET },
        )
      }
      const p = stored.payload as { apiKey?: string }
      if (!p.apiKey) {
        throw new MarketError('validation', '11번가: 저장 자격증명에 apiKey 누락', {
          market: MARKET,
        })
      }
      cred = { apiKey: p.apiKey }
    },

    // 카테고리 조회 (연결 검증 ping 겸용 — HTTP 200 = 자격증명 OK).
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const { apiKey } = getCredOrThrow()
      const correlationId = generateCorrelationId()
      const res = await elevenStFetch({
        apiCode: ELEVEN_ST_API_CODES.category,
        apiKey,
        method: 'GET',
        params: { dispCtgrNo: '0' },
        correlationId,
        timeoutMs: CATEGORY_TIMEOUT_MS,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, res.text, correlationId)
      }
      return mapElevenStCategories(parseElevenStXml(res.text))
    },

    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      if (mapping.market !== MARKET) {
        throw new MarketError(
          'validation',
          `11번가: mapping.market 불일치 (${mapping.market})`,
          { market: MARKET },
        )
      }
      return { market: MARKET, raw: buildElevenStProductRaw(product, mapping) }
    },

    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      const { apiKey } = getCredOrThrow()
      const correlationId = generateCorrelationId()
      if (payload.market !== MARKET) {
        throw new MarketError('validation', `잘못된 payload.market: ${payload.market}`, {
          market: MARKET,
        })
      }

      const body = buildElevenStProductXml(payload.raw as Record<string, unknown>)
      const res = await elevenStFetch({
        apiCode: ELEVEN_ST_API_CODES.productCreate,
        apiKey,
        method: 'POST',
        body,
        correlationId,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, res.text, correlationId)
      }

      const { productNo, resultCode, resultText } = extractElevenStProductNo(
        parseElevenStXml(res.text),
      )
      if (!productNo) {
        throw new MarketError(
          'server',
          `11번가 상품 등록 실패: ${resultText || resultCode || '상품번호 미반환'}`,
          {
            market: MARKET,
            marketErrorCode: resultCode || undefined,
            marketErrorMessage: resultText || undefined,
          },
        )
      }
      return {
        market: MARKET,
        externalId: productNo,
        productUrl: `https://www.11st.co.kr/products/${productNo}`,
        status: 'succeeded',
        warnings: [],
      }
    },

    // 주문 조회 (결제완료/배송대기 = ordStat 101).
    async fetchOrders(input: FetchOrdersInput): Promise<MarketOrder[]> {
      const parsedInput = FetchOrdersInputSchema.safeParse(input)
      if (!parsedInput.success) {
        throw new MarketError(
          'validation',
          `11번가 fetchOrders 입력 형식 오류 — ${parsedInput.error.message}`,
          { market: MARKET, cause: parsedInput.error },
        )
      }
      const { apiKey } = getCredOrThrow()
      const correlationId = generateCorrelationId()

      const params: Record<string, string> = { ordStat: '101' }
      if (parsedInput.data.since) params.startDate = toElevenStDate(parsedInput.data.since)
      if (parsedInput.data.until) params.endDate = toElevenStDate(parsedInput.data.until)

      const res = await elevenStFetch({
        apiCode: ELEVEN_ST_API_CODES.orderList,
        apiKey,
        method: 'GET',
        params,
        correlationId,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, res.text, correlationId)
      }
      return mapElevenStOrders(parseElevenStXml(res.text)).map((o) =>
        MarketOrderSchema.parse(o),
      )
    },

    // 발송 처리 (송장 등록).
    async submitTracking(
      externalOrderId: string,
      waybillNumber: string,
      carrierCode: string,
    ): Promise<SubmitTrackingResult> {
      const { apiKey } = getCredOrThrow()
      const correlationId = generateCorrelationId()

      const body = buildElevenStShipmentXml({
        ordPrdSeq: externalOrderId,
        carrierCode,
        invoiceNumber: waybillNumber,
      })
      const res = await elevenStFetch({
        apiCode: ELEVEN_ST_API_CODES.shipment,
        apiKey,
        method: 'PUT',
        params: { ordPrdSeq: externalOrderId },
        body,
        correlationId,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, res.text, correlationId)
      }
      const result = isElevenStShipmentOk(parseElevenStXml(res.text))
      if (!result.ok) {
        throw new MarketError(
          'validation',
          `11번가 발송 처리 실패: ${result.message || result.code || '알 수 없는 오류'}`,
          {
            market: MARKET,
            marketErrorCode: result.code || undefined,
            marketErrorMessage: result.message || undefined,
          },
        )
      }
      return { market: MARKET, externalOrderId, waybillNumber, carrierCode }
    },
  }
}
