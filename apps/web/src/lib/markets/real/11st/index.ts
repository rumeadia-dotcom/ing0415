/**
 * 11번가 Open API real 어댑터 (프론트엔드 / Vite 환경).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (5마켓 매트릭스)
 *   - docs/architecture/v1/features/markets.md §3 (활성 마켓)
 *   - apps/api/supabase/functions/_shared/market-adapters/eleven-st.ts (Edge Function 측 — 본 어댑터는 그 포트, 매핑 로직 동일)
 *
 * 인증 방식: API Key (credential kind = 'api_key').
 *   - refreshToken 없음 (영구 키 — 인터페이스 optional 준수, 정의 생략).
 *   - authenticate = 입력 API Key 를 StoredCredential 로 저장 (네트워크 없음).
 *   - 모든 호출은 key querystring + `openapikey` 헤더 둘 다 부여.
 *
 * API 기반 (v1 정식 — 5마켓 전부 동작):
 *   - ELEVEN_ST_API_BASE = https://openapi.11st.co.kr/openapi/OpenApiService.tmall
 *   - 카테고리 / 상품등록 / 주문조회 / 발송처리 = apiCode 분기 (map.ts 상수)
 *   - 응답 XML(EUC-KR/CP949) → euc-kr 디코딩 후 DOMParser 파싱 → map.ts 매핑.
 *
 * 보안 강제:
 *   - apiKey 절대 로그 금지 (querystring 포함 URL 도 로그 금지). PII 직접 로그 금지.
 *   - correlationId 를 모든 외부 호출 헤더에 부여.
 *
 * 매핑 로직(상태/카테고리/상품/주문/발송)은 전부 ./map (순수) 으로 위임 — Edge Function 측
 * eleven-st-map.ts 와 동일 코드라 mock↔real / FE↔BE parity 가 유지된다.
 */

import { MarketError } from '../../errors'
import type { MarketAdapter } from '../../types'
import {
  ApiKeyAuthInputSchema,
  CategoryNodeSchema,
  CreateProductResultSchema,
  FetchOrdersInputSchema,
  MarketOrderSchema,
  MarketSubmitTrackingResultSchema,
  StoredCredentialSchema,
  SubmitTrackingInputSchema,
  type AuthInput,
  type CategoryNode,
  type CreateProductResult,
  type FetchOrdersInput,
  type MarketMapping,
  type MarketOrder,
  type MarketPayload,
  type MarketSubmitTrackingResult,
  type Product,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'
import {
  ELEVEN_ST_API_BASE,
  ELEVEN_ST_API_CODES,
  buildElevenStProductRaw,
  buildElevenStProductXml,
  buildElevenStShipmentXml,
  extractElevenStProductNo,
  isElevenStShipmentOk,
  mapElevenStCategories,
  mapElevenStOrders,
  toElevenStDate,
  xmlDocToObject,
} from './map'

export { ELEVEN_ST_API_BASE } from './map'

const MARKET = '11st' as const
const DEFAULT_TIMEOUT_MS = 15_000
const CATEGORY_TIMEOUT_MS = 10_000

// ─────────────────────────────────────────────
// EUC-KR 디코딩 + XML 파싱 (브라우저/jsdom API)
// ─────────────────────────────────────────────

/** 11번가 응답 바이트(EUC-KR/CP949) → UTF-8 문자열. EUC-KR 디코더 미지원 환경은 utf-8 fallback. */
function decodeElevenStBody(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('euc-kr').decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

/** XML 텍스트 → fast-xml-parser 호환 plain object (map.ts 매핑 입력). */
function parseElevenStXml(text: string): Record<string, unknown> {
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    return xmlDocToObject(doc)
  } catch (e) {
    throw new MarketError('server', '11번가 XML 응답 파싱 실패', {
      market: MARKET,
      cause: e,
    })
  }
}

// ─────────────────────────────────────────────
// fetch wrapper
// ─────────────────────────────────────────────

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

/** 11번가 OpenAPI fetch — apiCode + key querystring + openapikey 헤더 + EUC-KR 디코딩. */
async function elevenStFetch(opts: {
  apiCode: string
  apiKey: string
  method: 'GET' | 'POST' | 'PUT'
  params?: Record<string, string>
  body?: string
  correlationId: string
  timeoutMs?: number
}): Promise<ElevenStResponse> {
  const { apiCode, apiKey, method, params, body, correlationId, timeoutMs = DEFAULT_TIMEOUT_MS } =
    opts

  const qs = new URLSearchParams({ apiCode, key: apiKey, ...(params ?? {}) })
  const url = `${ELEVEN_ST_API_BASE}?${qs.toString()}`

  const controller = new AbortController()
  const timerId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/xml;charset=EUC-KR',
        openapikey: apiKey,
        'X-Correlation-Id': correlationId,
      },
      body: body !== undefined ? body : null,
      signal: controller.signal,
    })
    const buf = await response.arrayBuffer()
    const text = decodeElevenStBody(buf)
    return { status: response.status, ok: response.ok, text }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketError('network', '11번가 API 요청 timeout', {
        market: MARKET,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    throw new MarketError('network', '11번가 API 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }
}

// ─────────────────────────────────────────────
// credential 추출 (명시 인자 우선, 인스턴스 cred fallback)
// ─────────────────────────────────────────────

function extractApiKeyCred(
  credential: StoredCredential | undefined,
  instance: ApiKeyCred | null,
): ApiKeyCred {
  if (credential) {
    if (credential.kind !== 'api_key') {
      throw new MarketError(
        'unauthorized',
        `11번가: api_key 자격증명 필요 (받은 kind: ${credential.kind})`,
        { market: MARKET },
      )
    }
    return { apiKey: credential.payload.apiKey }
  }
  if (instance) return instance
  throw new MarketError(
    'unauthorized',
    '11번가 어댑터: authenticate 를 먼저 호출하거나 credential 인자를 전달해주세요',
    { market: MARKET },
  )
}

// ─────────────────────────────────────────────
// 어댑터 구현
// ─────────────────────────────────────────────

function createElevenStRealAdapter(): MarketAdapter {
  let cred: ApiKeyCred | null = null

  function getCredOrThrow(): ApiKeyCred {
    if (!cred) {
      throw new MarketError(
        'unauthorized',
        '11번가 어댑터: authenticate 를 먼저 호출해주세요',
        { market: MARKET },
      )
    }
    return cred
  }

  return {
    market: MARKET,
    credentialKind: 'api_key',

    // ───────────────────────────────────────────
    // authenticate — API 호출 없이 자격증명 검증 + 저장
    // ───────────────────────────────────────────
    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (input.kind !== 'api_key') {
        throw new MarketError(
          'validation',
          `11번가: api_key 입력 필요 (받은 kind: ${input.kind})`,
          { market: MARKET },
        )
      }

      const parsed = ApiKeyAuthInputSchema.safeParse(input)
      if (!parsed.success) {
        throw new MarketError(
          'validation',
          `11번가: 자격증명 형식 오류 — ${parsed.error.message}`,
          { market: MARKET, cause: parsed.error },
        )
      }

      cred = { apiKey: parsed.data.apiKey }

      return StoredCredentialSchema.parse({
        kind: 'api_key',
        payload: { apiKey: parsed.data.apiKey },
      })
    },

    // ───────────────────────────────────────────
    // refreshToken 없음 (영구 키) — 인터페이스 optional 준수, 정의 생략.
    // ───────────────────────────────────────────

    // ───────────────────────────────────────────
    // fetchCategoryTree — 연결 검증 ping 겸용 (HTTP 200 = 자격증명 OK)
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const { apiKey } = getCredOrThrow()
      const correlationId = crypto.randomUUID()
      const res = await elevenStFetch({
        apiCode: ELEVEN_ST_API_CODES.category,
        apiKey,
        method: 'GET',
        params: { dispCtgrNo: '0' },
        correlationId,
        timeoutMs: CATEGORY_TIMEOUT_MS,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, correlationId)
      }
      return mapElevenStCategories(parseElevenStXml(res.text)).map((node) =>
        CategoryNodeSchema.parse(node),
      )
    },

    // ───────────────────────────────────────────
    // transformProduct — 순수 함수. Date.now / Math.random 금지.
    // ───────────────────────────────────────────
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

    // ───────────────────────────────────────────
    // createProduct — ProductRegister POST
    // ───────────────────────────────────────────
    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      const { apiKey } = getCredOrThrow()
      const correlationId = crypto.randomUUID()
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
        throw httpStatusToMarketError(res.status, correlationId)
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
            ...(resultCode ? { marketErrorCode: resultCode } : {}),
            ...(resultText ? { marketErrorMessage: resultText } : {}),
          },
        )
      }
      return CreateProductResultSchema.parse({
        market: MARKET,
        externalId: productNo,
        productUrl: `https://www.11st.co.kr/products/${productNo}`,
        status: 'succeeded',
        warnings: [],
      })
    },

    // ───────────────────────────────────────────
    // fetchOrders — GetOrderList (결제완료/배송대기 = ordStat 101)
    // ───────────────────────────────────────────
    async fetchOrders(
      input: FetchOrdersInput,
      credential?: StoredCredential,
    ): Promise<MarketOrder[]> {
      const parsedInput = FetchOrdersInputSchema.safeParse(input)
      if (!parsedInput.success) {
        throw new MarketError(
          'validation',
          `11번가 fetchOrders 입력 형식 오류 — ${parsedInput.error.message}`,
          { market: MARKET, cause: parsedInput.error },
        )
      }
      const { apiKey } = extractApiKeyCred(credential, cred)
      const correlationId = crypto.randomUUID()

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
        throw httpStatusToMarketError(res.status, correlationId)
      }
      return mapElevenStOrders(parseElevenStXml(res.text)).map((o) =>
        MarketOrderSchema.parse(o),
      )
    },

    // ───────────────────────────────────────────
    // submitTracking — SendGoods (송장 등록).
    // 마켓 정상 거부 → ok=false 반환. 네트워크/인증/5xx → MarketError throw.
    // ───────────────────────────────────────────
    async submitTracking(
      input: SubmitTrackingInput,
      credential?: StoredCredential,
    ): Promise<MarketSubmitTrackingResult> {
      const parsedInput = SubmitTrackingInputSchema.safeParse(input)
      if (!parsedInput.success) {
        throw new MarketError(
          'validation',
          `11번가 submitTracking 입력 형식 오류 — ${parsedInput.error.message}`,
          { market: MARKET, cause: parsedInput.error },
        )
      }
      const { apiKey } = extractApiKeyCred(credential, cred)
      const correlationId = crypto.randomUUID()

      const { externalOrderId, waybillNumber, carrierCode } = parsedInput.data
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
        throw httpStatusToMarketError(res.status, correlationId)
      }
      const result = isElevenStShipmentOk(parseElevenStXml(res.text))
      if (!result.ok) {
        return MarketSubmitTrackingResultSchema.parse({
          ok: false,
          errorCode: result.code || 'shipment_rejected',
          errorMessage: result.message || result.code || '11번가 발송 처리 실패',
        })
      }
      return MarketSubmitTrackingResultSchema.parse({
        ok: true,
        dispatchId: externalOrderId,
      })
    },
  }
}

export const elevenstRealAdapter: MarketAdapter = createElevenStRealAdapter()
