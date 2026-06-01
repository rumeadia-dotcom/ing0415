import { z } from 'zod'

/**
 * 공용 primitive zod 스키마.
 * 다른 schemas 파일에서 이 모듈만 import 하고, 역방향 import 금지 (순환 의존성 회피).
 *
 * 마스터:
 *  - MARKET_IDS / MarketIdSchema = market-adapter.md §2.2 / features/history.md §3.4
 */

// ─────────────────────────────────────────────
// MarketId
// ─────────────────────────────────────────────
export const MARKET_IDS = ['naver', 'coupang', '11st', 'gmarket', 'auction'] as const

export const MarketIdSchema = z.enum(MARKET_IDS)
export type MarketId = z.infer<typeof MarketIdSchema>

// ─────────────────────────────────────────────
// 식별자 / 시간 / 통화
// ─────────────────────────────────────────────
export const UuidSchema = z.string().uuid()

/** ISO 8601 + offset (예: 2026-05-19T03:00:00+09:00). markets / market-adapter / dashboard / history 표준. */
export const IsoDateTimeOffsetSchema = z.string().datetime({ offset: true })

/** ISO 8601 (offset 미요구). auth / registration 도메인에서 사용. */
export const IsoDateTimeSchema = z.string().datetime()

/** 원화 금액 — 음수 불가. */
export const MoneyKrwSchema = z.number().int().nonnegative()

// ─────────────────────────────────────────────
// 배송 방법 ENUM — shipping.ts / shipping-config.ts / registration.ts 공용.
// 역방향 import 방지를 위해 leaf 모듈(common.ts) 에 정의.
// ─────────────────────────────────────────────
export const ShippingMethodSchema = z.enum([
  'parcel',
  'direct',
  'quick',
  'visit_pickup',
])
export type ShippingMethod = z.infer<typeof ShippingMethodSchema>
