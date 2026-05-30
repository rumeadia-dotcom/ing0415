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
import { getElevenStRegistrationFields } from './registration-fields'
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
  type RegistrationFieldMeta,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'
import {
  ELEVEN_ST_REST_BASE,
  ELEVEN_ST_REST_PATHS,
  buildElevenStCategoryUrl,
  buildElevenStDispatchPath,
  buildElevenStOrderListPath,
  buildElevenStProductRaw,
  buildElevenStProductXml,
  classifyElevenStCreateResult,
  classifyElevenStDispatchResult,
  classifyElevenStOrdersResult,
  mapElevenStCategories,
  mapElevenStOrders,
  stripNsPrefix,
  toElevenStCarrierCode,
  toElevenStOrderDate,
  xmlDocToObject,
  type ElevenStProductRawResult,
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

/**
 * 카테고리 조회 fetch (PR-1) — cateservice 1001/1617 GET.
 * 구 `?apiCode=ProductCategoryInfo` placeholder 제거. API Key 불필요(GET) — querystring 없음,
 * 서비스별 REST path 절대 URL 직접 호출. 응답 XML(EUC-KR) → DOMParser → fast-xml-parser 호환 객체.
 * ⚠️ URL 은 토큰/키 미포함이라 로그 안전. correlationId 만 헤더 부여.
 */
async function elevenStCategoryFetch(opts: {
  url: string
  correlationId: string
  timeoutMs?: number
}): Promise<ElevenStResponse> {
  const { url, correlationId, timeoutMs = CATEGORY_TIMEOUT_MS } = opts
  const controller = new AbortController()
  const timerId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/xml;charset=EUC-KR',
        'X-Correlation-Id': correlationId,
      },
      signal: controller.signal,
    })
    const buf = await response.arrayBuffer()
    const text = decodeElevenStBody(buf)
    return { status: response.status, ok: response.ok, text }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketError('network', '11번가 카테고리 조회 timeout', {
        market: MARKET,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    throw new MarketError('network', '11번가 카테고리 조회 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }
}

/**
 * 11번가 REST fetch (PR-5) — ordservices 계열은 apiCode 없이 서비스별 REST path 를 쓴다.
 * `ELEVEN_ST_REST_BASE`(api.11st.co.kr/rest) + path variable. 인증은 `openapikey` 헤더만.
 * EUC-KR 디코딩 + ns2 prefix 제거까지 수행해 매핑 입력 객체를 반환한다.
 * ⚠️ URL 은 path variable 에 송장/배송번호 같은 식별자를 포함하므로 절대 로그 금지.
 */
async function elevenStRestFetch(opts: {
  apiKey: string
  method: 'GET' | 'POST'
  path: string
  body?: string
  correlationId: string
  timeoutMs?: number
}): Promise<{ status: number; ok: boolean; obj: Record<string, unknown> }> {
  const { apiKey, method, path, body, correlationId, timeoutMs = DEFAULT_TIMEOUT_MS } = opts
  const url = `${ELEVEN_ST_REST_BASE}${path}`

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
    const parsed = parseElevenStXml(text)
    const obj = stripNsPrefix(parsed) as Record<string, unknown>
    return { status: response.status, ok: response.ok, obj }
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
    // fetchCategoryTree — cateservice 1001 전체 카테고리 (PR-1 재작성).
    //   GET {ELEVEN_ST_REST_BASE}/cateservice/category. API Key 불필요(spec 1001).
    //   ns2:categorys>ns2:category[] → stripNsPrefix → parentDispNo 트리 빌드.
    //   (구 ?apiCode=ProductCategoryInfo / ProductCategorys>Category 파싱 제거.)
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const correlationId = crypto.randomUUID()
      const res = await elevenStCategoryFetch({
        url: buildElevenStCategoryUrl(),
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
      // PR-3: prodservices 1003 `<Product>` 필수 20+ 필드 + Layer1/2 + (이미지 13장↑ 무음드롭 warning).
      // raw = { fields, warnings } — createProduct 가 fields 를 XML 직렬화 + warnings 를 결과에 전달.
      const built: ElevenStProductRawResult = buildElevenStProductRaw(product, mapping)
      return { market: MARKET, raw: built }
    },

    // ───────────────────────────────────────────
    // getRegistrationFields — 출고지/반품지 select 2필드 (11st.md §4.6 / PR-2).
    //   순수 동기 함수. UI(MarketOptionsCard)가 useElevenStShippingAddresses 로 옵션을 채운다.
    //   officialNotice 는 PR-4. (구 동작: 미구현 → 카테고리만 → 본 PR 부터 select 2개 추가.)
    // ───────────────────────────────────────────
    getRegistrationFields(): RegistrationFieldMeta[] {
      return getElevenStRegistrationFields()
    },

    // ───────────────────────────────────────────
    // createProduct — POST /prodservices/product (1003). XML(EUC-KR) body + openapikey 헤더.
    //   응답 root ClientMessage: resultCode∈{200,210} AND productNo 존재 → 성공.
    //   그 외(400 일500개한도 / 500 검증실패) → MarketError(validation, 코드/메시지 동봉).
    //   ⚠️ 구 apiCode(ProductRegister) / Product>ProductNo 파싱 제거(11st.md §0 갭표).
    // ───────────────────────────────────────────
    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      const { apiKey } = getCredOrThrow()
      const correlationId = crypto.randomUUID()
      if (payload.market !== MARKET) {
        throw new MarketError('validation', `잘못된 payload.market: ${payload.market}`, {
          market: MARKET,
        })
      }

      const built = payload.raw as ElevenStProductRawResult
      const fields = built.fields
      const transformWarnings = built.warnings ?? []
      const body = buildElevenStProductXml(fields)
      const res = await elevenStRestFetch({
        apiKey,
        method: 'POST',
        path: ELEVEN_ST_REST_PATHS.productCreate,
        body,
        correlationId,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, correlationId)
      }

      const result = classifyElevenStCreateResult(res.obj)
      if (result.kind === 'rejected') {
        // 400(일 500개 한도)·500(검증 실패) 등 — 셀러 정정 필요(비재시도).
        throw new MarketError(
          'validation',
          `11번가 상품 등록 실패: ${result.message || result.resultCode}`,
          {
            market: MARKET,
            marketErrorCode: result.resultCode,
            ...(result.message ? { marketErrorMessage: result.message } : {}),
          },
        )
      }
      return CreateProductResultSchema.parse({
        market: MARKET,
        externalId: result.productNo,
        productUrl: `https://www.11st.co.kr/products/${result.productNo}`,
        status: 'succeeded',
        warnings: transformWarnings,
      })
    },

    // ───────────────────────────────────────────
    // fetchOrders — 발주확인 대기 목록 (GET /ordservices/complete/{start}/{end}, 1876).
    //   12자리 YYYYMMDDhhmm path variable, 최대 7일. since/until 미지정 시 최근 7일.
    //   ⚠️ dlvNo(배송번호)를 MarketOrder.extra.dlvNo 로 수집 (발송처리 path 키).
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

      const nowMs = Date.now()
      const endIso = parsedInput.data.until ?? new Date(nowMs).toISOString()
      const startIso =
        parsedInput.data.since ?? new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString()
      const startTime = toElevenStOrderDate(startIso)
      const endTime = toElevenStOrderDate(endIso)
      if (!startTime || !endTime) {
        throw new MarketError('validation', '11번가 fetchOrders: 조회 기간 형식 오류', {
          market: MARKET,
        })
      }

      const res = await elevenStRestFetch({
        apiKey,
        method: 'GET',
        path: buildElevenStOrderListPath(startTime, endTime),
        correlationId,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, correlationId)
      }
      // 빈 결과(result_code=0)는 에러 아님. 비즈니스 에러 코드(-3105 등)는 throw.
      const classified = classifyElevenStOrdersResult(res.obj)
      if (classified.kind === 'empty') return []
      if (classified.kind === 'error') {
        throw new MarketError(
          'validation',
          `11번가 주문조회 실패 (${classified.code})`,
          {
            market: MARKET,
            marketErrorCode: classified.code,
            marketErrorMessage: classified.message,
          },
        )
      }
      return mapElevenStOrders(res.obj).map((o) => MarketOrderSchema.parse(o))
    },

    // ───────────────────────────────────────────
    // submitTracking — 발송처리 (GET /ordservices/reqdelivery/{sendDt}/{dlvMthdCd}/
    //   {dlvEtprsCd}/{invcNo}/{dlvNo}, 1888). body 없음.
    //   반환 정책(§9.7): 0/-3308 → ok:true / -3306·-3320·-3307 → ok:false /
    //   -1000·-3311·기타 음수·5xx → MarketError throw.
    //   ⚠️ 키 = dlvNo (fetchOrders 의 extra.dlvNo) — externalOrderId 가 아님.
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

      const { externalOrderId, waybillNumber, carrierCode, orderId } = parsedInput.data
      // dlvNo(배송번호) 는 fetchOrders 의 extra.dlvNo → submitTracking 호출측이 orderId 로 전달.
      const dlvNo = orderId ?? externalOrderId
      const dlvEtprsCd = toElevenStCarrierCode(carrierCode)
      if (!dlvEtprsCd) {
        // 택배사 코드 미매핑 = 정상 거부 (셀러가 지원 택배사 선택해야 함).
        return MarketSubmitTrackingResultSchema.parse({
          ok: false,
          errorCode: 'unsupported_carrier',
          errorMessage: `11번가 미지원 택배사: ${carrierCode}`,
        })
      }
      const sendDt = toElevenStOrderDate(new Date().toISOString())

      const res = await elevenStRestFetch({
        apiKey,
        method: 'GET',
        path: buildElevenStDispatchPath({ sendDt, dlvEtprsCd, invcNo: waybillNumber, dlvNo }),
        correlationId,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, correlationId)
      }
      const result = classifyElevenStDispatchResult(res.obj)
      if (result.kind === 'rejected') {
        return MarketSubmitTrackingResultSchema.parse({
          ok: false,
          errorCode: result.code || 'shipment_rejected',
          errorMessage: result.message || result.code || '11번가 발송 처리 거부',
        })
      }
      if (result.kind === 'throwable') {
        throw new MarketError(
          'server',
          `11번가 발송 처리 실패 (${result.code || 'unknown'})`,
          {
            market: MARKET,
            ...(result.code ? { marketErrorCode: result.code } : {}),
            ...(result.message ? { marketErrorMessage: result.message } : {}),
          },
        )
      }
      return MarketSubmitTrackingResultSchema.parse({
        ok: true,
        dispatchId: dlvNo,
      })
    },
  }
}

export const elevenstRealAdapter: MarketAdapter = createElevenStRealAdapter()
