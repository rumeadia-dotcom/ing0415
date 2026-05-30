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
  RegistrationFieldMeta,
  StoredCredential,
} from '../schemas.ts'
import type {
  CategoryCertMeta,
  MarketAdapter,
  SubmitTrackingExtra,
  SubmitTrackingResult,
} from '../market-adapter.ts'
import { getElevenStRegistrationFields } from './eleven-st-registration-fields.ts'
import type { FetchOrdersInput, MarketOrder } from '../market-orders.ts'
import { FetchOrdersInputSchema, MarketOrderSchema } from '../market-orders.ts'
import {
  buildElevenStCategoryUrl,
  buildElevenStDispatchPath,
  buildElevenStOrderListPath,
  buildElevenStProductRaw,
  buildElevenStProductXml,
  classifyElevenStCreateResult,
  classifyElevenStDispatchResult,
  classifyElevenStOrdersResult,
  ELEVEN_ST_REST_BASE,
  ELEVEN_ST_REST_PATHS,
  mapElevenStCategories,
  mapElevenStCategoryCertMeta,
  mapElevenStOrders,
  resolveElevenStDispatchDlvNo,
  stripNsPrefix,
  toElevenStCarrierCode,
  toElevenStOrderDate,
  type ElevenStProductRawResult,
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

/**
 * 카테고리 조회 fetch (PR-1) — cateservice 1001/1617 GET, 게이트웨이 경유.
 * 구 `?apiCode=ProductCategoryInfo` placeholder 제거. API Key 불필요(GET) — querystring/헤더에
 * apiKey 미부여. 절대 REST URL 직접 호출. 응답 XML(EUC-KR) → fast-xml-parser.
 * ⚠️ URL 은 토큰/키 미포함이라 로그 안전. maskUrlForLog 는 gatewayFetch 내부 처리.
 */
async function elevenStCategoryFetch(opts: {
  url: string
  correlationId: string
  timeoutMs?: number
}): Promise<ElevenStResponse> {
  const { url, correlationId, timeoutMs } = opts
  const reqLogger = logger.with({ correlationId, market: MARKET })
  reqLogger.info({ method: 'GET', service: 'cateservice' }, '→ market request (gateway)')
  const start = Date.now()
  try {
    const response = await gatewayFetch(MARKET, url, {
      correlationId,
      method: 'GET',
      headers: {
        'Content-Type': 'application/xml;charset=EUC-KR',
        'X-Correlation-Id': correlationId,
      },
      timeoutMs: timeoutMs ?? CATEGORY_TIMEOUT_MS,
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
    throw new MarketError('network', '11번가 카테고리 조회 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  }
}

/**
 * 11번가 REST fetch (PR-5) — ordservices 계열은 apiCode 없이 서비스별 REST path 를 쓴다.
 * `ELEVEN_ST_REST_BASE`(api.11st.co.kr/rest) + path variable, 게이트웨이 경유.
 * EUC-KR 디코딩 + ns2 prefix 제거까지 수행해 매핑 입력 객체를 반환한다.
 * ⚠️ URL 은 path variable 에 송장/배송번호 같은 식별자를 포함하므로 maskUrlForLog 의존 +
 *   본 함수는 method 만 로그한다 (PII/송장/토큰 로그 금지 — market-adapter.md 로깅 패턴).
 */
async function elevenStRestFetch(opts: {
  apiKey: string
  method: 'GET' | 'POST'
  path: string
  body?: string
  correlationId: string
  timeoutMs?: number
}): Promise<{ status: number; ok: boolean; obj: Record<string, unknown> }> {
  const { apiKey, method, path, body, correlationId, timeoutMs } = opts
  const url = `${ELEVEN_ST_REST_BASE}${path}`
  const reqLogger = logger.with({ correlationId, market: MARKET })
  reqLogger.info({ method }, '→ market request (gateway)')

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
    const parsed = parseElevenStXml(text)
    const obj = stripNsPrefix(parsed) as Record<string, unknown>
    return { status: response.status, ok: response.ok, obj }
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
        // api_key variant 의 expiresAt 은 optional (만료 없음) — 필드 생략.
        // StoredCredentialSchema.api_key 는 `string | undefined` 만 허용(null 불가).
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

    // 카테고리 조회 — cateservice 1001 전체 카테고리 (PR-1 재작성).
    //   GET {ELEVEN_ST_REST_BASE}/cateservice/category (게이트웨이 경유). API Key 불필요(spec 1001).
    //   ns2:categorys>ns2:category[] → stripNsPrefix → parentDispNo 트리 빌드.
    //   (구 ?apiCode=ProductCategoryInfo / ProductCategorys>Category 파싱 제거.)
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const correlationId = generateCorrelationId()
      const res = await elevenStCategoryFetch({
        url: buildElevenStCategoryUrl(),
        correlationId,
        timeoutMs: CATEGORY_TIMEOUT_MS,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, res.text, correlationId)
      }
      return mapElevenStCategories(parseElevenStXml(res.text))
    },

    // 카테고리 KC인증 메타 조회 (NEW-2) — cateservice 1617 (조회 카테고리 자신 포함 하위).
    //   GET {REST_BASE}/cateservice/category/{dispCtgrNo}. API Key 불필요. ns2 응답.
    //   워커(registration-market-worker)가 transformProduct 전에 호출 → cert-inject 로 주입.
    async fetchCategoryCertMeta(
      dispCtgrNo: string,
    ): Promise<Record<string, CategoryCertMeta>> {
      const correlationId = generateCorrelationId()
      const res = await elevenStCategoryFetch({
        url: buildElevenStCategoryUrl(dispCtgrNo),
        correlationId,
        timeoutMs: CATEGORY_TIMEOUT_MS,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, res.text, correlationId)
      }
      return mapElevenStCategoryCertMeta(parseElevenStXml(res.text))
    },

    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      if (mapping.market !== MARKET) {
        throw new MarketError(
          'validation',
          `11번가: mapping.market 불일치 (${mapping.market})`,
          { market: MARKET },
        )
      }
      // PR-3: prodservices 1003 `<Product>` 필수 20+ 필드 + Layer1/2 + 이미지 13장↑ 무음드롭 warning.
      // raw = { fields, warnings } — createProduct 가 fields 를 XML 직렬화 + warnings 를 결과에 전달.
      const built: ElevenStProductRawResult = buildElevenStProductRaw(product, mapping)
      return { market: MARKET, raw: built }
    },

    // getRegistrationFields — 출고지/반품지 select 2필드 (11st.md §4.6 / PR-2).
    //   순수 동기 함수. mock(debug)·real 동형(parity). officialNotice 는 PR-4.
    getRegistrationFields(): RegistrationFieldMeta[] {
      return getElevenStRegistrationFields()
    },

    // createProduct — POST /prodservices/product (1003). XML(EUC-KR) body + openapikey 헤더, 게이트웨이 경유.
    //   응답 root ClientMessage: resultCode∈{200,210} AND productNo 존재 → 성공.
    //   그 외(400 일500개한도 / 500 검증실패) → MarketError(validation, 코드/메시지 동봉).
    //   ⚠️ 구 apiCode(ProductRegister) / Product>ProductNo 파싱 제거(11st.md §0 갭표).
    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      const { apiKey } = getCredOrThrow()
      const correlationId = generateCorrelationId()
      if (payload.market !== MARKET) {
        throw new MarketError('validation', `잘못된 payload.market: ${payload.market}`, {
          market: MARKET,
        })
      }

      const built = payload.raw as ElevenStProductRawResult
      const body = buildElevenStProductXml(built.fields)
      const res = await elevenStRestFetch({
        apiKey,
        method: 'POST',
        path: ELEVEN_ST_REST_PATHS.productCreate,
        body,
        correlationId,
      })
      if (!res.ok) {
        throw httpStatusToMarketError(res.status, '', correlationId)
      }

      const result = classifyElevenStCreateResult(res.obj)
      if (result.kind === 'rejected') {
        throw new MarketError(
          'validation',
          `11번가 상품 등록 실패: ${result.message || result.resultCode}`,
          {
            market: MARKET,
            marketErrorCode: result.resultCode || undefined,
            marketErrorMessage: result.message || undefined,
          },
        )
      }
      return {
        market: MARKET,
        externalId: result.productNo,
        productUrl: `https://www.11st.co.kr/products/${result.productNo}`,
        status: 'succeeded',
        warnings: built.warnings ?? [],
      }
    },

    // 주문 조회 — 발주확인 대기 목록 (GET /ordservices/complete/{start}/{end}, 1876).
    //   12자리 YYYYMMDDhhmm path variable, 최대 7일. since/until 미지정 시 최근 7일.
    //   ⚠️ dlvNo(배송번호)를 MarketOrder.extra.dlvNo 로 수집 (발송처리 path 키).
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
        throw httpStatusToMarketError(res.status, '', correlationId)
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

    // 발송 처리 (GET /ordservices/reqdelivery/{sendDt}/{dlvMthdCd}/{dlvEtprsCd}/{invcNo}/{dlvNo}, 1888).
    //   body 없음. Edge 계약 = throw-on-failure (process.ts withRetry 오케스트레이터):
    //     0/-3308 → 성공 객체 반환 / -3306·-3320·-3307 → validation throw(비재시도) /
    //     -1000·-3311·기타 음수·5xx → server throw(재시도).
    //   ⚠️ 키 = dlvNo (fetchOrders 의 extra.dlvNo). 워커가 orders.extra.dlvNo 를 opts.dlvNo 로
    //      전달한다(NEW-1). 미전달이면 하위호환으로 externalOrderId(=ordNo) fallback.
    async submitTracking(
      externalOrderId: string,
      waybillNumber: string,
      carrierCode: string,
      opts?: SubmitTrackingExtra,
    ): Promise<SubmitTrackingResult> {
      const { apiKey } = getCredOrThrow()
      const correlationId = generateCorrelationId()

      const dlvNo = resolveElevenStDispatchDlvNo(externalOrderId, opts)
      const dlvEtprsCd = toElevenStCarrierCode(carrierCode)
      if (!dlvEtprsCd) {
        throw new MarketError('validation', `11번가 미지원 택배사: ${carrierCode}`, {
          market: MARKET,
          marketErrorCode: 'unsupported_carrier',
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
        throw httpStatusToMarketError(res.status, '', correlationId)
      }
      const result = classifyElevenStDispatchResult(res.obj)
      if (result.kind === 'rejected') {
        // 정상 거부(송장형식/중복/택배사코드) — 재시도해도 동일 → validation(비재시도) throw.
        throw new MarketError(
          'validation',
          `11번가 발송 처리 거부 (${result.code || 'unknown'})`,
          {
            market: MARKET,
            marketErrorCode: result.code || undefined,
            marketErrorMessage: result.message || undefined,
          },
        )
      }
      if (result.kind === 'throwable') {
        // 점검중/시스템장애/미지 — 재시도 가능 → server throw.
        throw new MarketError(
          'server',
          `11번가 발송 처리 실패 (${result.code || 'unknown'})`,
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
