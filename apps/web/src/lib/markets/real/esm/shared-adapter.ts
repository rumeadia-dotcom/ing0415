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
 *   - ESM_API_BASE = https://sa.esmplus.com/api/v1
 *   - 카테고리: GET /category (depth 3 재귀, site 쿼리 파라미터)
 *   - 상품 생성: POST /products
 *
 * 중요 제약:
 *   - masterId / accessKey / secretKey 는 절대 로그에 포함 금지.
 *   - 모든 외부 호출에 correlationId 부여.
 *   - 상품명 최대 80자 (ESM Selling API 요건), 초과 시 truncate.
 *   - 카테고리 트리는 depth 3 까지 재귀 fetch (timeout 10s).
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
  StoredCredentialSchema,
  CategoryNodeSchema,
  CreateProductResultSchema,
  type AuthInput,
  type CategoryNode,
  type CreateProductResult,
  type MarketId,
  type MarketMapping,
  type MarketPayload,
  type Product,
  type StoredCredential,
} from '@/lib/schemas'
import { buildEsmJwt } from './jwt'

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

export const ESM_API_BASE = 'https://sa.esmplus.com/api/v1'
const CATEGORY_TIMEOUT_MS = 10_000
const DEFAULT_TIMEOUT_MS = 15_000
const PRODUCT_NAME_MAX_LENGTH = 80

// ─────────────────────────────────────────────
// ESM Selling API 응답 zod 스키마 (런타임 검증)
// ─────────────────────────────────────────────

interface EsmCategoryRaw {
  categoryId: number | string
  categoryName: string
  isLeaf: boolean
  children?: unknown[]
}

const EsmCategoryNodeRawSchema: z.ZodType<EsmCategoryRaw> = z.lazy(() =>
  z.object({
    categoryId: z.union([z.number(), z.string()]),
    categoryName: z.string(),
    isLeaf: z.boolean(),
    children: z.array(z.unknown()).optional(),
  }) as z.ZodType<EsmCategoryRaw>,
)

const EsmCategoryResponseSchema = z.object({
  resultCode: z.string(),
  resultMessage: z.string().optional(),
  data: z
    .object({
      categories: z.array(EsmCategoryNodeRawSchema).optional().default([]),
    })
    .optional(),
})

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
// 카테고리 트리 정규화
// ─────────────────────────────────────────────

function normalizeCategoryNode(
  raw: EsmCategoryRaw,
  depth: number,
  parentId: string | null,
): CategoryNode {
  const id = String(raw.categoryId)
  const isLeaf = raw.isLeaf || depth >= 3
  const children: CategoryNode[] = []

  if (!isLeaf && Array.isArray(raw.children)) {
    for (const child of raw.children) {
      const parsed = EsmCategoryNodeRawSchema.safeParse(child)
      if (!parsed.success) continue
      children.push(normalizeCategoryNode(parsed.data, depth + 1, id))
    }
  }

  const node: CategoryNode = {
    id,
    name: raw.categoryName,
    depth,
    leaf: isLeaf,
    parentId,
    children,
  }
  return CategoryNodeSchema.parse(node)
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
    // fetchCategoryTree — depth 3까지 재귀 (site 쿼리)
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const c = getCredOrThrow()
      const correlationId = crypto.randomUUID()

      const response = await esmFetch({
        market,
        method: 'GET',
        path: '/category',
        query: { site },
        cred: c,
        correlationId,
        timeoutMs: CATEGORY_TIMEOUT_MS,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw httpStatusToMarketError(market, response.status, text, correlationId)
      }

      const raw = await response.json()
      const parsed = EsmCategoryResponseSchema.safeParse(raw)
      if (!parsed.success) {
        throw new MarketError('server', 'ESM 카테고리 응답 파싱 실패', {
          market,
          cause: parsed.error,
        })
      }

      const rootCategories = parsed.data.data?.categories ?? []
      const tree: CategoryNode[] = []
      for (const root of rootCategories) {
        const node = normalizeCategoryNode(root, 1, null)
        tree.push(node)
      }
      return tree
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
  }

  return adapter
}
