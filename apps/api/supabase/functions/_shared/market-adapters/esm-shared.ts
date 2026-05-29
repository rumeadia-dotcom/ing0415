/**
 * ESM 2.0 (G마켓·옥션) 공용 real 어댑터 (Edge Function / Deno 측).
 *
 * 알고리즘은 프론트엔드 미러와 동일:
 *   apps/web/src/lib/markets/real/esm/shared-adapter.ts
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9
 *   - WIP-5markets-mvp.md C-3 Phase 1+2
 *
 * 인증 방식: ESM JWT HS256 (credential kind = 'esm_jwt').
 *   - refreshToken 없음 (영구 키, 매 요청마다 JWT 새로 발급 — 수명 5분).
 *
 * API 기반:
 *   - ESM_API_BASE = https://sa2.esmplus.com/item/v1 (공식 문서 esm-api/README.md)
 *   - 카테고리(PR-2): GET /categories/site-cats (대분류) + GET /categories/site-cats/{siteCatCode} (하위) 재귀.
 *     site 선택은 쿼리가 아닌 JWT ssi 클레임(buildEsmJwt({ site }))으로 결정 (esm-api/product/4.md).
 *     isLeaf=true 인 최하위만 상품등록 가능.
 *   - 상품 생성(PR-4): POST /item/v1/goods — 중첩 EsmGoodsCreateRequest(itemBasicInfo/
 *     itemAddtionalInfo). 배송 프로필 번호(placeNo/dispatchPolicyNo)·officialNotice 는
 *     오케스트레이터(registration-market-worker)가 mapping.extra 로 주입. 응답
 *     siteDetail.{gmkt|iac}.SiteGoodsNo 를 externalId 로 매핑 (esm-api/product/20.md).
 *
 * 에러 매핑:
 *   - 401 / 403 → 'unauthorized'
 *   - 400 / 422 → 'validation'
 *   - 429       → 'rate_limit'
 *   - 5xx       → 'server'
 *   - timeout   → 'network'
 */

import { z } from 'npm:zod@3.23.8'
import { MarketError } from '../errors.ts'
import { createLogger } from '../logger.ts'
import { generateCorrelationId } from '../correlation.ts'
import { gatewayFetch } from '../gatewayFetch.ts'
import {
  EsmGoodsCreateRequestSchema,
  EsmGoodsCreateResponseSchema,
  EsmSiteCatSchema,
  EsmTransformExtraSchema,
  type AuthInput,
  type CreateProductResult,
  type EsmGoodsCreateRequest,
  type EsmSiteCat,
  type EsmSiteType,
  type MarketId,
  type MarketMapping,
  type MarketPayload,
  type Product,
  type RegistrationFieldMeta,
  type StoredCredential,
} from '../schemas.ts'
import type { MarketAdapter, SubmitTrackingResult } from '../market-adapter.ts'
import { getEsmRegistrationFields } from './esm-registration-fields.ts'
import {
  FetchOrdersInputSchema,
  type FetchOrdersInput,
  type MarketOrder,
} from '../market-orders.ts'
import { buildEsmJwt } from './esm-jwt.ts'
import {
  EsmOrderListResponseSchema,
  EsmShipResponseSchema,
  ESM_SHIPPING_API_BASE,
  buildEsmOrderListBody,
  buildEsmShipInfoBody,
  isEsmSuccessCode,
  mapEsmOrders,
} from './esm-orders.ts'

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

export const ESM_API_BASE = 'https://sa2.esmplus.com/item/v1'
const CATEGORY_TIMEOUT_MS = 10_000
const DEFAULT_TIMEOUT_MS = 15_000
/** 검색용 상품명(goodsName.kor) 최대 byte (esm.md §4.1 / product/20.md). */
const GOODS_NAME_MAX_BYTES = 100
/** 미지정 시 기본 판매기간 (무제한). */
const DEFAULT_SELLING_PERIOD = -1
/** 미지정 시 기본 배송 type (1=택배). */
const DEFAULT_SHIPPING_TYPE = 1
/** site-cats 재귀 안전 상한 (Web 미러와 동일). */
export const ESM_CATEGORY_MAX_DEPTH = 5

/** UTF-8 byte 길이로 잘라 ≤maxBytes 보장 (Web 미러와 동일). */
function truncateToBytes(value: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  if (encoder.encode(value).length <= maxBytes) return value
  let result = value
  while (encoder.encode(result).length > maxBytes && result.length > 0) {
    result = result.slice(0, -1)
  }
  return result
}

/**
 * 도메인 Product + MarketMapping + ESM extra → 중첩 EsmGoodsCreateRequest 빌드.
 * Web 미러: apps/web/src/lib/markets/real/esm/shared-adapter.ts buildEsmGoodsPayload (동형).
 * 순수 함수. 배송 프로필 번호·officialNotice 는 오케스트레이터가 mapping.extra 로 주입.
 */
export function buildEsmGoodsPayload(
  market: MarketId,
  site: 'G' | 'A',
  product: Product,
  mapping: MarketMapping,
): EsmGoodsCreateRequest {
  const parsedExtra = EsmTransformExtraSchema.safeParse(mapping.extra ?? {})
  if (!parsedExtra.success) {
    throw new MarketError(
      'validation',
      `ESM(${market}): 등록 옵션(extra) 형식 오류 — ${parsedExtra.error.message}`,
      { market, cause: parsedExtra.error },
    )
  }
  const extra = parsedExtra.data

  const placeNo = extra.placeNo
  const dispatchPolicyNo = extra.dispatchPolicyNo
  if (!placeNo || !dispatchPolicyNo) {
    throw new MarketError(
      'validation',
      `ESM(${market}): 배송 프로필 번호 누락 (placeNo/dispatchPolicyNo). 등록 전 배송 프로필 선택이 필요합니다`,
      { market },
    )
  }
  if (!extra.officialNotice) {
    throw new MarketError(
      'validation',
      `ESM(${market}): 상품정보고시(officialNotice) 누락`,
      { market },
    )
  }

  const siteType: EsmSiteType = site === 'G' ? 2 : 1
  const goodsName = truncateToBytes(product.name, GOODS_NAME_MAX_BYTES)
  const stock = extra.stock ?? product.stock
  const sellingPeriod = extra.sellingPeriod ?? DEFAULT_SELLING_PERIOD
  const shippingType = extra.shippingType ?? DEFAULT_SHIPPING_TYPE
  const isVatFree = extra.isVatFree ?? false

  const urls = mapping.transformedImageUrls
  const basicImgURL = urls[0]
  if (!basicImgURL) {
    throw new MarketError('validation', `ESM(${market}): 대표 이미지(basicImgURL) 누락`, {
      market,
    })
  }
  const images: Record<string, string> = { basicImgURL }
  urls.slice(1, 15).forEach((url, idx) => {
    images[`addtionalImg${idx + 1}URL`] = url
  })

  const price = site === 'G' ? { Gmkt: product.priceKrw } : { Iac: product.priceKrw }
  const stockObj = site === 'G' ? { Gmkt: stock } : { Iac: stock }
  const sellingPeriodObj =
    site === 'G' ? { Gmkt: sellingPeriod } : { Iac: sellingPeriod }
  const dispatchPolicyNoObj =
    site === 'G' ? { gmkt: dispatchPolicyNo } : { iac: dispatchPolicyNo }

  const candidate = {
    itemBasicInfo: {
      goodsName: { kor: goodsName },
      category: { site: [{ siteType, catCode: mapping.categoryId }] },
    },
    itemAddtionalInfo: {
      price,
      stock: stockObj,
      sellingPeriod: sellingPeriodObj,
      shipping: {
        type: shippingType,
        policy: { placeNo },
        dispatchPolicyNo: dispatchPolicyNoObj,
      },
      images,
      officialNotice: extra.officialNotice,
      isVatFree,
    },
  }

  const parsed = EsmGoodsCreateRequestSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new MarketError(
      'validation',
      `ESM(${market}): 상품등록 페이로드 검증 실패 — ${parsed.error.message}`,
      { market, cause: parsed.error },
    )
  }
  return parsed.data
}

// ─────────────────────────────────────────────
// site-cats 카테고리 API 응답 raw 스키마
//   esm-api/product/4.md — { catCode, catName, isLeaf, subCats?[] }
// ─────────────────────────────────────────────

interface EsmSiteCatRaw {
  catCode: string
  catName: string
  isLeaf: boolean
  subCats?: EsmSiteCatRaw[]
}

const EsmSiteCatRawSchema: z.ZodType<EsmSiteCatRaw> = z.lazy(() =>
  z.object({
    catCode: z.string().min(1),
    catName: z.string().min(1),
    isLeaf: z.boolean(),
    subCats: z.array(EsmSiteCatRawSchema).optional(),
  }),
)

// CategoryNode (Deno 측 수동 정의)
interface CategoryNode {
  id: string
  name: string
  depth: number
  leaf: boolean
  parentId: string | null
  children: CategoryNode[]
}

// ─────────────────────────────────────────────
// 내부 credential
// ─────────────────────────────────────────────

interface EsmCred {
  masterId: string
  sellerId: string
  secretKey: string
  site: 'G' | 'A'
}

// ─────────────────────────────────────────────
// HTTP 상태 → MarketError 매핑
// ─────────────────────────────────────────────

function httpStatusToMarketError(
  market: MarketId,
  status: number,
  message: string,
  correlationId: string,
): MarketError {
  if (status === 401 || status === 403) {
    return new MarketError('unauthorized', `ESM 인증 실패 (${status})`, {
      market,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 400 || status === 422) {
    return new MarketError('validation', `ESM 요청 검증 실패 (${status}): ${message}`, {
      market,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 429) {
    return new MarketError('rate_limit', 'ESM API rate limit 초과', {
      market,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError('server', `ESM 서버 오류 (${status})`, {
      market,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  return new MarketError('unknown', `ESM API 오류 (${status}) correlationId=${correlationId}`, {
    market,
    status,
    marketErrorMessage: message,
  })
}

// ─────────────────────────────────────────────
// fetch wrapper — JWT Bearer + timeout + 로깅
// ─────────────────────────────────────────────

async function esmFetch(opts: {
  market: MarketId
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  /** base URL — 상품/카테고리는 ESM_API_BASE(/item/v1), 주문/배송은 ESM_SHIPPING_API_BASE(/shipping/v1). */
  baseUrl?: string
  query?: Record<string, string>
  body?: unknown
  cred: EsmCred
  correlationId: string
  jobId?: string
  timeoutMs?: number
  logger: ReturnType<typeof createLogger>
}): Promise<Response> {
  const {
    market,
    method,
    path,
    baseUrl = ESM_API_BASE,
    query,
    body,
    cred,
    correlationId,
    jobId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    logger,
  } = opts

  const { token } = await buildEsmJwt({
    masterId: cred.masterId,
    secretKey: cred.secretKey,
    site: cred.site,
    sellerId: cred.sellerId,
  })

  const queryString = query
    ? '?' +
      Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : ''
  const url = `${baseUrl}${path}${queryString}`

  const reqLogger = logger.with({ correlationId, jobId, market })
  reqLogger.info(
    { method, url: `${path}${queryString}` },
    '→ market request (gateway)',
  )

  const start = Date.now()
  try {
    const response = await gatewayFetch(market, url, {
      correlationId,
      jobId,
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `Bearer ${token}`,
        'X-Correlation-Id': correlationId,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      timeoutMs,
    })
    const latencyMs = Date.now() - start
    reqLogger.info(
      { status: response.status, latencyMs },
      '← market response (gateway)',
    )
    return response
  } catch (err) {
    const latencyMs = Date.now() - start
    if (err instanceof MarketError) {
      reqLogger.error(
        { latencyMs, marketErrorCode: err.code },
        '← market error (gateway)',
      )
      throw new MarketError(err.code, `ESM ${err.message}`, {
        market,
        cause: err,
        status: err.context.status,
      })
    }
    reqLogger.error({ latencyMs }, '← market error (gateway)')
    throw new MarketError('network', 'ESM API 네트워크 오류', { market, cause: err })
  }
}

/**
 * site-cats 응답 본문에서 카테고리 배열 추출.
 * 대분류=배열 / 하위 조회=단일 객체(subCats) / wrapper 모두 허용.
 */
function extractSiteCatList(raw: unknown): EsmSiteCatRaw[] {
  if (Array.isArray(raw)) {
    return raw
      .map((r) => EsmSiteCatRawSchema.safeParse(r))
      .filter((p): p is { success: true; data: EsmSiteCatRaw } => p.success)
      .map((p) => p.data)
  }
  const single = EsmSiteCatRawSchema.safeParse(raw)
  if (single.success) return [single.data]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    for (const key of ['subCats', 'categories', 'data']) {
      if (key in obj) return extractSiteCatList(obj[key])
    }
  }
  return []
}

/** EsmSiteCat → 공통 CategoryNode. depth 1-base, parentId 연결. */
function siteCatToCategoryNode(
  cat: EsmSiteCat,
  depth: number,
  parentId: string | null,
): CategoryNode {
  const children = (cat.children ?? []).map((c) =>
    siteCatToCategoryNode(c, depth + 1, cat.siteCatCode),
  )
  return {
    id: cat.siteCatCode,
    name: cat.siteCatName,
    depth,
    leaf: cat.isLeaf,
    parentId,
    children,
  }
}

// ─────────────────────────────────────────────
// 어댑터 팩토리
// ─────────────────────────────────────────────

export interface EsmAdapterOptions {
  market: MarketId
  site: 'G' | 'A'
}

export function createEsmAdapter(options: EsmAdapterOptions): MarketAdapter {
  const { market, site } = options
  const logger = createLogger(`market-adapter:${market}`)
  let cred: EsmCred | null = null

  function getCredOrThrow(): EsmCred {
    if (!cred) {
      throw new MarketError(
        'unauthorized',
        `ESM(${market}) 어댑터: authenticate 를 먼저 호출해주세요`,
        { market },
      )
    }
    return cred
  }

  return {
    market,
    credentialKind: 'esm_jwt',

    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (input.kind !== 'esm_jwt') {
        throw new MarketError(
          'validation',
          `ESM(${market}): esm_jwt 입력 필요 (받은 kind: ${input.kind})`,
          { market },
        )
      }
      const { masterId, secretKey, sellerId, site: inputSite } = input
      if (!masterId || !secretKey || !sellerId) {
        throw new MarketError(
          'validation',
          `ESM(${market}): masterId / secretKey / sellerId 필수`,
          { market },
        )
      }
      if (inputSite !== site) {
        throw new MarketError(
          'validation',
          `ESM(${market}): site 불일치 — 어댑터=${site}, 입력=${inputSite}`,
          { market },
        )
      }
      cred = { masterId, secretKey, sellerId, site }
      return {
        kind: 'esm_jwt',
        payload: { masterId, secretKey, sellerId, site },
      } as StoredCredential
    },

    // ───────────────────────────────────────────
    // hydrate — 저장 자격증명으로 cred 복원 (API 호출 없음)
    // ───────────────────────────────────────────
    hydrate(stored: StoredCredential): void {
      if (stored.kind !== 'esm_jwt') {
        throw new MarketError(
          'validation',
          `ESM(${market}): esm_jwt 자격증명 필요 (받은 kind: ${stored.kind})`,
          { market },
        )
      }
      const p = stored.payload as {
        masterId?: string
        secretKey?: string
        sellerId?: string
      }
      if (!p.masterId || !p.secretKey || !p.sellerId) {
        throw new MarketError('validation', `ESM(${market}): 저장 자격증명 누락`, {
          market,
        })
      }
      // site 는 어댑터에 고정 — 저장값 대신 어댑터 site 사용.
      cred = { masterId: p.masterId, secretKey: p.secretKey, sellerId: p.sellerId, site }
    },

    // ───────────────────────────────────────────
    // fetchCategoryTree — site-cats 재귀 (esm-api/product/4.md)
    //   대분류 GET /categories/site-cats → 비-leaf 는 /{siteCatCode} 로 하위 재귀.
    //   site 선택은 JWT ssi 클레임(buildEsmJwt({ site }))으로 결정. isLeaf 만 등록 가능.
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const c = getCredOrThrow()
      const siteType: EsmSiteType = site === 'G' ? 2 : 1

      const fetchSiteCats = async (
        path: string,
        correlationId: string,
      ): Promise<EsmSiteCatRaw[]> => {
        const response = await esmFetch({
          market,
          method: 'GET',
          path,
          cred: c,
          correlationId,
          timeoutMs: CATEGORY_TIMEOUT_MS,
          logger,
        })
        if (!response.ok) {
          const text = await response.text().catch(() => '')
          throw httpStatusToMarketError(market, response.status, text, correlationId)
        }
        const raw = await response.json()
        return extractSiteCatList(raw)
      }

      const expand = async (
        raw: EsmSiteCatRaw,
        depth: number,
      ): Promise<EsmSiteCat> => {
        let children = raw.subCats
        if (!raw.isLeaf && (!children || children.length === 0) && depth < ESM_CATEGORY_MAX_DEPTH) {
          children = await fetchSiteCats(
            `/categories/site-cats/${encodeURIComponent(raw.catCode)}`,
            generateCorrelationId(),
          )
        }
        const expandedChildren =
          !raw.isLeaf && children && depth < ESM_CATEGORY_MAX_DEPTH
            ? await Promise.all(children.map((ch) => expand(ch, depth + 1)))
            : []
        return EsmSiteCatSchema.parse({
          siteCatCode: raw.catCode,
          siteCatName: raw.catName,
          isLeaf: raw.isLeaf,
          siteType,
          children: expandedChildren,
        })
      }

      const roots = await fetchSiteCats('/categories/site-cats', generateCorrelationId())
      const expandedRoots = await Promise.all(roots.map((r) => expand(r, 1)))
      return expandedRoots.map((cat) => siteCatToCategoryNode(cat, 1, null))
    },

    // transformProduct — 순수 함수. 중첩 EsmGoodsCreateRequest 빌드 (esm.md §4.1).
    // 배송 프로필 번호·officialNotice 는 오케스트레이터가 mapping.extra 로 주입.
    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      const raw = buildEsmGoodsPayload(market, site, product, mapping)
      return { market, raw }
    },

    // createProduct — ESM POST /item/v1/goods (중첩 페이로드).
    //   응답 siteDetail.{gmkt|iac}.SiteGoodsNo → externalId. 없으면 에러.
    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      const c = getCredOrThrow()
      const correlationId = generateCorrelationId()
      if (payload.market !== market) {
        throw new MarketError('validation', `잘못된 payload.market: ${payload.market}`, {
          market,
        })
      }
      const response = await esmFetch({
        market,
        method: 'POST',
        path: '/goods',
        body: payload.raw,
        cred: c,
        correlationId,
        logger,
      })
      const text = await response.text()
      if (!response.ok) {
        throw httpStatusToMarketError(market, response.status, text, correlationId)
      }
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        throw new MarketError('server', 'ESM 상품 생성 응답 JSON 파싱 실패', {
          market,
          status: response.status,
        })
      }
      const parsed = EsmGoodsCreateResponseSchema.safeParse(json)
      if (!parsed.success) {
        throw new MarketError('server', 'ESM 상품 생성 응답 스키마 불일치', {
          market,
          cause: parsed.error,
        })
      }
      // 호출한 site 의 SiteGoodsNo 를 externalId 로. site='G'→gmkt, 'A'→iac.
      const entry =
        site === 'G' ? parsed.data.siteDetail?.gmkt : parsed.data.siteDetail?.iac
      const externalId = entry?.SiteGoodsNo
      if (!externalId) {
        throw new MarketError(
          'server',
          `ESM 상품 생성 실패: ${entry?.SiteGoodsComment ?? parsed.data.message ?? '알 수 없는 오류'}`,
          {
            market,
            marketErrorCode: String(parsed.data.resultCode),
            marketErrorMessage: entry?.SiteGoodsComment,
          },
        )
      }
      const productUrl =
        site === 'G'
          ? `https://item.gmarket.co.kr/Item?goodscode=${externalId}`
          : `https://itempage3.auction.co.kr/DetailView.aspx?itemno=${externalId}`

      return {
        market,
        externalId,
        productUrl,
        status: 'succeeded',
        warnings: [],
      } as CreateProductResult
    },

    // ───────────────────────────────────────────
    // getRegistrationFields — 배송 프로필 선택 필드 (esm.md §4.6 / §6)
    //   officialNotice 는 PR-5. gmarket/auction 양쪽이 본 공용 어댑터로 동일 노출.
    // ───────────────────────────────────────────
    getRegistrationFields(): RegistrationFieldMeta[] {
      return getEsmRegistrationFields()
    },

    // ───────────────────────────────────────────
    // fetchOrders — ESM 주문조회 (POST /shipping/v1/Order/RequestOrders)
    //   esm-api/order-shipping/67.md. site → siteType, 결제완료(1) 신규 주문.
    // ───────────────────────────────────────────
    async fetchOrders(input: FetchOrdersInput): Promise<MarketOrder[]> {
      const parsedInput = FetchOrdersInputSchema.safeParse(input)
      if (!parsedInput.success) {
        throw new MarketError(
          'validation',
          `ESM(${market}) fetchOrders 입력 형식 오류 — ${parsedInput.error.message}`,
          { market, cause: parsedInput.error },
        )
      }

      const c = getCredOrThrow()
      const correlationId = generateCorrelationId()

      const body = buildEsmOrderListBody({
        site,
        since: parsedInput.data.since,
        until: parsedInput.data.until,
      })

      const response = await esmFetch({
        market,
        method: 'POST',
        baseUrl: ESM_SHIPPING_API_BASE,
        path: '/Order/RequestOrders',
        body,
        cred: c,
        correlationId,
        logger,
      })

      const text = await response.text()
      if (!response.ok) {
        throw httpStatusToMarketError(market, response.status, text, correlationId)
      }

      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        throw new MarketError('server', 'ESM 주문 응답 JSON 파싱 실패', {
          market,
          status: response.status,
        })
      }

      const parsed = EsmOrderListResponseSchema.safeParse(json)
      if (!parsed.success) {
        throw new MarketError('server', 'ESM 주문 응답 스키마 불일치', {
          market,
          cause: parsed.error,
        })
      }

      // ResultCode != 0 → 마켓 검증 실패 (조회기간 초과 등, Error Code 3000).
      if (
        parsed.data.ResultCode !== undefined &&
        parsed.data.ResultCode !== 0
      ) {
        throw new MarketError(
          'validation',
          `ESM(${market}) 주문조회 거부: ${parsed.data.Message ?? '알 수 없는 오류'}`,
          {
            market,
            marketErrorCode: String(parsed.data.ResultCode),
            marketErrorMessage: parsed.data.Message ?? undefined,
          },
        )
      }

      return mapEsmOrders(parsed.data.Data?.RequestOrders ?? [], market)
    },

    // ───────────────────────────────────────────
    // submitTracking — ESM 발송처리 (POST /shipping/v1/Delivery/ShippingInfo)
    //   esm-api/order-shipping/70.md. carrierCode → DeliveryCompanyCode(int).
    //   Edge 계약: positional 인자 + SubmitTrackingResult 반환 + 실패는 throw
    //   (재시도/결과 적재는 process.ts 오케스트레이터). 마켓 거부도 MarketError throw.
    // ───────────────────────────────────────────
    async submitTracking(
      externalOrderId: string,
      waybillNumber: string,
      carrierCode: string,
    ): Promise<SubmitTrackingResult> {
      const c = getCredOrThrow()
      const correlationId = generateCorrelationId()

      let body
      try {
        body = buildEsmShipInfoBody({
          externalOrderId,
          waybillNumber,
          carrierCode,
        })
      } catch (err) {
        throw new MarketError(
          'validation',
          `ESM(${market}) submitTracking: ${err instanceof Error ? err.message : '택배사 코드 오류'}`,
          { market },
        )
      }

      const response = await esmFetch({
        market,
        method: 'POST',
        baseUrl: ESM_SHIPPING_API_BASE,
        path: '/Delivery/ShippingInfo',
        body,
        cred: c,
        correlationId,
        logger,
      })

      const text = await response.text()
      if (!response.ok) {
        throw httpStatusToMarketError(market, response.status, text, correlationId)
      }

      let json: unknown = {}
      try {
        json = text.length > 0 ? JSON.parse(text) : {}
      } catch {
        throw new MarketError('server', 'ESM 발송 응답 JSON 파싱 실패', {
          market,
          status: response.status,
        })
      }

      const parsed = EsmShipResponseSchema.safeParse(json)
      if (!parsed.success) {
        throw new MarketError('server', 'ESM 발송 응답 스키마 불일치', {
          market,
          cause: parsed.error,
        })
      }

      // ResultCode 0 / "Success" → 성공. 그 외(3000 등) → 마켓 거부 throw.
      if (!isEsmSuccessCode(parsed.data.ResultCode)) {
        throw new MarketError(
          'validation',
          `ESM(${market}) 발송 처리 실패: ${parsed.data.Message ?? '알 수 없는 오류'}`,
          {
            market,
            marketErrorCode:
              parsed.data.ResultCode !== undefined
                ? String(parsed.data.ResultCode)
                : undefined,
            marketErrorMessage: parsed.data.Message ?? undefined,
          },
        )
      }

      return {
        market,
        externalOrderId,
        waybillNumber,
        carrierCode,
        ...(parsed.data.Data?.OrderNo !== undefined
          ? { trackingReceiptId: String(parsed.data.Data.OrderNo) }
          : {}),
      }
    },
  }
}
