/**
 * 마켓 어댑터 단일 진입 (Edge Function 측).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §4.1
 *   - src/lib/markets/index.ts (클라이언트 측 동등 분기)
 *
 * v1 라인업 (2026-05-23 갱신 — 5마켓 정식 결정):
 *   - naver   (oauth)   : 활성. debug = mock, real = stub throw (보강 대기 — Phase 4-B-1)
 *   - coupang (hmac)    : 활성. debug = mock, real = 본격 구현 + gateway 경유 (Phase 4-A)
 *   - gmarket (esm_jwt) : 활성. debug = mock, real = 본격 구현 + gateway 경유 (Phase 4-A)
 *   - auction (esm_jwt) : 활성. debug = mock, real = 본격 구현 + gateway 경유 (Phase 4-A)
 *   - 11st    (api_key) : 활성. debug = mock, real = **stub** — 정식 API spec 확보 후 별도 PR (Phase 4-B-2)
 *
 * 강제:
 *   - 본 함수 외 위치에서 `isDebug` 로 어댑터 본체 분기 금지. 발견 시 PR 차단.
 *   - real 빌드에서 mock 코드 import 흔적이 발견되면 `grep:mock-leak` 차단.
 *   - 옵션 `scenario` 는 debug 모드에서만 의미. real 에서 전달 시 무시.
 */

import { isDebug } from '../env.ts'
import type { MarketAdapter } from '../market-adapter.ts'
import type { MarketId } from '../schemas.ts'
import { createAuctionAdapter } from './auction.ts'
import { createCoupangAdapter } from './coupang.ts'
import { createMockAdapter, type MockScenario } from './debug.ts'
import { createElevenStAdapter } from './eleven-st.ts'
import { createGmarketAdapter } from './gmarket.ts'
import { createNaverAdapter } from './naver.ts'

export interface GetAdapterOptions {
  scenario?: MockScenario
}

export function getMarketAdapter(
  marketId: MarketId,
  opts: GetAdapterOptions = {},
): MarketAdapter {
  if (isDebug) {
    return createMockAdapter(marketId, opts.scenario)
  }
  switch (marketId) {
    case 'naver':
      return createNaverAdapter()
    case 'coupang':
      return createCoupangAdapter()
    case 'gmarket':
      return createGmarketAdapter()
    case 'auction':
      return createAuctionAdapter()
    case '11st':
      return createElevenStAdapter()
  }
}

export type { MockScenario } from './debug.ts'
