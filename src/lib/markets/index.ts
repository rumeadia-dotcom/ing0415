import { isDebug } from '@/lib/env'
import type { MarketId } from '@/lib/schemas'
import type { MarketAdapter } from './types'

/**
 * 마켓 어댑터 단일 진입.
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §4.1
 *
 * v1 활성 마켓 (2026-05-19 결정 — OQ-10):
 *   - naver: 활성 (debug = mock, real = Stage F 에서 구현)
 *   - coupang | 11st | gmarket | auction: 인터페이스 호환 stub 만 유지, 호출 시 즉시 throw
 *     (쿠팡은 HMAC 인증으로 OAuth 가정 인터페이스와 부정합 — v2 인터페이스 확장 후 통합)
 *
 * 본 함수 외 위치에서 `isDebug` 로 어댑터 본체를 분기하는 패턴은 PR 차단.
 */
export async function getMarketAdapter(market: MarketId): Promise<MarketAdapter> {
  // v1 활성 마켓 = naver 만. 나머지는 debug 모드에서도 호출 차단.
  if (market !== 'naver') {
    throw new Error(
      `Adapter ${market} is not in v1 (오픈 준비중) — see CLAUDE.md MVP 범위`,
    )
  }

  if (isDebug) {
    const { createMockAdapter } = await import('./debug/createMockAdapter')
    return createMockAdapter(market)
  }

  // real 모드: Stage F 에서 NaverAdapter 구현 후 분기.
  // const { createNaverAdapter } = await import('./real/NaverAdapter')
  // return createNaverAdapter()
  throw new Error(
    `real 모드 마켓 어댑터(${market})는 Stage F 에서 구현 예정입니다`,
  )
}

export type { MarketAdapter } from './types'
export { MarketError } from './errors'
export type { MarketErrorCode, MarketErrorContext } from './errors'
