/**
 * ESM 2.0 (G마켓·옥션) 공용 real 어댑터 (프론트엔드 / Vite 환경).
 *
 * G마켓·옥션은 ESM+ 백오피스를 공유 — API base / payload 형식 / 카테고리 트리
 * 구조가 동일하고 `site` 필드만 'G' / 'A' 로 분기. 어댑터 본문도 1개로 통합하고
 * 마켓 ID + site 만 인자로 받는다.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9
 *   - WIP-5markets-mvp.md C-3 Phase 1+2
 *
 * 인증 방식: ESM JWT HS256 (credential kind = 'esm_jwt').
 *   - refreshToken 없음 (영구 키, 매 요청마다 JWT 새로 발급 — 수명 5분).
 *   - authenticate = 자격증명 검증 후 StoredCredential 저장 (API 호출 없이).
 *
 * API 기반:
 *   - ESM_API_BASE = https://sa2.esmplus.com/item/v1 (공식 문서 esm-api/README.md)
 *   - 카테고리(PR-2): GET /categories/site-cats (대분류) + GET /categories/site-cats/{siteCatCode} (하위) 재귀.
 *     site 선택은 쿼리 파라미터가 아니라 JWT 의 ssi 클레임(buildEsmJwt({ site }))으로 결정된다
 *     (esm-api/product/4.md "해당 사이트 ID 1개만 입력된 인증토큰으로 호출", README.md:164).
 *     isLeaf=true 인 최하위만 상품등록 가능.
 *   - 상품 생성(PR-4): POST /item/v1/goods — 중첩 EsmGoodsCreateRequest(itemBasicInfo/
 *     itemAddtionalInfo). 배송 프로필 번호·officialNotice 는 오케스트레이터가 mapping.extra
 *     로 주입. 응답 siteDetail.{gmkt|iac}.SiteGoodsNo 를 externalId 로 매핑.
 *
 * 중요 제약:
 *   - masterId / accessKey / secretKey 는 절대 로그에 포함 금지.
 *   - 모든 외부 호출에 correlationId 부여.
 *   - 검색용 상품명(goodsName.kor) 최대 100byte, 초과 시 byte 경계 truncate (esm.md §4.1).
 *   - 카테고리 조회는 Edge markets-category-children 로 이전 (category-sync.md §6.4) — 어댑터 fetchCategoryTree 는 미사용 throw.
 *
 * 현재 제약 (베타):
 *   - 실제 자격증명 미보유. 통합 테스트는 fetch mock 으로.
 *   - 상품 등록 API 최종 payload 스펙 베타 셀러 확인 후 보정 예정.
 */

import { MarketError } from '../../errors'
import type { MarketAdapter } from '../../types'
import {
  EsmGoodsCreateRequestSchema,
  EsmGoodsCreateResponseSchema,
  EsmJwtAuthInputSchema,
  EsmTransformExtraSchema,
  StoredCredentialSchema,
  CreateProductResultSchema,
  type AuthInput,
  type CategoryNode,
  type EsmGoodsCreateRequest,
  type EsmSiteType,
  type CreateProductResult,
  type FetchOrdersInput,
  type MarketId,
  type MarketMapping,
  type MarketOrder,
  type MarketPayload,
  type MarketSubmitTrackingResult,
  type Product,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'
import { buildEsmJwt } from './jwt'
import { getEsmRegistrationFields } from './registration-fields'
import type { RegistrationFieldMeta } from '@/lib/schemas'

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

export const ESM_API_BASE = 'https://sa2.esmplus.com/item/v1'
const DEFAULT_TIMEOUT_MS = 15_000
/** 검색용 상품명(goodsName.kor) 최대 byte (esm.md §4.1 / product/20.md). */
const GOODS_NAME_MAX_BYTES = 100
/** 미지정 시 기본 판매기간 (무제한, esm.md §4.1 sellingPeriod). */
const DEFAULT_SELLING_PERIOD = -1
/** 미지정 시 기본 배송 type (1=택배). */
const DEFAULT_SHIPPING_TYPE = 1

/** UTF-8 byte 길이로 잘라 ≤maxBytes 보장 (멀티바이트 경계 안전). */
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
 *
 * 순수 함수 (Date.now / Math.random / 네트워크 금지 — esm.md §7 PR-4).
 * 배송 프로필 번호(placeNo/dispatchPolicyNo)·officialNotice 는 오케스트레이터가
 * mapping.extra 로 주입한다(여기선 받은 값을 페이로드에 넣기만).
 *
 * site별 분리 (esm.md §4.1):
 *   - site='G'(지마켓) → category.site=[{siteType:2}], price.Gmkt, stock.Gmkt, dispatchPolicyNo.gmkt
 *   - site='A'(옥션)   → siteType:1, price.Iac, stock.Iac, dispatchPolicyNo.iac
 *
 * 출력은 EsmGoodsCreateRequestSchema.parse 로 검증한다(스키마 단일 소스).
 * 누락(placeNo/dispatchPolicyNo/officialNotice) 또는 옥션 이미지 중복은 여기서
 * validation MarketError 로 차단.
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

  // 이미지: basic(0번째) + 추가 1~14 (addtionalImg{n}URL). 순차 입력.
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

  // site별 단일 사이트만 채운다.
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

// site-cats 카테고리 raw 스키마(EsmSiteCatRaw / EsmSiteCatRawSchema)는 fetchCategoryTree
//   직접 fetch 제거와 함께 삭제됨 — 카테고리 조회는 Edge markets-category-children 으로 이전
//   (category-sync.md §6.4).

// ─────────────────────────────────────────────
// ESM JWT credential (내부)
// ─────────────────────────────────────────────

interface EsmCred {
  masterId: string
  /** ESM+ 의 access key (sellerId 슬롯 — 우리 schema 의 sellerId 필드로 저장). */
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
// fetch wrapper — JWT Authorization + timeout
// ─────────────────────────────────────────────

async function esmFetch(opts: {
  market: MarketId
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  query?: Record<string, string>
  body?: unknown
  cred: EsmCred
  correlationId: string
  timeoutMs?: number
}): Promise<Response> {
  const { market, method, path, query, body, cred, correlationId, timeoutMs = DEFAULT_TIMEOUT_MS } =
    opts

  // JWT 발급 (수명 5분, 매 요청마다 새로)
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
  const url = `${ESM_API_BASE}${path}${queryString}`

  const controller = new AbortController()
  const timerId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `Bearer ${token}`,
        'X-Correlation-Id': correlationId,
      },
      body: body !== undefined ? JSON.stringify(body) : null,
      signal: controller.signal,
    })
    return response
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketError('network', 'ESM API 요청 timeout', {
        market,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    throw new MarketError('network', 'ESM API 네트워크 오류', {
      market,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }
}

// site-cats 응답 정규화 헬퍼(extractSiteCatList / siteCatToCategoryNode)는 fetchCategoryTree
//   직접 fetch 제거와 함께 삭제됨 — 카테고리 조회는 Edge markets-category-children 으로 이전
//   (category-sync.md §6.4).

// ─────────────────────────────────────────────
// 어댑터 팩토리 (site 별 인스턴스)
// ─────────────────────────────────────────────

export interface EsmAdapterOptions {
  market: MarketId // 'gmarket' | 'auction'
  site: 'G' | 'A'
}

/**
 * G마켓·옥션 공용 ESM JWT real 어댑터 팩토리.
 * site 가 인자로 들어가고 나머지 로직은 공통. 마켓별 1파일에서 호출.
 */
export function createEsmRealAdapter(options: EsmAdapterOptions): MarketAdapter {
  const { market, site } = options

  // 인스턴스 자격증명 (authenticate 후 설정)
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

  const adapter: MarketAdapter = {
    market,
    credentialKind: 'esm_jwt',

    // ───────────────────────────────────────────
    // authenticate — API 호출 없이 자격증명 검증 + 저장
    // ───────────────────────────────────────────
    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (input.kind !== 'esm_jwt') {
        throw new MarketError(
          'validation',
          `ESM(${market}): esm_jwt 입력 필요 (받은 kind: ${input.kind})`,
          { market },
        )
      }

      const parsed = EsmJwtAuthInputSchema.safeParse(input)
      if (!parsed.success) {
        throw new MarketError(
          'validation',
          `ESM(${market}): 자격증명 형식 오류 — ${parsed.error.message}`,
          { market, cause: parsed.error },
        )
      }

      // site 일관성 검증 — 입력 site 와 어댑터 site 가 다르면 거부.
      if (parsed.data.site !== site) {
        throw new MarketError(
          'validation',
          `ESM(${market}): site 불일치 — 어댑터=${site}, 입력=${parsed.data.site}`,
          { market },
        )
      }

      const { masterId, secretKey, sellerId } = parsed.data
      cred = { masterId, secretKey, sellerId, site }

      return StoredCredentialSchema.parse({
        kind: 'esm_jwt',
        payload: { masterId, secretKey, sellerId, site },
      })
    },

    // ───────────────────────────────────────────
    // fetchCategoryTree — Edge `markets-category-children` 로 이전됨 (category-sync.md §6.4).
    //   브라우저 직접 fetch 는 CORS 차단 → lazy cascading Edge 경유로 전환. 런타임 미사용.
    //   인터페이스 충족용 시그니처만 유지(throw).
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      throw new Error(
        'fetchCategoryTree 는 Edge markets-category-children 으로 이전됨 (category-sync.md §6.4)',
      )
    },

    // ───────────────────────────────────────────
    // transformProduct — 순수 함수. Date.now / Math.random / 네트워크 금지.
    //   중첩 EsmGoodsCreateRequest 빌드 (esm.md §4.1). 배송 프로필 번호·
    //   officialNotice 는 오케스트레이터가 mapping.extra 로 주입한 값을 사용.
    // ───────────────────────────────────────────
    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      const raw = buildEsmGoodsPayload(market, site, product, mapping)
      return { market, raw }
    },

    // ───────────────────────────────────────────
    // createProduct — ESM POST /item/v1/goods (중첩 페이로드)
    //   응답 siteDetail.{gmkt|iac}.SiteGoodsNo → externalId. 없으면 에러.
    // ───────────────────────────────────────────
    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      const c = getCredOrThrow()
      const correlationId = crypto.randomUUID()

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
            ...(entry?.SiteGoodsComment !== undefined
              ? { marketErrorMessage: entry.SiteGoodsComment }
              : {}),
          },
        )
      }

      // ESM 상품 URL 패턴 — G/A 분기 (현 fallback 유지).
      const productUrl =
        site === 'G'
          ? `https://item.gmarket.co.kr/Item?goodscode=${externalId}`
          : `https://itempage3.auction.co.kr/DetailView.aspx?itemno=${externalId}`

      return CreateProductResultSchema.parse({
        market,
        externalId,
        productUrl,
        status: 'succeeded',
        warnings: [],
      })
    },

    // ───────────────────────────────────────────
    // getRegistrationFields — 배송 프로필 선택 필드 (esm.md §4.6 / §6)
    //   officialNotice 는 PR-5. gmarket/auction 양쪽이 본 공용 어댑터로 동일 노출.
    // ───────────────────────────────────────────
    getRegistrationFields(): RegistrationFieldMeta[] {
      return getEsmRegistrationFields()
    },

    // ───────────────────────────────────────────
    // v2 Extension — fetchOrders / submitTracking
    // ───────────────────────────────────────────
    async fetchOrders(
      input: FetchOrdersInput,
      credential?: StoredCredential,
    ): Promise<MarketOrder[]> {
      const c = credential ?? buildStoredCredentialFromInstance(cred)
      const { esmFetchOrders } = await import('./orders')
      return esmFetchOrders({ market, site, input, credential: c })
    },

    async submitTracking(
      input: SubmitTrackingInput,
      credential?: StoredCredential,
    ): Promise<MarketSubmitTrackingResult> {
      const c = credential ?? buildStoredCredentialFromInstance(cred)
      const { esmSubmitTracking } = await import('./orders')
      return esmSubmitTracking({ market, site, input, credential: c })
    },
  }

  return adapter
}

/** 인스턴스 EsmCred → StoredCredential (cred 없으면 undefined). */
function buildStoredCredentialFromInstance(
  cred: EsmCred | null,
): StoredCredential | undefined {
  if (!cred) return undefined
  return {
    kind: 'esm_jwt',
    payload: {
      masterId: cred.masterId,
      secretKey: cred.secretKey,
      sellerId: cred.sellerId,
      site: cred.site,
    },
  }
}
