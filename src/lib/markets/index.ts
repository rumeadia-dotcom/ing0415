import { isDebug } from '@/lib/env'
import type { MarketId } from '@/lib/schemas'
import type { MarketAdapter } from './types'

/**
 * 마켓 어댑터 단일 진입.
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §4.1
 *
 * - debug 모드: mock 어댑터 (dynamic import → real 번들 tree-shaking).
 * - real 모드: Stage F 에서 마켓별 실 어댑터 구현 후 분기.
 *
 * 본 함수 외 위치에서 `isDebug` 로 어댑터 본체를 분기하는 패턴은 PR 차단.
 */
export async function getMarketAdapter(market: MarketId): Promise<MarketAdapter> {
  if (isDebug) {
    const { createMockAdapter } = await import('./debug/createMockAdapter')
    return createMockAdapter(market)
  }

  // real 모드: Stage F 에서 마켓별 동적 import 추가.
  // switch (market) {
  //   case 'naver':   return (await import('./real/NaverAdapter')).createNaverAdapter()
  //   case 'coupang': return (await import('./real/CoupangAdapter')).createCoupangAdapter()
  //   ...
  // }
  throw new Error(
    `real 모드 마켓 어댑터(${market})는 Stage F 에서 구현 예정입니다`,
  )
}

export type { MarketAdapter } from './types'
export { MarketError } from './errors'
export type { MarketErrorCode, MarketErrorContext } from './errors'
