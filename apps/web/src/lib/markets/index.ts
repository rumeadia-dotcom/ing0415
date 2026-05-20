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

  // real 모드: Wave 5 / OQ-11 확정 후 마켓별 real 어댑터 dynamic import.
  // 현 단계는 stub 미구현 — 즉시 throw 로 운영 진입 차단.
  throw new Error(
    `real 모드 마켓 어댑터(${market})는 Wave 5 에서 구현 예정입니다 (OQ-11 확정 후)`,
  )
}

export type { MarketAdapter } from './types'
export { MarketError } from './errors'
export type { MarketErrorCode, MarketErrorContext } from './errors'
