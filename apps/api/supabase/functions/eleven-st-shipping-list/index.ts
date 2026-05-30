/**
 * Edge Function: eleven-st-shipping-list
 *
 * 마스터:
 *   - docs/architecture/v1/features/11st.md §3 (Layer 2 — 조회형 확정) / §4.6 / §7 PR-2
 *   - docs/architecture/v1/cross-cutting/shipping-fee-model.md §2 (Layer 2 조회형 단일 표준)
 *   - 11st-api/product/shipping-1014.md (출고지 목록 GET /rest/areaservice/outboundarea)
 *   - 11st-api/product/shipping-1015.md (반품/교환지 목록 GET /rest/areaservice/inboundarea)
 *   - ESM PR-E1 esm-shipping-list/index.ts (동형 패턴 — 조회형 Layer 2)
 *
 * 역할:
 *   11번가 배송 선행값(출고지·반품/교환지)을 "조회"한다. 우리 앱은 생성하지 않고
 *   셀러가 11번가 셀러오피스에서 만든 것을 GET 으로 가져와 정규화 반환한다(ESM/네이버/쿠팡과
 *   동일한 Layer 2 조회형 단일 표준). 상품등록 3단계 카드(MarketOptionsCard)가 select 로 노출.
 *
 * 처리 시퀀스 (POST { marketAccountId } — supabase-js functions.invoke body 규약):
 *   1. authenticated 셀러 JWT 검증 → sellerId
 *   2. body = { marketAccountId } 검증
 *   3. market_account 소유권 검증 (seller_id 일치 + market_id 11st)
 *   4. 11번가 자격증명 복호화(loadCredential, api_key) → openapikey 헤더
 *   5. 두 조회를 Lightsail Gateway 경유로 호출 (멱등 GET → 병렬 안전):
 *        ① GET /rest/areaservice/outboundarea  (1014, 출고지)
 *        ② GET /rest/areaservice/inboundarea    (1015, 반품/교환지)
 *   6. EUC-KR 디코딩 → fast-xml-parser → normalize.ts(stripNsPrefix + PII 차단) → parse → 200
 *
 * 강제 (Backend INTJ 원칙 / CLAUDE.md / 11st.md §3):
 *   - 모든 11번가 호출은 gatewayFetch 경유 (raw fetch 금지). timeout 명시. 조회는 멱등 → 재시도 안전.
 *   - ⚠️ PII 차단: 응답/로그는 addrSeq + addrNm 만. 주소(addr)·이름(rcvrNm)·전화·memNo 는
 *     우리 DB·응답·로그 어디에도 통과 금지. openapikey(API Key) 는 길이도 로그 안 함.
 *   - 우리 DB 에 조회 결과를 저장하지 않는다(조회만 — 호출측이 캐시).
 *   - service_role 정당화: 셀러 JWT 로 ownership 검증 후 자기 계정의 credential 만 사용.
 */

import {
  ElevenStShippingAddressListResponseSchema,
} from '../_shared/schemas.ts'
import {
  HttpErrors,
  MarketError,
  appendAudit,
  getServiceClient,
  getUserClient,
  loadCredential,
  ok,
  parseBody,
  requireBearer,
  withRequest,
  type Logger,
} from '../_shared/index.ts'
import { gatewayFetch } from '../_shared/gatewayFetch.ts'
import {
  buildElevenStInboundAreaUrl,
  buildElevenStOutboundAreaUrl,
} from '../_shared/market-adapters/eleven-st-map.ts'
import {
  classifyElevenStShippingResult,
  normalizeElevenStAddresses,
} from './lib/normalize.ts'

import { XMLParser } from 'npm:fast-xml-parser@4.4.1'
import { z } from 'npm:zod@3.23.8'

const MARKET = '11st' as const
const FETCH_TIMEOUT_MS = 15_000

const RequestSchema = z.object({
  marketAccountId: z.string().uuid(),
})

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
// market_account 소유권 + credential 해석
// ─────────────────────────────────────────────

interface ResolvedAccount {
  credentialId: string
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
  if (data.market_id !== MARKET) {
    throw HttpErrors.badRequest(
      'not_eleven_st_market',
      'market account is not an 11st account',
    )
  }
  if (typeof data.credential_id !== 'string') {
    throw HttpErrors.internal('credential_missing', 'market account has no credential')
  }
  return { credentialId: data.credential_id }
}

// ─────────────────────────────────────────────
// 11번가 단일 GET (gateway 경유 + openapikey 헤더 + EUC-KR/XML 파싱)
//   ⚠️ resource 라벨만 로그 — URL/키/PII 로그 금지.
// ─────────────────────────────────────────────

async function elevenStGet(opts: {
  url: string
  apiKey: string
  resource: 'outbound' | 'return'
  sellerId: string
  correlationId: string
  logger: Logger
}): Promise<Record<string, unknown>> {
  const { url, apiKey, resource, sellerId, correlationId, logger } = opts

  logger.info(
    { market: MARKET, method: 'GET', resource, sellerId, correlationId },
    '→ market request',
  )

  let response: Response
  try {
    response = await gatewayFetch(MARKET, url, {
      correlationId,
      method: 'GET',
      headers: {
        'Content-Type': 'application/xml;charset=EUC-KR',
        openapikey: apiKey,
        'X-Correlation-Id': correlationId,
      },
      timeoutMs: FETCH_TIMEOUT_MS,
    })
  } catch (e) {
    logger.error(
      {
        market: MARKET,
        resource,
        sellerId,
        correlationId,
        marketErrorCode: e instanceof MarketError ? e.code : 'network',
      },
      '← market error',
    )
    throw HttpErrors.badGateway(
      `eleven_st_${resource}_fetch_failed`,
      `11번가 ${resource} 조회 실패 (네트워크/게이트웨이)`,
    )
  }

  const buf = await response.arrayBuffer().catch(() => new ArrayBuffer(0))
  logger.info(
    { market: MARKET, resource, status: response.status, correlationId },
    '← market response',
  )

  if (!response.ok) {
    throw HttpErrors.badGateway(
      `eleven_st_${resource}_http_${response.status}`,
      `11번가 ${resource} 응답 ${response.status}`,
    )
  }

  const text = decodeElevenStBody(buf)
  if (text.length === 0) return {}
  try {
    const parsed = xmlParser.parse(text) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    throw HttpErrors.badGateway(
      `eleven_st_${resource}_invalid_xml`,
      `11번가 ${resource} 응답이 XML 이 아님`,
    )
  }
}

// ─────────────────────────────────────────────
// Edge Function entry
// ─────────────────────────────────────────────

export default Deno.serve(
  withRequest('eleven-st-shipping-list', async ({ req, logger, correlationId }) => {
    if (req.method !== 'POST') {
      throw HttpErrors.badRequest('method_not_allowed', 'POST required')
    }

    const body = await parseBody(req, RequestSchema)
    const sellerId = await resolveSellerId(req)

    // 1) market_account 소유권 해석.
    const account = await resolveMarketAccount({
      marketAccountId: body.marketAccountId,
      sellerId,
    })

    // 2) 11번가 자격증명 복호화 → openapikey.
    const cred = await loadCredential({
      credentialId: account.credentialId,
      correlationId,
      logger,
    })
    if (cred.credentialKind !== 'api_key') {
      throw HttpErrors.badRequest(
        'credential_kind_mismatch',
        `expected api_key credential, got ${cred.credentialKind}`,
      )
    }
    const p = cred.payload as { apiKey?: string }
    if (!p.apiKey) {
      throw HttpErrors.internal('credential_malformed', '11번가 credential malformed')
    }

    logger.info(
      { market: MARKET, sellerId, correlationId },
      '→ eleven-st shipping list (outbound + return)',
    )

    // 3) 두 조회 — 출고지(1014) + 반품/교환지(1015). 멱등 GET 이라 병렬 안전.
    const [outboundRaw, returnRaw] = await Promise.all([
      elevenStGet({
        url: buildElevenStOutboundAreaUrl(),
        apiKey: p.apiKey,
        resource: 'outbound',
        sellerId,
        correlationId,
        logger,
      }),
      elevenStGet({
        url: buildElevenStInboundAreaUrl(),
        apiKey: p.apiKey,
        resource: 'return',
        sellerId,
        correlationId,
        logger,
      }),
    ])

    // 3-1) result_message != SUCCESS (자격증명 무효 등) → 502 로 명시 분류 (empty 와 구분).
    //   ⚠️ 11번가 에러 메시지엔 PII 가 섞일 수 있어 message 본문은 로그/응답에 싣지 않는다.
    const outboundCls = classifyElevenStShippingResult(outboundRaw)
    const returnCls = classifyElevenStShippingResult(returnRaw)
    if (outboundCls.kind === 'error' || returnCls.kind === 'error') {
      logger.error(
        { market: MARKET, sellerId, correlationId, resource: 'shipping_list' },
        '← market error (result_message != SUCCESS)',
      )
      throw HttpErrors.badGateway(
        'eleven_st_shipping_lookup_rejected',
        '11번가 출고지/반품지 조회가 거부되었습니다 (자격증명/권한 확인 필요)',
      )
    }

    // 4) 정규화 (PII 차단 — addrSeq + addrNm 만).
    const outbound = normalizeElevenStAddresses(outboundRaw)
    const returnAddrs = normalizeElevenStAddresses(returnRaw)

    const responseBody = ElevenStShippingAddressListResponseSchema.parse({
      outbound,
      returnAddrs,
    })

    await appendAudit({
      category: 'shipping',
      event: 'eleven_st_shipping_list_queried',
      sellerId,
      meta: {
        market: MARKET,
        outboundCount: outbound.length,
        returnCount: returnAddrs.length,
      },
      correlationId,
      logger,
    })

    logger.info(
      {
        market: MARKET,
        sellerId,
        outboundCount: outbound.length,
        returnCount: returnAddrs.length,
        correlationId,
      },
      '← eleven-st shipping list ok',
    )

    return ok(responseBody, { correlationId })
  }),
)
