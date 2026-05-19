/**
 * 마켓 도메인 공용 타입.
 * Stage C 는 ID 와 라벨만. Stage D 에서 MarketAccount / MarketStatus 등 zod 스키마 도입.
 */

export const MARKET_IDS = ['naver', 'eleventh', 'gmarket', 'auction', 'coupang'] as const

export type MarketId = (typeof MARKET_IDS)[number]

export const MARKET_LABEL: Record<MarketId, string> = {
  naver: '네이버 스마트스토어',
  eleventh: '11번가',
  gmarket: 'G마켓',
  auction: '옥션',
  coupang: '쿠팡',
}
