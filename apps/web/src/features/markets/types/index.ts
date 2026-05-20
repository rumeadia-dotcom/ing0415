/**
 * 마켓 도메인 공용 타입.
 * Stage C 는 ID 와 라벨만. Stage D 에서 MarketAccount / MarketStatus 등 zod 스키마 도입.
 *
 * v1 활성 마켓 (2026-05-19 5마켓 MVP 확장 — markets.md §1):
 *  - naver | coupang | gmarket | auction: ready (4개 활성)
 *  - 11st: coming_soon (Edge Function outbound IP 정책 충돌로 v2 이관, OQ-09)
 *
 * 인증 분기 (markets.md §3 / connect-provider 4-way):
 *  - naver       = OAuth 2.0 redirect
 *  - coupang     = HMAC 키 입력 (accessKey / secretKey / vendorId)
 *  - gmarket     = ESM JWT 폼 (masterId / secretKey / sellerId, site='G')
 *  - auction     = ESM JWT 폼 (masterId / secretKey / sellerId, site='A')
 *  - 11st        = disabled (오픈 준비중)
 */

export const MARKET_IDS = ['naver', '11st', 'gmarket', 'auction', 'coupang'] as const

export type MarketId = (typeof MARKET_IDS)[number]

export type MarketStatus = 'ready' | 'coming_soon'

/** 인증 방식 분기 — connect-provider 페이지 폼 분기 키. */
export type MarketAuthMode = 'oauth' | 'hmac' | 'esm_jwt' | 'disabled'

export interface MarketCatalogEntry {
  readonly label: string
  readonly status: MarketStatus
  readonly authMode: MarketAuthMode
}

export const MARKET_CATALOG = {
  naver: { label: '네이버 스마트스토어', status: 'ready' as const, authMode: 'oauth' as const },
  coupang: { label: '쿠팡', status: 'ready' as const, authMode: 'hmac' as const },
  gmarket: { label: 'G마켓', status: 'ready' as const, authMode: 'esm_jwt' as const },
  auction: { label: '옥션', status: 'ready' as const, authMode: 'esm_jwt' as const },
  '11st': { label: '11번가', status: 'coming_soon' as const, authMode: 'disabled' as const },
} as const satisfies Record<MarketId, MarketCatalogEntry>

/** 기존 사용처 호환용 label 맵 (MARKET_CATALOG.<id>.label 로 단계적 마이그레이션). */
export const MARKET_LABEL: Record<MarketId, string> = {
  naver: MARKET_CATALOG.naver.label,
  coupang: MARKET_CATALOG.coupang.label,
  '11st': MARKET_CATALOG['11st'].label,
  gmarket: MARKET_CATALOG.gmarket.label,
  auction: MARKET_CATALOG.auction.label,
}
