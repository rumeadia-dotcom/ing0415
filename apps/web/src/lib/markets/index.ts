import { isDebug } from '@/lib/env'
import type { MarketId } from '@/lib/schemas'
import type { MarketAdapter } from './types'

/**
 * 마켓 어댑터 단일 진입.
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §4.1
 *
 * v1 정식 라인업 (2026-05-19 재결정 — OQ-10 Wave 1):
 *   - naver   (oauth)   : 활성. debug = mock, real = Stage F.
 *   - coupang (hmac)    : 활성. debug = mock, real = Stage F.
 *   - gmarket (esm_jwt) : 활성. debug = mock, real = Stage F.
 *   - auction (esm_jwt) : 활성. debug = mock, real = Stage F.
 *   - 11st    (api_key) : "오픈 준비중" (IP 화이트리스트 미해결로 v2). 호출 시 즉시 throw.
 *
 * `authenticate` 의 input 은 4-way AuthInput discriminated union — 마켓별 kind 분기.
 * 본 함수 외 위치에서 `isDebug` 로 어댑터 본체를 분기하는 패턴은 PR 차단.
 */
export async function getMarketAdapter(market: MarketId): Promise<MarketAdapter> {
  // 11번가는 v1 차단 — disabled UI 로도 도달하지만 다중 방어.
  if (market === '11st') {
    throw new Error(
      `11번가는 v1 미사용 (오픈 준비중) — v2 IP 화이트리스트 정책 해결 후`,
    )
  }

  if (isDebug) {
    switch (market) {
      case 'naver': {
        const { naverDebugAdapter } = await import('./debug/NaverDebugAdapter')
        return naverDebugAdapter
      }
      case 'coupang': {
        const { coupangDebugAdapter } = await import('./debug/CoupangDebugAdapter')
        return coupangDebugAdapter
      }
      case 'gmarket': {
        const { gmarketDebugAdapter } = await import('./debug/GmarketDebugAdapter')
        return gmarketDebugAdapter
      }
      case 'auction': {
        const { auctionDebugAdapter } = await import('./debug/AuctionDebugAdapter')
        return auctionDebugAdapter
      }
    }
  }

  // real 모드: 구현된 마켓별 real 어댑터 dynamic import.
  switch (market) {
    case 'coupang': {
      const { coupangRealAdapter } = await import('./real/coupang')
      return coupangRealAdapter
    }
    case 'naver': {
      // C-1 Phase 1: 스켈레톤 + token exchange + refresh.
      // - authenticate(oauth_code) 는 의도적으로 차단 — 실 OAuth code exchange 는
      //   Edge Function `markets-oauth-callback/naver.ts` 가 권위.
      // - refreshToken / fetchCategoryTree / transformProduct / createProduct 는
      //   클라이언트에서 직접 호출 가능 (단위 테스트, silent refresh 시나리오).
      const { naverRealAdapter } = await import('./real/naver')
      return naverRealAdapter
    }
    case 'gmarket': {
      const { gmarketRealAdapter } = await import('./real/gmarket')
      return gmarketRealAdapter
    }
    case 'auction': {
      const { auctionRealAdapter } = await import('./real/auction')
      return auctionRealAdapter
    }
    default:
      // 4개 마켓 (naver / coupang / gmarket / auction) 모두 구현 완료 —
      // exhaustive check 용 가드 (도달 불가).
      throw new Error(
        `real 모드 마켓 어댑터(${market}) 미구현`,
      )
  }
}

export type { MarketAdapter } from './types'
export { MarketError } from './errors'
export type { MarketErrorCode, MarketErrorContext } from './errors'
