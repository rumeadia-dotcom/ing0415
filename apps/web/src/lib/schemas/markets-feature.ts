import { z } from 'zod'
import { MarketIdSchema } from './common'

/**
 * 마켓 계정 도메인 zod 스키마.
 * 마스터: docs/architecture/v1/features/markets.md §6
 *
 * v1 정식 라인업 (5마켓 전부 real 어댑터 동작):
 *   - oauth   = 'naver'                       — markets-oauth-start / markets-oauth-callback
 *   - hmac    = 'coupang'                     — markets-connect (kind='hmac_key')
 *   - esm_jwt = 'gmarket','auction'           — markets-connect (kind='esm_jwt')
 *   - api_key = '11st'                        — markets-connect (kind='api_key'). 11번가 Open
 *     API 카테고리 ping 포함 다른 마켓과 동일 흐름.
 */

/** OAuth 방식 = 네이버만. markets-oauth-start / callback 의 market enum. */
const V1OAuthMarketSchema = z.enum(['naver'])

/** Key 직접 입력 방식 = 쿠팡 / G마켓 / 옥션 / 11번가. markets-connect 의 market enum. */
const V1KeyConnectMarketSchema = z.enum(['coupang', 'gmarket', 'auction', '11st'])

// ─────────────────────────────────────────────
// MarketAccount (클라이언트 노출 형태)
// ─────────────────────────────────────────────
export const MarketAccountStatusSchema = z.enum([
  'active',
  'expired',
  'revoked',
  'error',
])
export type MarketAccountStatus = z.infer<typeof MarketAccountStatusSchema>

export const MarketAccountSchema = z.object({
  id: z.string().uuid(),
  marketId: MarketIdSchema,
  accountLabel: z.string().min(1).max(40),
  externalAccountId: z.string().nullable(),
  status: MarketAccountStatusSchema,
  connectedAt: z.string().datetime({ offset: true }),
  lastVerifiedAt: z.string().datetime({ offset: true }).nullable(),
  lastErrorCode: z.string().nullable(),
  lastErrorAt: z.string().datetime({ offset: true }).nullable(),
})
export type MarketAccount = z.infer<typeof MarketAccountSchema>

// ─────────────────────────────────────────────
// MarketCatalogEntry — 신규 연결 카드용
// ─────────────────────────────────────────────
export const MarketCatalogEntrySchema = z.object({
  marketId: MarketIdSchema,
  displayName: z.string(),
  shortName: z.string(),
  brandColorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  enabled: z.boolean(),
  comingSoonNote: z.string().nullable(),
})
export type MarketCatalogEntry = z.infer<typeof MarketCatalogEntrySchema>

// ─────────────────────────────────────────────
// OAuth start / callback
// ─────────────────────────────────────────────
export const OAuthStartRequestSchema = z.object({
  market: V1OAuthMarketSchema,
  accountLabel: z.string().min(1).max(40),
  redirectTo: z.string().startsWith('/').max(200),
})
export type OAuthStartRequest = z.infer<typeof OAuthStartRequestSchema>

export const OAuthStartResponseSchema = z.object({
  authorizeUrl: z.string().url(),
  correlationId: z.string().uuid(),
})
export type OAuthStartResponse = z.infer<typeof OAuthStartResponseSchema>

export const OAuthCallbackRequestSchema = z.object({
  market: V1OAuthMarketSchema,
  code: z.string().min(1),
  state: z.string().min(32),
})
export type OAuthCallbackRequest = z.infer<typeof OAuthCallbackRequestSchema>

export const OAuthCallbackResponseSchema = z.object({
  accountId: z.string().uuid(),
  market: V1OAuthMarketSchema,
  accountLabel: z.string(),
  status: z.literal('active'),
  connectedAt: z.string().datetime({ offset: true }),
  redirectTo: z.string(),
  correlationId: z.string().uuid(),
})
export type OAuthCallbackResponse = z.infer<typeof OAuthCallbackResponseSchema>

// ─────────────────────────────────────────────
// Disconnect / Verify
// ─────────────────────────────────────────────
export const DisconnectRequestSchema = z.object({
  accountId: z.string().uuid(),
})
export type DisconnectRequest = z.infer<typeof DisconnectRequestSchema>
export const DisconnectResponseSchema = z.object({
  accountId: z.string().uuid(),
  status: z.literal('revoked'),
  correlationId: z.string().uuid(),
})
export type DisconnectResponse = z.infer<typeof DisconnectResponseSchema>

export const VerifyRequestSchema = z.object({
  accountId: z.string().uuid(),
})
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>
export const VerifyResponseSchema = z.object({
  accountId: z.string().uuid(),
  status: MarketAccountStatusSchema,
  lastVerifiedAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
  /**
   * status='error' / 'expired' / 'revoked' 일 때만 채워짐 (status='active' 시 null).
   *
   * UI 가 마켓 결과 카드에 표시할 구체 메시지의 hint. PR #110 의 markets-connect
   * 에러 세분화 패턴과 정합 — formatMarketError(code, market) 로 한국어 메시지 + prefix.
   *
   * 신설 (2026-05-23): 기존엔 status='error' 만 보여 사용자가 어떤 마켓의 어떤 단계
   * fail 인지 알 수 없었음.
   */
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  errorMarket: z.string().optional(),
})
export type VerifyResponse = z.infer<typeof VerifyResponseSchema>

// ─────────────────────────────────────────────
// ConnectionMethod — 마켓별 신규 연결 방식 (UI 분기 키)
// 마스터: docs/architecture/v1/features/markets.md §3 / §7
// ─────────────────────────────────────────────
export const CONNECTION_METHODS = [
  'oauth',         // 네이버 — markets-oauth-start
  'hmac_form',     // 쿠팡 — markets-connect (HMAC 키 직접 입력)
  'esm_jwt_form',  // G마켓 / 옥션 — markets-connect (ESM JWT 키 직접 입력)
  'api_key_form',  // 11번가 — markets-connect (API Key 직접 입력)
] as const
export const ConnectionMethodSchema = z.enum(CONNECTION_METHODS)
export type ConnectionMethod = z.infer<typeof ConnectionMethodSchema>

// ─────────────────────────────────────────────
// markets-connect (HMAC / ESM JWT 키 직접 입력)
// 마스터: docs/architecture/v1/features/markets.md §5 markets-connect
// ─────────────────────────────────────────────

// 마켓 연결 폼 공용 한국어 에러 메시지 (zod 기본 영어 노출 차단)
const labelMsg = { required_error: '계정 라벨을 입력하세요' }
const labelMin = { message: '계정 라벨을 입력하세요' }
const labelMax = { message: '40자 이내로 입력하세요' }
const keyMin = { message: '키를 입력하세요' }
const keyMax = (n: number) => ({ message: `${n}자 이내로 입력하세요` })

/** 쿠팡 HMAC 키 입력 폼. RHF + zod resolver 직접 사용. */
export const HmacConnectFormSchema = z.object({
  market: z.literal('coupang'),
  accountLabel: z.string(labelMsg).min(1, labelMin).max(40, labelMax),
  accessKey: z.string().min(1, keyMin).max(200, keyMax(200)),
  secretKey: z.string().min(1, keyMin).max(200, keyMax(200)),
  vendorId: z.string().min(1, keyMin).max(40, keyMax(40)),
})
export type HmacConnectForm = z.infer<typeof HmacConnectFormSchema>

/** G마켓·옥션 ESM JWT 키 입력 폼. site 는 market 으로부터 도출 (UI hidden). */
export const EsmJwtConnectFormSchema = z.object({
  market: z.enum(['gmarket', 'auction']),
  accountLabel: z.string(labelMsg).min(1, labelMin).max(40, labelMax),
  masterId: z.string().min(1, keyMin).max(80, keyMax(80)),
  secretKey: z.string().min(1, keyMin).max(200, keyMax(200)),
  sellerId: z.string().min(1, keyMin).max(80, keyMax(80)),
})
export type EsmJwtConnectForm = z.infer<typeof EsmJwtConnectFormSchema>

/** 11번가 API Key 입력 폼. 영구 키 — refresh 없음. */
export const ApiKeyConnectFormSchema = z.object({
  market: z.literal('11st'),
  accountLabel: z.string(labelMsg).min(1, labelMin).max(40, labelMax),
  apiKey: z.string().min(1, keyMin).max(200, keyMax(200)),
})
export type ApiKeyConnectForm = z.infer<typeof ApiKeyConnectFormSchema>

/**
 * markets-connect Edge Function Request — 서버 (apps/api/supabase/functions/markets-connect/index.ts)
 * 의 RequestSchema 와 정합. `credentials` 안에 kind 별 union.
 *
 * 폼 입력 (HmacConnectForm / EsmJwtConnectForm) → 본 형식 변환은 toConnectRequest() 사용.
 */
const HmacKeyCredentialSchema = z.object({
  kind: z.literal('hmac_key'),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  vendorId: z.string().min(1),
})
const EsmJwtCredentialSchema = z.object({
  kind: z.literal('esm_jwt'),
  masterId: z.string().min(1),
  secretKey: z.string().min(1),
  sellerId: z.string().min(1),
  site: z.enum(['G', 'A']),
})
const ApiKeyCredentialSchema = z.object({
  kind: z.literal('api_key'),
  apiKey: z.string().min(1),
})
export const ConnectRequestSchema = z.object({
  marketId: V1KeyConnectMarketSchema,
  accountLabel: z.string().min(1).max(40),
  credentials: z.discriminatedUnion('kind', [
    HmacKeyCredentialSchema,
    EsmJwtCredentialSchema,
    ApiKeyCredentialSchema,
  ]),
})
export type ConnectRequest = z.infer<typeof ConnectRequestSchema>

/**
 * 폼 데이터 → markets-connect Edge Function payload.
 *
 *  - 쿠팡: HmacConnectForm   → credentials.kind = 'hmac_key'
 *  - G마켓: EsmJwtConnectForm  → credentials.kind = 'esm_jwt', site = 'G'
 *  - 옥션: EsmJwtConnectForm  → credentials.kind = 'esm_jwt', site = 'A'
 *  - 11번가: ApiKeyConnectForm → credentials.kind = 'api_key'
 */
export function toConnectRequest(
  form: HmacConnectForm | EsmJwtConnectForm | ApiKeyConnectForm,
): ConnectRequest {
  if (form.market === 'coupang') {
    return {
      marketId: 'coupang',
      accountLabel: form.accountLabel,
      credentials: {
        kind: 'hmac_key',
        accessKey: form.accessKey,
        secretKey: form.secretKey,
        vendorId: form.vendorId,
      },
    }
  }
  if (form.market === '11st') {
    return {
      marketId: '11st',
      accountLabel: form.accountLabel,
      credentials: {
        kind: 'api_key',
        apiKey: form.apiKey,
      },
    }
  }
  return {
    marketId: form.market,
    accountLabel: form.accountLabel,
    credentials: {
      kind: 'esm_jwt',
      masterId: form.masterId,
      secretKey: form.secretKey,
      sellerId: form.sellerId,
      site: form.market === 'gmarket' ? 'G' : 'A',
    },
  }
}

export const ConnectResponseSchema = z.object({
  accountId: z.string().uuid(),
  market: V1KeyConnectMarketSchema,
  accountLabel: z.string(),
  status: z.literal('active'),
  connectedAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
})
export type ConnectResponse = z.infer<typeof ConnectResponseSchema>

// ─────────────────────────────────────────────
// 공통 에러 응답
// ─────────────────────────────────────────────
//
// 서버 (apps/api/.../_shared/http.ts:err) 는 body 에 { code, message, details? }
// 를 담고 correlationId 는 응답 헤더 (x-correlation-id) 로 전달한다.
// 따라서 client schema 의 correlationId 는 optional — 클라이언트가 헤더에서
// 별도로 가져오거나 randomUUID 로 폴백한다 (MarketApiInvocationError).
//
// details 는 Edge Function 측에서 stage / market / reason 등 마켓 컨텍스트를
// 담아 보낸다. UI 가 마켓별 prefix · 단계별 안내 메시지에 사용.
export const MarketApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string().uuid().optional(),
  details: z
    .object({
      stage: z
      .enum([
        'authenticate',
        'category_ping',
        'vault',
        'account',
        'account_lookup',
        'vault_revoke',
        'account_revoke',
      ])
      .optional(),
      market: z.string().optional(),
      reason: z.string().optional(),
    })
    .passthrough()
    .optional(),
})
export type MarketApiError = z.infer<typeof MarketApiErrorSchema>
