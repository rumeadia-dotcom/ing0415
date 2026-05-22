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
 *   - ESM_API_BASE = https://sa.esmplus.com/api/v1
 *   - 카테고리: GET /category (site 쿼리)
 *   - 상품 생성: POST /products
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
import type {
  AuthInput,
  CreateProductResult,
  MarketId,
  MarketMapping,
  MarketPayload,
  Product,
  StoredCredential,
} from '../schemas.ts'
import type { MarketAdapter } from '../market-adapter.ts'
import { buildEsmJwt } from './esm-jwt.ts'

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

export const ESM_API_BASE = 'https://sa.esmplus.com/api/v1'
const CATEGORY_TIMEOUT_MS = 10_000
const DEFAULT_TIMEOUT_MS = 15_000
const PRODUCT_NAME_MAX_LENGTH = 80

// ─────────────────────────────────────────────
// 응답 zod 스키마
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
  }),
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
  })

  const queryString = query
    ? '?' +
      Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : ''
  const url = `${ESM_API_BASE}${path}${queryString}`

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
  return {
    id,
    name: raw.categoryName,
    depth,
    leaf: isLeaf,
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

    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const c = getCredOrThrow()
      const correlationId = generateCorrelationId()
      const response = await esmFetch({
        market,
        method: 'GET',
        path: '/category',
        query: { site },
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
        tree.push(normalizeCategoryNode(root, 1, null))
      }
      return tree
    },

    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      const truncatedName =
        product.name.length > PRODUCT_NAME_MAX_LENGTH
          ? product.name.slice(0, PRODUCT_NAME_MAX_LENGTH)
          : product.name
      const raw = {
        site,
        sellerId: cred?.sellerId ?? '',
        itemName: truncatedName,
        sellPrice: product.priceKrw,
        stockQty: product.stock,
        images: mapping.transformedImageUrls.map((url, idx) => ({
          order: idx,
          imageUrl: url,
          imageType: idx === 0 ? 'MAIN' : 'EXTRA',
        })),
        categoryCode: mapping.categoryId,
        shippingFee: product.shippingFeeKrw,
        brand: product.brand ?? '',
        ...mapping.extra,
      }
      return { market, raw }
    },

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
        path: '/products',
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
            marketErrorMessage: parsed.data.resultMessage,
          },
        )
      }
      const externalId = data.itemNo
      const fallbackUrlBase =
        site === 'G'
          ? `https://item.gmarket.co.kr/Item?goodscode=${externalId}`
          : `https://itempage3.auction.co.kr/DetailView.aspx?itemno=${externalId}`
      const productUrl = data.itemUrl ?? fallbackUrlBase

      return {
        market,
        externalId,
        productUrl,
        status: 'succeeded',
        warnings: [],
      } as CreateProductResult
    },
  }
}
