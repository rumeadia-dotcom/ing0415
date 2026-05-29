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
 *   - 상품 생성: POST /products
 *   ※ 상품 생성 경로(/products)·페이로드 빌드는 PR-4 에서 문서 기준 재작성 예정.
 *
 * 중요 제약:
 *   - masterId / accessKey / secretKey 는 절대 로그에 포함 금지.
 *   - 모든 외부 호출에 correlationId 부여.
 *   - 상품명 최대 80자 (ESM Selling API 요건), 초과 시 truncate.
 *   - 카테고리 트리는 site-cats 재귀 fetch (timeout 10s, 최대 깊이 ESM_CATEGORY_MAX_DEPTH).
 *
 * 현재 제약 (베타):
 *   - 실제 자격증명 미보유. 통합 테스트는 fetch mock 으로.
 *   - 상품 등록 API 최종 payload 스펙 베타 셀러 확인 후 보정 예정.
 */

import { z } from 'zod'
import { MarketError } from '../../errors'
import type { MarketAdapter } from '../../types'
import {
  EsmJwtAuthInputSchema,
  EsmSiteCatSchema,
  StoredCredentialSchema,
  CategoryNodeSchema,
  CreateProductResultSchema,
  type AuthInput,
  type CategoryNode,
  type EsmSiteCat,
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

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

export const ESM_API_BASE = 'https://sa2.esmplus.com/item/v1'
const CATEGORY_TIMEOUT_MS = 10_000
const DEFAULT_TIMEOUT_MS = 15_000
const PRODUCT_NAME_MAX_LENGTH = 80
/** site-cats 재귀 안전 상한 (ESM 트리는 통상 3~5 depth). 무한 재귀·요청 폭증 방지. */
export const ESM_CATEGORY_MAX_DEPTH = 5

// ─────────────────────────────────────────────
// site-cats 카테고리 API 응답 raw 스키마 (런타임 검증)
//   esm-api/product/4.md — { catCode, catName, isLeaf, subCats?[] }
//   대분류 GET /categories/site-cats / 하위 GET /categories/site-cats/{siteCatCode}
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
) as z.ZodType<EsmSiteCatRaw>

const EsmCreateProductResponseSchema = z.object({
  resultCode: z.string(),
  resultMessage: z.string().optional(),
  data: z
    .object({
      itemNo: z.string().optional(),
      itemUrl: z.string().url().optional(),
    })
    .optional(),
})

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

// ─────────────────────────────────────────────
// site-cats 응답 정규화
//   raw(catCode/catName/isLeaf/subCats) → EsmSiteCat(siteCatCode/...) → CategoryNode
// ─────────────────────────────────────────────

/**
 * site-cats 응답 본문에서 카테고리 배열을 추출한다.
 * 대분류 조회는 배열, 하위 조회(/{code})는 단일 객체(subCats 포함)를 반환할 수 있으므로
 * 양쪽을 모두 허용한다. 알 수 없는 형태는 빈 배열.
 */
function extractSiteCatList(raw: unknown): EsmSiteCatRaw[] {
  // 배열 그대로
  if (Array.isArray(raw)) {
    return raw
      .map((r) => EsmSiteCatRawSchema.safeParse(r))
      .filter((p): p is { success: true; data: EsmSiteCatRaw } => p.success)
      .map((p) => p.data)
  }
  // 단일 객체 (대분류 wrapper 없이 1개 / 하위 조회 단일 객체)
  const single = EsmSiteCatRawSchema.safeParse(raw)
  if (single.success) return [single.data]
  // wrapper 형태 — { subCats: [...] } / { categories: [...] } / { data: ... }
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
  return CategoryNodeSchema.parse({
    id: cat.siteCatCode,
    name: cat.siteCatName,
    depth,
    leaf: cat.isLeaf,
    parentId,
    children,
  })
}

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
    // fetchCategoryTree — site-cats 재귀 (esm-api/product/4.md)
    //   대분류 GET /categories/site-cats → 비-leaf 는 /{siteCatCode} 로 하위 재귀.
    //   site 선택은 JWT ssi 클레임(esmFetch 내부 buildEsmJwt({ site }))으로 결정.
    //   isLeaf=true 인 최하위만 상품등록 가능.
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const c = getCredOrThrow()
      // site='G'(지마켓)→siteType 2, site='A'(옥션)→siteType 1 (esm.md §4.1).
      const siteType: EsmSiteType = site === 'G' ? 2 : 1

      // 단일 site-cats 호출 → raw 카테고리 배열.
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
        })
        if (!response.ok) {
          const text = await response.text().catch(() => '')
          throw httpStatusToMarketError(market, response.status, text, correlationId)
        }
        const raw = await response.json()
        return extractSiteCatList(raw)
      }

      // 비-leaf 노드를 하위 조회로 채워 트리 완성 (깊이 상한).
      const expand = async (
        raw: EsmSiteCatRaw,
        depth: number,
      ): Promise<EsmSiteCat> => {
        let children = raw.subCats
        // 하위가 비어있고 leaf 가 아니며 깊이 여유가 있으면 /{code} 로 조회.
        if (!raw.isLeaf && (!children || children.length === 0) && depth < ESM_CATEGORY_MAX_DEPTH) {
          const childCorrelationId = crypto.randomUUID()
          children = await fetchSiteCats(
            `/categories/site-cats/${encodeURIComponent(raw.catCode)}`,
            childCorrelationId,
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

      const rootCorrelationId = crypto.randomUUID()
      const roots = await fetchSiteCats('/categories/site-cats', rootCorrelationId)
      const expandedRoots = await Promise.all(roots.map((r) => expand(r, 1)))
      return expandedRoots.map((cat) => siteCatToCategoryNode(cat, 1, null))
    },

    // ───────────────────────────────────────────
    // transformProduct — 순수 함수. Date.now / Math.random 금지.
    // ───────────────────────────────────────────
    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      // 상품명 80자 제한 (ESM Selling API 요건)
      const truncatedName =
        product.name.length > PRODUCT_NAME_MAX_LENGTH
          ? product.name.slice(0, PRODUCT_NAME_MAX_LENGTH)
          : product.name

      // ESM Selling API 상품 등록 payload (부분 구현 — 베타 셀러 확인 후 보정)
      const raw = {
        site,
        // sellerId 가 store identifier 역할
        sellerId: cred?.sellerId ?? '',
        // 상품 정보
        itemName: truncatedName,
        sellPrice: product.priceKrw,
        stockQty: product.stock,
        // 이미지 (order 순)
        images: mapping.transformedImageUrls.map((url, idx) => ({
          order: idx,
          imageUrl: url,
          imageType: idx === 0 ? 'MAIN' : 'EXTRA',
        })),
        // 카테고리 (ESM: categoryCode)
        categoryCode: mapping.categoryId,
        // 배송
        shippingFee: product.shippingFeeKrw,
        // 브랜드
        brand: product.brand ?? '',
        // 추가 매핑
        ...mapping.extra,
      }

      return { market, raw }
    },

    // ───────────────────────────────────────────
    // createProduct — ESM Selling API POST /products
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
        path: '/products',
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

      const parsed = EsmCreateProductResponseSchema.safeParse(json)
      if (!parsed.success) {
        throw new MarketError('server', 'ESM 상품 생성 응답 스키마 불일치', {
          market,
          cause: parsed.error,
        })
      }

      const data = parsed.data.data
      if (!data?.itemNo) {
        throw new MarketError(
          'server',
          `ESM 상품 생성 실패: ${parsed.data.resultMessage ?? '알 수 없는 오류'}`,
          {
            market,
            marketErrorCode: parsed.data.resultCode,
            ...(parsed.data.resultMessage !== undefined
              ? { marketErrorMessage: parsed.data.resultMessage }
              : {}),
          },
        )
      }

      const externalId = data.itemNo
      // ESM 상품 URL 패턴 — G/A 분기. itemUrl 응답이 있으면 우선 사용.
      const fallbackUrlBase =
        site === 'G'
          ? `https://item.gmarket.co.kr/Item?goodscode=${externalId}`
          : `https://itempage3.auction.co.kr/DetailView.aspx?itemno=${externalId}`
      const productUrl = data.itemUrl ?? fallbackUrlBase

      return CreateProductResultSchema.parse({
        market,
        externalId,
        productUrl,
        status: 'succeeded',
        warnings: [],
      })
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
