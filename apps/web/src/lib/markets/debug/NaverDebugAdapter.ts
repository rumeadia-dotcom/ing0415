import { createMockAdapter } from './createMockAdapter'
import type { MarketAdapter } from '../types'

/**
 * 네이버 스마트스토어 debug 어댑터.
 * 실제 마켓별 페이로드 quirk 시뮬레이션은 Stage F 에서 real 어댑터 옆에 정의.
 * 현 단계는 공통 mock 의 wrapper.
 */
export const naverDebugAdapter: MarketAdapter = createMockAdapter('naver')
