/**
 * 네이버 스마트스토어 Commerce API real 어댑터 (프론트엔드 / Vite 환경).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9.1
 *   - WIP-5markets-mvp.md C-1 Phase 1
 *
 * 인증 방식: OAuth 2.0 Authorization Code (credential kind = 'oauth').
 *   - authenticate({ kind:'oauth_code', code, codeVerifier?, redirectUri? })
 *       → POST /external/v1/oauth2/token (grant_type=authorization_code)
 *   - refreshToken(refresh)
 *       → POST /external/v1/oauth2/token (grant_type=refresh_token)
 *
 * API 기반 (Naver Commerce API):
 *   - NAVER_API_BASE = https://api.commerce.naver.com
 *   - 토큰 교환:    POST /external/v1/oauth2/token
 *   - 카테고리:     GET  /external/v1/categories  (depth 3 재귀)
 *   - 상품 생성:    POST /external/v1/products
 *
 * 중요 제약:
 *   - accessToken / refreshToken 은 절대 로그에 포함 금지 (호출측 책임).
 *   - 모든 외부 호출에 correlationId 부여 (X-Correlation-Id 헤더).
 *   - 상품명 최대 100자 (네이버 스마트스토어 요건), 초과 시 truncate.
 *   - 카테고리 트리는 depth 3 까지 재귀 fetch (timeout 10s).
 *
 * 현재 제약 (베타):
 *   - 실제 CLIENT_ID / CLIENT_SECRET 미보유. 통합 테스트는 fetch mock 으로.
 *   - 상품 등록 API 최종 payload 스펙 type=SERVICE 자격 확인 + 베타 셀러 검증 후 보정 예정.
 *   - OAuth client 자격증명은 본 어댑터에서 직접 다루지 않음 — Edge Function
 *     `markets-oauth-callback/naver.ts` 에서 client_id / client_secret 주입.
 *     본 어댑터의 authenticate 는 클라이언트 측 silent refresh / 통합 호환용으로
 *     인터페이스 5메서드를 모두 구현하지만, 보안 경로는 Edge Function 이 권위.
 */

import { z } from 'zod'
import { MarketError } from '../../errors'
import type { MarketAdapter } from '../../types'
import {
  OAuthCodeAuthInputSchema,
  TokenSetSchema,
  CategoryNodeSchema,
  CreateProductResultSchema,
  type AuthInput,
  type CategoryNode,
  type CreateProductResult,
  type MarketMapping,
  type MarketPayload,
  type Product,
  type StoredCredential,
  type TokenSet,
} from '@/lib/schemas'

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

export const NAVER_API_BASE = 'https://api.commerce.naver.com'
const MARKET = 'naver' as const
const CATEGORY_TIMEOUT_MS = 10_000
const PRODUCT_NAME_MAX_LENGTH = 100
const DEFAULT_TIMEOUT_MS = 15_000

// ─────────────────────────────────────────────
// 네이버 Commerce API 응답 zod 스키마 (런타임 검증)
// ─────────────────────────────────────────────

/**
 * OAuth 토큰 응답.
 * Naver Commerce API 의 grant_type=authorization_code / refresh_token 응답은
 * RFC 6749 표준 형식을 따른다.
 */
const NaverTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().default('Bearer'),
  scope: z.string().optional(),
})

const NaverCategoryItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  parentId: z.number().nullable(),
  wholeCategoryName: z.string().optional(),
  leaf: z.boolean().optional(),
})
type NaverCategoryItem = z.infer<typeof NaverCategoryItemSchema>

const NaverCategoryListResponseSchema = z.object({
  // Naver Commerce API 의 카테고리 목록 응답은 배열을 직접 반환하거나
  // { data: [...] } 형식으로 감싸 줄 수 있다. 두 형식 모두 수용한다.
  data: z.array(NaverCategoryItemSchema).optional(),
})

const NaverCreateProductResponseSchema = z.object({
  // 응답 본문은 외부 베타 셀러 검증 전까지 다음 best-effort 스키마를 가정한다.
  // Naver Commerce API spec 상 originProductNo 가 외부 상품 ID 역할.
  originProductNo: z.union([z.string(), z.number()]).optional(),
  // 일부 응답은 nested 객체 — productNo 도 동등 의미로 사용 가능.
  productNo: z.union([z.string(), z.number()]).optional(),
  // 오류 시 message 만 들어올 수 있음.
  message: z.string().optional(),
  code: z.string().optional(),
})

// ─────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────

/**
 * 공통 fetch wrapper.
 *  - timeout abort.
 *  - HTTP 에러 → MarketError 변환.
 *  - 토큰 / 비밀키는 헤더에만 부여, 로그 금지.
 */
async function naverFetch(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  accessToken?: string
  body?: unknown
  bodyForm?: URLSearchParams
  correlationId: string
  timeoutMs?: number
}): Promise<Response> {
  const {
    method,
    path,
    accessToken,
    body,
    bodyForm,
    correlationId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  const controller = new AbortController()
  const timerId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  const headers: Record<string, string> = {
    'X-Correlation-Id': correlationId,
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  let bodyInit: BodyInit | null = null
  if (bodyForm) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
    bodyInit = bodyForm.toString()
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json;charset=UTF-8'
    bodyInit = JSON.stringify(body)
  }

  try {
    const response = await fetch(`${NAVER_API_BASE}${path}`, {
      method,
      headers,
      body: bodyInit,
      signal: controller.signal,
    })
    return response
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketError('network', '네이버 API 요청 timeout', {
        market: MARKET,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    throw new MarketError('network', '네이버 API 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }
}

/**
 * HTTP 상태 → MarketError code 매핑.
 */
function httpStatusToMarketError(
  status: number,
  message: string,
  correlationId: string,
): MarketError {
  if (status === 401 || status === 403) {
    return new MarketError('unauthorized', `네이버 인증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 400 || status === 422) {
    return new MarketError(
      'validation',
      `네이버 요청 검증 실패 (${status}): ${message}`,
      {
        market: MARKET,
        status,
        marketErrorMessage: message,
        marketErrorCode: String(status),
      },
    )
  }
  if (status === 429) {
    return new MarketError('rate_limit', '네이버 API rate limit 초과', {
      market: MARKET,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError('server', `네이버 서버 오류 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  return new MarketError(
    'unknown',
    `네이버 API 오류 (${status}) correlationId=${correlationId}`,
    {
      market: MARKET,
      status,
      marketErrorMessage: message,
    },
  )
}

/**
 * Naver token 응답 → TokenSet (expiresAt = now + expires_in*1000).
 * `now` 는 결정성을 위해 호출자가 주입 가능.
 */
export function naverTokenResponseToTokenSet(
  raw: unknown,
  opts: { now?: Date } = {},
): TokenSet {
  const parsed = NaverTokenResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new MarketError('server', '네이버 토큰 응답 스키마 불일치', {
      market: MARKET,
      cause: parsed.error,
    })
  }
  const now = opts.now ?? new Date()
  const expiresAtMs = now.getTime() + parsed.data.expires_in * 1000
  const expiresAt = new Date(expiresAtMs).toISOString()
  // TokenSet 스키마는 datetime + offset 을 요구 (예: ...+00:00).
  // toISOString() 은 `Z` 로 끝나므로 `+00:00` 으로 정규화.
  const expiresAtOffset = expiresAt.replace(/Z$/, '+00:00')

  return TokenSetSchema.parse({
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresAt: expiresAtOffset,
    tokenType: 'Bearer',
    ...(parsed.data.scope !== undefined ? { scope: parsed.data.scope } : {}),
  })
}

// ─────────────────────────────────────────────
// 어댑터 구현
// ─────────────────────────────────────────────

/**
 * OAuth 자격증명 (인스턴스 메모리, 외부 노출 금지).
 */
interface OauthCred {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

function createNaverRealAdapter(): MarketAdapter {
  let cred: OauthCred | null = null

  function getCredOrThrow(): OauthCred {
    if (!cred) {
      throw new MarketError(
        'unauthorized',
        '네이버 어댑터: authenticate 를 먼저 호출해주세요',
        { market: MARKET },
      )
    }
    return cred
  }

  const adapter: MarketAdapter = {
    market: MARKET,
    credentialKind: 'oauth',

    // ───────────────────────────────────────────
    // authenticate — OAuth code → token exchange
    //
    // 주의: 본 메서드는 FE 호환 / silent-refresh 시나리오용. 실제 운영
    // OAuth code exchange 는 Edge Function `markets-oauth-callback/naver.ts`
    // 가 client_id / client_secret 을 주입하여 처리한다 (FE 에 client secret
    // 노출 금지). FE 에서 호출 시에는 별도 token exchange proxy 가 필요하며,
    // 본 스텁은 인터페이스 호환을 위해 5메서드를 모두 구현한다.
    // ───────────────────────────────────────────
    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (input.kind !== 'oauth_code') {
        throw new MarketError(
          'validation',
          `네이버: oauth_code 입력 필요 (받은 kind: ${input.kind})`,
          { market: MARKET },
        )
      }

      const parsed = OAuthCodeAuthInputSchema.safeParse(input)
      if (!parsed.success) {
        throw new MarketError(
          'validation',
          `네이버: 자격증명 형식 오류 — ${parsed.error.message}`,
          { market: MARKET, cause: parsed.error },
        )
      }

      // FE 어댑터는 보안상 client secret 을 가질 수 없으므로 직접 token endpoint
      // 호출은 의도적으로 차단한다. real 환경에서는 Edge Function 가
      // StoredCredential 을 만들어 반환하고 본 메서드는 호출되지 않아야 한다.
      throw new MarketError(
        'unknown',
        '네이버 OAuth code exchange 는 Edge Function markets-oauth-callback 가 처리합니다 — FE 직접 호출 금지',
        { market: MARKET, marketErrorCode: 'fe_exchange_not_allowed' },
      )
    },

    // ───────────────────────────────────────────
    // refreshToken — refresh_token grant
    //
    // 클라이언트 silent refresh 진입점. FE 에서 client secret 을 가질 수 없으므로
    // 실 운영 환경에서는 Edge Function `markets-token-refresh-cron` (또는
    // markets-token-refresh on_demand) 를 invoke 하는 것이 표준이다. 본 메서드는
    // 어댑터 인터페이스 호환을 위해 구현되어 있으며, 호출 시점에 fetch mock /
    // proxy 가 주입된 환경 (단위 테스트, Edge Function 어댑터 미러 사용) 에서만
    // 직접 동작한다.
    // ───────────────────────────────────────────
    async refreshToken(refresh: string): Promise<TokenSet> {
      if (!refresh || refresh.length === 0) {
        throw new MarketError('validation', '네이버 refreshToken 필수', {
          market: MARKET,
        })
      }
      const correlationId = crypto.randomUUID()

      const form = new URLSearchParams()
      form.set('grant_type', 'refresh_token')
      form.set('refresh_token', refresh)

      const response = await naverFetch({
        method: 'POST',
        path: '/external/v1/oauth2/token',
        bodyForm: form,
        correlationId,
      })

      const text = await response.text()
      if (!response.ok) {
        // 401/403 → unauthorized (refresh token 만료 / 무효)
        throw httpStatusToMarketError(response.status, text, correlationId)
      }

      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        throw new MarketError('server', '네이버 토큰 응답 JSON 파싱 실패', {
          market: MARKET,
          status: response.status,
        })
      }

      const tokenSet = naverTokenResponseToTokenSet(json)
      // 인스턴스 cred 갱신 (rotation 토큰 반영).
      cred = {
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        expiresAt: tokenSet.expiresAt,
      }
      return tokenSet
    },

    // ───────────────────────────────────────────
    // fetchCategoryTree — depth 3 재귀
    //
    // 네이버 Commerce API 의 GET /external/v1/categories 는 전체 목록을 평탄한
    // 배열로 반환 (parentId 로 부모 관계 표현). 본 메서드는 그 평탄 배열을
    // depth 3 트리 구조로 재구성한다.
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const { accessToken } = getCredOrThrow()
      const correlationId = crypto.randomUUID()

      const response = await naverFetch({
        method: 'GET',
        path: '/external/v1/categories',
        accessToken,
        correlationId,
        timeoutMs: CATEGORY_TIMEOUT_MS,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw httpStatusToMarketError(response.status, text, correlationId)
      }

      const raw = await response.json().catch(() => null)
      // 응답이 배열 자체이거나 { data: [...] } 형식일 수 있다.
      const items = Array.isArray(raw)
        ? raw
        : NaverCategoryListResponseSchema.safeParse(raw).data?.data
      if (!items) {
        throw new MarketError('server', '네이버 카테고리 응답 파싱 실패', {
          market: MARKET,
        })
      }

      // parentId == null 인 항목 = depth 1 (루트).
      // 각 노드의 children 은 동일 배열에서 parentId == node.id 인 것들.
      // depth 3 까지만 children 채움 (그 이상은 leaf=true 강제).
      const itemsTyped = items as NaverCategoryItem[]
      const byParent = new Map<number | null, NaverCategoryItem[]>()
      for (const it of itemsTyped) {
        const parent = it.parentId ?? null
        const arr = byParent.get(parent) ?? []
        arr.push(it)
        byParent.set(parent, arr)
      }

      function build(item: NaverCategoryItem, depth: number): CategoryNode {
        const children: CategoryNode[] = []
        if (depth < 3) {
          const subs = byParent.get(item.id) ?? []
          for (const sub of subs) {
            children.push(build(sub, depth + 1))
          }
        }
        const leaf = item.leaf ?? (depth >= 3 || children.length === 0)
        const node: CategoryNode = {
          id: String(item.id),
          name: item.name,
          depth,
          leaf,
          parentId: item.parentId !== null ? String(item.parentId) : null,
          children,
        }
        return CategoryNodeSchema.parse(node)
      }

      const roots = byParent.get(null) ?? []
      return roots.map((r) => build(r, 1))
    },

    // ───────────────────────────────────────────
    // transformProduct — 순수 함수.
    // ───────────────────────────────────────────
    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      // 상품명 100자 제한 (스마트스토어 요건)
      const truncatedName =
        product.name.length > PRODUCT_NAME_MAX_LENGTH
          ? product.name.slice(0, PRODUCT_NAME_MAX_LENGTH)
          : product.name

      // Naver Commerce API 상품 생성 payload (베타 가정, 베타 셀러 검증 후 보정)
      const raw = {
        originProduct: {
          name: truncatedName,
          // 가격 (원 단위)
          salePrice: product.priceKrw,
          stockQuantity: product.stock,
          // 카테고리 ID (Naver Commerce API: leafCategoryId)
          leafCategoryId: mapping.categoryId,
          // 대표 이미지 URL (order 순)
          images: {
            representativeImage: {
              url: mapping.transformedImageUrls[0] ?? '',
            },
            optionalImages: mapping.transformedImageUrls.slice(1).map((url) => ({
              url,
            })),
          },
          // 배송 정보 (스마트스토어 표준 payment.fee)
          deliveryInfo: {
            deliveryFee: {
              deliveryFeeType: product.shippingFeeKrw === 0 ? 'FREE' : 'PAID',
              baseFee: product.shippingFeeKrw,
            },
          },
          // 브랜드 (optional)
          brandName: product.brand ?? '',
          // 상세 설명 HTML
          detailContent: product.descriptionHtml,
        },
        // 추가 매핑 필드 (마켓별 extra)
        ...mapping.extra,
      }

      return {
        market: MARKET,
        raw,
      }
    },

    // ───────────────────────────────────────────
    // createProduct — Naver Commerce API POST /external/v1/products
    // ───────────────────────────────────────────
    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      const { accessToken } = getCredOrThrow()
      const correlationId = crypto.randomUUID()

      if (payload.market !== MARKET) {
        throw new MarketError(
          'validation',
          `잘못된 payload.market: ${payload.market}`,
          { market: MARKET },
        )
      }

      const response = await naverFetch({
        method: 'POST',
        path: '/external/v1/products',
        accessToken,
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
        throw new MarketError(
          'server',
          '네이버 상품 생성 응답 JSON 파싱 실패',
          {
            market: MARKET,
            status: response.status,
          },
        )
      }

      const parsed = NaverCreateProductResponseSchema.safeParse(json)
      if (!parsed.success) {
        throw new MarketError(
          'server',
          '네이버 상품 생성 응답 스키마 불일치',
          { market: MARKET, cause: parsed.error },
        )
      }

      const id = parsed.data.originProductNo ?? parsed.data.productNo
      if (id === undefined || id === null) {
        throw new MarketError(
          'server',
          `네이버 상품 생성 실패: ${parsed.data.message ?? '알 수 없는 오류'}`,
          {
            market: MARKET,
            ...(parsed.data.code !== undefined
              ? { marketErrorCode: parsed.data.code }
              : {}),
            ...(parsed.data.message !== undefined
              ? { marketErrorMessage: parsed.data.message }
              : {}),
          },
        )
      }

      const externalId = String(id)
      const productUrl = `https://smartstore.naver.com/products/${externalId}`

      return CreateProductResultSchema.parse({
        market: MARKET,
        externalId,
        productUrl,
        status: 'succeeded',
        warnings: [],
      })
    },
  }

  return adapter
}

export const naverRealAdapter: MarketAdapter = createNaverRealAdapter()

/**
 * 단위 테스트에서 fresh 인스턴스가 필요할 때만 사용.
 * 운영 코드는 위 singleton 을 사용한다.
 */
export const __createNaverRealAdapterForTest = createNaverRealAdapter
