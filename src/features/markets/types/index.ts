/**
 * 마켓 도메인 공용 타입.
 * Stage C 는 ID 와 라벨만. Stage D 에서 MarketAccount / MarketStatus 등 zod 스키마 도입.
 *
 * v1 활성 마켓 (2026-05-19 결정 — OQ-10):
 *  - naver: ready
 *  - coupang | 11st | gmarket | auction: coming_soon (오픈 준비중)
 *    (쿠팡은 HMAC 인증으로 v2 어댑터 인터페이스 확장 후 통합)
 */

export const MARKET_IDS = ['naver', '11st', 'gmarket', 'auction', 'coupang'] as const

export type MarketId = (typeof MARKET_IDS)[number]

export type MarketStatus = 'ready' | 'coming_soon'

export interface MarketCatalogEntry {
  readonly label: string
  readonly status: MarketStatus
}

export const MARKET_CATALOG = {
  naver: { label: '네이버 스마트스토어', status: 'ready' as const },
  coupang: { label: '쿠팡', status: 'coming_soon' as const },
  '11st': { label: '11번가', status: 'coming_soon' as const },
  gmarket: { label: 'G마켓', status: 'coming_soon' as const },
  auction: { label: '옥션', status: 'coming_soon' as const },
} as const satisfies Record<MarketId, MarketCatalogEntry>

/** 기존 사용처 호환용 label 맵 (MARKET_CATALOG.<id>.label 로 단계적 마이그레이션). */
export const MARKET_LABEL: Record<MarketId, string> = {
  naver: MARKET_CATALOG.naver.label,
  coupang: MARKET_CATALOG.coupang.label,
  '11st': MARKET_CATALOG['11st'].label,
  gmarket: MARKET_CATALOG.gmarket.label,
  auction: MARKET_CATALOG.auction.label,
}
