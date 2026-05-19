import { createMockAdapter } from './createMockAdapter'
import type { MarketAdapter } from '../types'

/**
 * 쿠팡 debug 어댑터. 현 단계는 공통 mock 의 wrapper.
 * 마켓별 partial / quirk 시뮬레이션은 Stage F 에서.
 */
export const coupangDebugAdapter: MarketAdapter = createMockAdapter('coupang')
