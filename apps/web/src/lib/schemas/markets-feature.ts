import { z } from 'zod'
import { MarketIdSchema } from './common'

/**
 * 마켓 계정 도메인 zod 스키마.
 * 마스터: docs/architecture/v1/features/markets.md §6
 *
 * v1 정식 라인업 (2026-05-19 Wave 1 재결정):
 *   - oauth   = 'naver'             — markets-oauth-start / markets-oauth-callback
 *   - hmac    = 'coupang'           — markets-connect (kind='hmac_key')
 *   - esm_jwt = 'gmarket','auction' — markets-connect (kind='esm_jwt')
 *   - 11st = disabled (오픈 준비중, IP 화이트리스트 미해결)
 */

/** OAuth 방식 = 네이버만. markets-oauth-start / callback 의 market enum. */
const V1OAuthMarketSchema = z.enum(['naver'])

/** Key 직접 입력 방식 = 쿠팡 / G마켓 / 옥션. markets-connect 의 market enum. */
const V1KeyConnectMarketSchema = z.enum(['coupang', 'gmarket', 'auction'])

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
  'disabled',      // 11번가 — 오픈 준비중
] as const
export const ConnectionMethodSchema = z.enum(CONNECTION_METHODS)
export type ConnectionMethod = z.infer<typeof ConnectionMethodSchema>

// ─────────────────────────────────────────────
// markets-connect (HMAC / ESM JWT 키 직접 입력)
// 마스터: docs/architecture/v1/features/markets.md §5 markets-connect
// ─────────────────────────────────────────────

/** 쿠팡 HMAC 키 입력 폼. RHF + zod resolver 직접 사용. */
export const HmacConnectFormSchema = z.object({
  market: z.literal('coupang'),
  accountLabel: z.string().min(1).max(40),
  accessKey: z.string().min(1).max(200),
  secretKey: z.string().min(1).max(200),
  vendorId: z.string().min(1).max(40),
})
export type HmacConnectForm = z.infer<typeof HmacConnectFormSchema>

/** G마켓·옥션 ESM JWT 키 입력 폼. site 는 market 으로부터 도출 (UI hidden). */
export const EsmJwtConnectFormSchema = z.object({
  market: z.enum(['gmarket', 'auction']),
  accountLabel: z.string().min(1).max(40),
  masterId: z.string().min(1).max(80),
  secretKey: z.string().min(1).max(200),
  sellerId: z.string().min(1).max(80),
})
export type EsmJwtConnectForm = z.infer<typeof EsmJwtConnectFormSchema>

/** markets-connect Edge Function Request — 폼 두 종을 union 으로 통합. */
export const ConnectRequestSchema = z.discriminatedUnion('market', [
  HmacConnectFormSchema,
  z.object({
    market: z.literal('gmarket'),
    accountLabel: z.string().min(1).max(40),
    masterId: z.string().min(1).max(80),
    secretKey: z.string().min(1).max(200),
    sellerId: z.string().min(1).max(80),
  }),
  z.object({
    market: z.literal('auction'),
    accountLabel: z.string().min(1).max(40),
    masterId: z.string().min(1).max(80),
    secretKey: z.string().min(1).max(200),
    sellerId: z.string().min(1).max(80),
  }),
])
export type ConnectRequest = z.infer<typeof ConnectRequestSchema>

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
export const MarketApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string().uuid(),
})
export type MarketApiError = z.infer<typeof MarketApiErrorSchema>
