/**
 * 쿠팡 Wing OpenAPI real 어댑터 (Edge Function / Deno 측).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9
 *   - WIP-5markets-mvp.md C-2 Phase 2
 *
 * 인증 방식: HMAC-SHA256 (credential kind = 'hmac').
 *   - refreshToken 없음 (영구 키).
 *   - authenticate = 자격증명 검증 후 StoredCredential 저장 (API 호출 없이).
 *
 * API 기반:
 *   - COUPANG_API_BASE = https://api-gateway.coupang.com
 *   - 카테고리: GET /v2/providers/seller_api/apis/api/v1/categorization/display-categories/{id}
 *   - 상품 생성: POST /v2/providers/seller_api/apis/api/v1/marketplace/seller-products
 *
 * 에러 매핑:
 *   - 401 / 403 → MarketError('unauthorized')
 *   - 400 / 422 → MarketError('validation')
 *   - 429       → MarketError('rate_limit')
 *   - 5xx       → MarketError('server')
 *   - timeout   → MarketError('network')
 *
 * 보안 강제:
 *   - accessKey / secretKey / vendorId 는 절대 로그 포함 금지.
 *   - 모든 외부 호출에 correlationId 부여.
 *   - 상품명 최대 50자 (Wing OpenAPI 요건).
 */

import { z } from 'npm:zod@3.23.8'
import { MarketError } from '../errors.ts'
import { createLogger } from '../logger.ts'
import { generateCorrelationId } from '../correlation.ts'
import type {
  AuthInput,
  CategoryNode,
  CreateProductResult,
  MarketMapping,
  MarketPayload,
  Product,
  StoredCredential,
} from '../schemas.ts'
import type { MarketAdapter } from '../market-adapter.ts'
import { buildCoupangSignature } from './coupang-hmac.ts'

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

export const COUPANG_API_BASE = 'https://api-gateway.coupang.com'
const MARKET = 'coupang' as const
const CATEGORY_TIMEOUT_MS = 10_000
const DEFAULT_TIMEOUT_MS = 15_000
const PRODUCT_NAME_MAX_LENGTH = 50

const logger = createLogger('market-adapter:coupang')

// ─────────────────────────────────────────────
// Wing OpenAPI 응답 zod 스키마
// ─────────────────────────────────────────────

const CoupangCategoryResponseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  data: z
    .object({
      categoryId: z.number(),
      displayCategoryName: z.string(),
      isLeafCategory: z.boolean(),
      subCategories: z
        .array(
          z.object({
            categoryId: z.number(),
            displayCategoryName: z.string(),
            isLeafCategory: z.boolean(),
          }),
        )
        .optional()
        .default([]),
    })
    .optional(),
})

const CoupangCreateProductResponseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  data: z
    .object({
      sellerProductId: z.number().optional(),
      productUrl: z.string().url().optional(),
    })
    .optional(),
})

// CategoryNode 재귀 스키마 (Deno 측 수동 정의)
interface CategoryNode {
  id: string
  name: string
  depth: number
  leaf: boolean
  parentId: string | null
  children: CategoryNode[]
}

// ─────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────

/** HTTP 상태 → MarketError code 매핑. */
function httpStatusToMarketError(
  status: number,
  message: string,
  correlationId: string,
): MarketError {
  if (status === 401 || status === 403) {
    return new MarketError('unauthorized', `쿠팡 인증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 400 || status === 422) {
    return new MarketError(
      'validation',
      `쿠팡 요청 검증 실패 (${status}): ${message}`,
      {
        market: MARKET,
        status,
        marketErrorMessage: message,
        marketErrorCode: String(status),
      },
    )
  }
  if (status === 429) {
    return new MarketError('rate_limit', '쿠팡 API rate limit 초과', {
      market: MARKET,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError(`쿠팡 서버 오류 (${status})` as never, `쿠팡 서버 오류 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  return new MarketError(
    'unknown',
    `쿠팡 API 오류 (${status}) correlationId=${correlationId}`,
    { market: MARKET, status, marketErrorMessage: message },
  )
}

/** Wing OpenAPI fetch wrapper — HMAC 서명 + timeout + 로깅. */
async function coupangFetch(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  accessKey: string
  secretKey: string
  body?: unknown
  correlationId: string
  jobId?: string
  timeoutMs?: number
}): Promise<Response> {
  const {
    method,
    path,
    accessKey,
    secretKey,
    body,
    correlationId,
    jobId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  const { authorization } = await buildCoupangSignature({
    method,
    path,
    accessKey,
    secretKey,
  })

  const url = `${COUPANG_API_BASE}${path}`
  const reqLogger = logger.with({ correlationId, jobId, market: MARKET })

  reqLogger.info({ method, url: path }, '→ market request')

  const controller = new AbortController()
  const timerId = setTimeout(() => { controller.abort() }, timeoutMs)

  const start = Date.now()
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: authorization,
        'X-Correlation-Id': correlationId,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const latencyMs = Date.now() - start
    reqLogger.info({ status: response.status, latencyMs }, '← market response')
    return response
  } catch (err) {
    const latencyMs = Date.now() - start
    if (err instanceof DOMException && err.name === 'AbortError') {
      reqLogger.error({ latencyMs, marketErrorCode: 'timeout' }, '← market error')
      throw new MarketError('network', '쿠팡 API 요청 timeout', {
        market: MARKET,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    reqLogger.error({ latencyMs }, '← market error')
    throw new MarketError('network', '쿠팡 API 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }
}

/** 카테고리 단건 fetch + depth 3까지 재귀. */
async function fetchCategoryNode(
  categoryId: number,
  depth: number,
  accessKey: string,
  secretKey: string,
  correlationId: string,
): Promise<CategoryNode> {
  const path = `/v2/providers/seller_api/apis/api/v1/categorization/display-categories/${categoryId}`
  const response = await coupangFetch({
    method: 'GET',
    path,
    accessKey,
    secretKey,
    correlationId,
    timeoutMs: CATEGORY_TIMEOUT_MS,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw httpStatusToMarketError(response.status, text, correlationId)
  }

  const raw = await response.json()
  const parsed = CoupangCategoryResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new MarketError('server', '쿠팡 카테고리 응답 파싱 실패', {
      market: MARKET,
      cause: parsed.error,
    })
  }

  const data = parsed.data.data
  if (!data) {
    throw new MarketError('server', '쿠팡 카테고리 데이터 없음', {
      market: MARKET,
      marketErrorCode: parsed.data.code,
      marketErrorMessage: parsed.data.message,
    })
  }

  const isLeaf = data.isLeafCategory || depth >= 3
  const children: CategoryNode[] = []

  if (!isLeaf && data.subCategories && data.subCategories.length > 0) {
    for (const sub of data.subCategories) {
      const child = await fetchCategoryNode(
        sub.categoryId,
        depth + 1,
        accessKey,
        secretKey,
        correlationId,
      )
      children.push(child)
    }
  }

  return {
    id: String(data.categoryId),
    name: data.displayCategoryName,
    depth,
    leaf: isLeaf,
    parentId: depth === 1 ? null : String(categoryId),
    children,
  }
}

// ─────────────────────────────────────────────
// HMAC credential 타입 (내부)
// ─────────────────────────────────────────────

interface HmacCred {
  accessKey: string
  secretKey: string
  vendorId: string
}

// ─────────────────────────────────────────────
// 어댑터 팩토리
// ─────────────────────────────────────────────

export function createCoupangAdapter(): MarketAdapter {
  let cred: HmacCred | null = null

  function getCredOrThrow(): HmacCred {
    if (!cred) {
      throw new MarketError('unauthorized', '쿠팡 어댑터: authenticate 를 먼저 호출해주세요', {
        market: MARKET,
      })
    }
    return cred
  }

  return {
    market: MARKET,
    credentialKind: 'hmac',

    // ───────────────────────────────────────────
    // authenticate
    // ───────────────────────────────────────────
    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (input.kind !== 'hmac_key') {
        throw new MarketError(
          'validation',
          `쿠팡: hmac_key 입력 필요 (받은 kind: ${input.kind})`,
          { market: MARKET },
        )
      }

      const { accessKey, secretKey, vendorId } = input
      if (!accessKey || !secretKey || !vendorId) {
        throw new MarketError('validation', '쿠팡: accessKey / secretKey / vendorId 필수', {
          market: MARKET,
        })
      }

      cred = { accessKey, secretKey, vendorId }

      return {
        kind: 'hmac',
        payload: { accessKey, secretKey, vendorId },
      } as StoredCredential
    },

    // ───────────────────────────────────────────
    // fetchCategoryTree
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const { accessKey, secretKey } = getCredOrThrow()
      const correlationId = generateCorrelationId()
      const rootNode = await fetchCategoryNode(1, 1, accessKey, secretKey, correlationId)
      return [rootNode]
    },

    // ───────────────────────────────────────────
    // transformProduct — 순수 함수
    // ───────────────────────────────────────────
    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      const truncatedName =
        product.name.length > PRODUCT_NAME_MAX_LENGTH
          ? product.name.slice(0, PRODUCT_NAME_MAX_LENGTH)
          : product.name

      const raw = {
        sellerProductName: truncatedName,
        vendorId: cred?.vendorId ?? '',
        salePrice: product.priceKrw,
        stockQuantity: product.stock,
        images: mapping.transformedImageUrls.map((url, idx) => ({
          imageOrder: idx,
          imageType: 'REPRESENTATION',
          cdnPath: url,
        })),
        displayCategoryCode: Number(mapping.categoryId),
        shippingFee: product.shippingFeeKrw,
        brand: product.brand ?? '',
        ...mapping.extra,
      }

      return { market: MARKET, raw }
    },

    // ───────────────────────────────────────────
    // createProduct
    // ───────────────────────────────────────────
    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      const { accessKey, secretKey } = getCredOrThrow()
      const correlationId = generateCorrelationId()

      if (payload.market !== MARKET) {
        throw new MarketError('validation', `잘못된 payload.market: ${payload.market}`, {
          market: MARKET,
        })
      }

      const path = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products'
      const response = await coupangFetch({
        method: 'POST',
        path,
        accessKey,
        secretKey,
        body: payload.raw,
        correlationId,
      })

      const text = await response.text()

      if (!response.ok) {
        throw httpStatusToMarketError(response.status, text, correlationId)
      }

      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        throw new MarketError('server', '쿠팡 상품 생성 응답 JSON 파싱 실패', {
          market: MARKET,
          status: response.status,
        })
      }

      const parsed = CoupangCreateProductResponseSchema.safeParse(json)
      if (!parsed.success) {
        throw new MarketError('server', '쿠팡 상품 생성 응답 스키마 불일치', {
          market: MARKET,
          cause: parsed.error,
        })
      }

      const data = parsed.data.data
      if (!data?.sellerProductId) {
        throw new MarketError(
          'server',
          `쿠팡 상품 생성 실패: ${parsed.data.message ?? '알 수 없는 오류'}`,
          {
            market: MARKET,
            marketErrorCode: parsed.data.code,
            marketErrorMessage: parsed.data.message,
          },
        )
      }

      const externalId = String(data.sellerProductId)
      const productUrl =
        data.productUrl ?? `https://www.coupang.com/vp/products/${externalId}`

      return {
        market: MARKET,
        externalId,
        productUrl,
        status: 'succeeded',
        warnings: [],
      } as CreateProductResult
    },
  }
}
