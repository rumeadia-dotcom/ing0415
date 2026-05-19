import { z } from 'zod'
import { MarketIdSchema } from './common'

/**
 * 마켓 계정 도메인 zod 스키마.
 * 마스터: docs/architecture/v1/features/markets.md §6
 *
 * v1 OAuth start/callback 은 'naver' | 'coupang' 만 허용. 11st/gmarket/auction 은
 * 카탈로그 노출은 가능하나 enabled=false.
 */

const V1OAuthMarketSchema = z.enum(['naver', 'coupang'])

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
export const DisconnectResponseSchema = z.object({
  accountId: z.string().uuid(),
  status: z.literal('revoked'),
  correlationId: z.string().uuid(),
})

export const VerifyRequestSchema = z.object({
  accountId: z.string().uuid(),
})
export const VerifyResponseSchema = z.object({
  accountId: z.string().uuid(),
  status: MarketAccountStatusSchema,
  lastVerifiedAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
})

// ─────────────────────────────────────────────
// 공통 에러 응답
// ─────────────────────────────────────────────
export const MarketApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string().uuid(),
})
export type MarketApiError = z.infer<typeof MarketApiErrorSchema>
