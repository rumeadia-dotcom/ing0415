/**
 * 마켓 도메인 공용 타입.
 *
 * v1 활성 마켓 (2026-05-25 — 11번가 scaffold 포함):
 *  - naver | coupang | gmarket | auction | 11st: ready (5개 활성)
 *
 * 인증 분기 (markets.md §3 / connect-provider 5-way):
 *  - naver       = OAuth 2.0 redirect
 *  - coupang     = HMAC 키 입력 (accessKey / secretKey / vendorId)
 *  - gmarket     = ESM JWT 폼 (masterId / secretKey / sellerId, site='G')
 *  - auction     = ESM JWT 폼 (masterId / secretKey / sellerId, site='A')
 *  - 11st        = API Key 폼 (apiKey 단일 영구 키. real 본격 구현 시까지
 *                  fetchCategoryTree / transformProduct / createProduct 는 spec 미확보로 throw)
 */

export const MARKET_IDS = ['naver', '11st', 'gmarket', 'auction', 'coupang'] as const

export type MarketId = (typeof MARKET_IDS)[number]

export type MarketStatus = 'ready' | 'coming_soon'

/** 인증 방식 분기 — connect-provider 페이지 폼 분기 키. */
export type MarketAuthMode = 'oauth' | 'hmac' | 'esm_jwt' | 'api_key'

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
  '11st': { label: '11번가', status: 'ready' as const, authMode: 'api_key' as const },
} as const satisfies Record<MarketId, MarketCatalogEntry>

/** 기존 사용처 호환용 label 맵 (MARKET_CATALOG.<id>.label 로 단계적 마이그레이션). */
export const MARKET_LABEL: Record<MarketId, string> = {
  naver: MARKET_CATALOG.naver.label,
  coupang: MARKET_CATALOG.coupang.label,
  '11st': MARKET_CATALOG['11st'].label,
  gmarket: MARKET_CATALOG.gmarket.label,
  auction: MARKET_CATALOG.auction.label,
}
