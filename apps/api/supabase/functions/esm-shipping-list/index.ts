/**
 * Edge Function: esm-shipping-list
 *
 * 마스터:
 *   - docs/architecture/v1/features/esm.md "⚠ 전환 결정 (2026-05-30): 생성형 → 조회형" / PR-E1
 *   - docs/architecture/v1/cross-cutting/shipping-fee-model.md §2 (Layer 2 조회형 단일 표준)
 *   - esm-api/product/17.md (출하지 전체조회 GET /item/v1/shipping/places → shippingPlaces[])
 *   - esm-api/product/19.md (발송정책 전체조회 GET /item/v1/shipping/dispatch-policies)
 *
 * 역할:
 *   ESM(G마켓/옥션) 배송 선행값(출하지·발송정책)을 "조회"한다. 우리 앱은 생성하지 않고
 *   셀러가 ESM Plus 에서 만든 것을 GET 으로 가져와 정규화 반환한다(11번가/네이버/쿠팡과
 *   동일한 Layer 2 조회형 단일 표준). 상품등록 3단계 카드(PR-E2)가 이 결과를 select 로 노출.
 *
 * 처리 시퀀스 (GET ?marketAccountId=...):
 *   1. authenticated 셀러 JWT 검증 → sellerId
 *   2. query = { marketAccountId } 검증
 *   3. market_account 소유권 검증 (seller_id 일치 + market_id gmarket/auction) → site('G'|'A')
 *   4. ESM 자격증명 복호화(loadCredential, esm_jwt) → site 토큰 JWT 발급
 *   5. 두 조회를 Lightsail Gateway 경유로 호출:
 *        ① GET /item/v1/shipping/places            → shippingPlaces[] (공통, 마스터 ID 하위)
 *        ② GET /item/v1/shipping/dispatch-policies  → dispatchPolicies[] (사이트별 — 계정 site 분)
 *   6. raw → normalize.ts 정규화 → EsmShippingListResponseSchema parse → 200
 *
 * 강제 (Backend INTJ 원칙 / CLAUDE.md):
 *   - 모든 ESM 호출은 gatewayFetch 경유 (raw fetch 금지). timeout 명시. 조회는 멱등 → 재시도 안전.
 *   - 토큰 / secretKey / masterId / PII(주소·연락처)는 로그 절대 금지. sellerId(UUID) / 개수만.
 *   - 발송정책은 사이트별 — 계정 site 의 토큰으로 조회하고 결과를 그 site 로 태깅한다
 *     (한 market_account 는 한 사이트 — gmarket/auction 별도 마켓).
 *   - 우리 DB 에 조회 결과를 저장하지 않는다(조회만 — 호출측이 24h 캐시).
 *   - service_role 정당화: 셀러 JWT 로 ownership 검증 후 자기 계정의 credential 만 사용.
 *     credential 평문은 본 함수 메모리에만, 응답/로그로 노출 안 됨.
 */

import {
  EsmShippingListResponseSchema,
  type EsmProfileSite,
} from '../_shared/schemas.ts'
import {
  HttpErrors,
  MarketError,
  appendAudit,
  getServiceClient,
  getUserClient,
  loadCredential,
  ok,
  parseQuery,
  requireBearer,
  withRequest,
  type Logger,
} from '../_shared/index.ts'
import { gatewayFetch } from '../_shared/gatewayFetch.ts'
import { buildEsmJwt } from '../_shared/market-adapters/esm-jwt.ts'
import {
  normalizeDispatchPolicies,
  normalizeShippingPlaces,
} from './lib/normalize.ts'

import { z } from 'npm:zod@3.23.8'

const ESM_API_BASE = 'https://sa2.esmplus.com/item/v1'
const FETCH_TIMEOUT_MS = 15_000

// market_id ↔ site. gmarket/auction 만 ESM.
const SITE_BY_MARKET: Record<string, EsmProfileSite> = {
  gmarket: 'G',
  auction: 'A',
}

const QuerySchema = z.object({
  marketAccountId: z.string().uuid(),
})

// ─────────────────────────────────────────────
// 셀러 JWT → sellerId
// ─────────────────────────────────────────────

async function resolveSellerId(req: Request): Promise<string> {
  const token = requireBearer(req)
  const supabase = getUserClient(token)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
  }
  return data.user.id
}

// ─────────────────────────────────────────────
// market_account 소유권 + site + credential 해석
// ─────────────────────────────────────────────

interface ResolvedAccount {
  marketId: string
  credentialId: string
  site: EsmProfileSite
}

async function resolveMarketAccount(opts: {
  marketAccountId: string
  sellerId: string
}): Promise<ResolvedAccount> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('market_accounts')
    .select('id, seller_id, market_id, credential_id, status')
    .eq('id', opts.marketAccountId)
    .maybeSingle()

  if (error || !data) {
    throw HttpErrors.notFound('market_account_not_found', 'market account not found')
  }
  // ownership — 타 셀러 계정 조회 금지.
  if (data.seller_id !== opts.sellerId) {
    throw HttpErrors.forbidden('forbidden', 'not your market account')
  }
  const site = SITE_BY_MARKET[data.market_id as string]
  if (!site) {
    throw HttpErrors.badRequest(
      'not_esm_market',
      'market account is not an ESM (gmarket/auction) account',
    )
  }
  if (typeof data.credential_id !== 'string') {
    throw HttpErrors.internal('credential_missing', 'market account has no credential')
  }
  return {
    marketId: data.market_id as string,
    credentialId: data.credential_id,
    site,
  }
}

// ─────────────────────────────────────────────
// ESM 단일 GET (gateway 경유 + JWT Bearer + 본문 텍스트 반환)
// ─────────────────────────────────────────────

async function esmGet(opts: {
  market: string
  path: string
  token: string
  resource: string
  sellerId: string
  correlationId: string
  logger: Logger
}): Promise<unknown> {
  const { market, path, token, resource, sellerId, correlationId, logger } = opts
  const url = `${ESM_API_BASE}${path}`

  logger.info(
    { market, method: 'GET', resource, url: path, sellerId, correlationId },
    '→ market request',
  )

  let response: Response
  try {
    response = await gatewayFetch(market, url, {
      correlationId,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Correlation-Id': correlationId,
      },
      timeoutMs: FETCH_TIMEOUT_MS,
    })
  } catch (e) {
    logger.error(
      {
        market,
        resource,
        sellerId,
        correlationId,
        marketErrorCode: e instanceof MarketError ? e.code : 'network',
      },
      '← market error',
    )
    throw HttpErrors.badGateway(
      `esm_${resource}_fetch_failed`,
      `ESM ${resource} 조회 실패 (네트워크/게이트웨이)`,
    )
  }

  const text = await response.text().catch(() => '')
  logger.info(
    { market, resource, status: response.status, correlationId },
    '← market response',
  )

  if (!response.ok) {
    throw HttpErrors.badGateway(
      `esm_${resource}_http_${response.status}`,
      `ESM ${resource} 응답 ${response.status}`,
    )
  }

  if (text.length === 0) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw HttpErrors.badGateway(
      `esm_${resource}_invalid_json`,
      `ESM ${resource} 응답이 JSON 이 아님`,
    )
  }
}

// ─────────────────────────────────────────────
// Edge Function entry
// ─────────────────────────────────────────────

export default Deno.serve(
  withRequest('esm-shipping-list', async ({ req, logger, correlationId }) => {
    if (req.method !== 'GET') {
      throw HttpErrors.badRequest('method_not_allowed', 'GET required')
    }

    const query = parseQuery(req, QuerySchema)
    const sellerId = await resolveSellerId(req)

    // 1) market_account 소유권 + site 해석.
    const account = await resolveMarketAccount({
      marketAccountId: query.marketAccountId,
      sellerId,
    })
    const market = account.marketId // 'gmarket' | 'auction'
    const site = account.site

    // 2) ESM 자격증명 복호화 → site 토큰 JWT.
    const cred = await loadCredential({
      credentialId: account.credentialId,
      correlationId,
      logger,
    })
    if (cred.credentialKind !== 'esm_jwt') {
      throw HttpErrors.badRequest(
        'credential_kind_mismatch',
        `expected esm_jwt credential, got ${cred.credentialKind}`,
      )
    }
    const p = cred.payload as {
      masterId?: string
      secretKey?: string
      sellerId?: string
    }
    if (!p.masterId || !p.secretKey) {
      throw HttpErrors.internal('credential_malformed', 'ESM credential malformed')
    }
    const { token } = await buildEsmJwt({
      masterId: p.masterId,
      secretKey: p.secretKey,
      site,
      sellerId: p.sellerId ?? '',
    })

    logger.info(
      { market, sellerId, site, correlationId },
      '→ esm shipping list (places + dispatch-policies)',
    )

    // 3) 두 조회 — 출하지(공통) + 발송정책(계정 site 분). 멱등 GET 이라 병렬 안전.
    //    각 호출이 자체 correlationId 를 갖되 요청 단위 correlationId 를 prefix 로 잇는다.
    const [placesRaw, dispatchRaw] = await Promise.all([
      esmGet({
        market,
        path: '/shipping/places?pageSize=500&pageIndex=1',
        token,
        resource: 'places',
        sellerId,
        correlationId,
        logger,
      }),
      esmGet({
        market,
        path: '/shipping/dispatch-policies',
        token,
        resource: 'dispatch',
        sellerId,
        correlationId,
        logger,
      }),
    ])

    // 4) 정규화 + site 태깅.
    const places = normalizeShippingPlaces(placesRaw)
    const dispatchPolicies = normalizeDispatchPolicies(dispatchRaw, site)

    const responseBody = EsmShippingListResponseSchema.parse({
      site,
      places,
      dispatchPolicies,
    })

    await appendAudit({
      category: 'shipping',
      event: 'esm_shipping_list_queried',
      sellerId,
      meta: {
        market,
        site,
        placeCount: places.length,
        dispatchPolicyCount: dispatchPolicies.length,
      },
      correlationId,
      logger,
    })

    logger.info(
      {
        market,
        sellerId,
        site,
        placeCount: places.length,
        dispatchPolicyCount: dispatchPolicies.length,
        correlationId,
      },
      '← esm shipping list ok',
    )

    return ok(responseBody, { correlationId })
  }),
)
