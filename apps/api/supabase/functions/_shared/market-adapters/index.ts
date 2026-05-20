/**
 * 마켓 어댑터 단일 진입 (Edge Function 측).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §4.1
 *   - src/lib/markets/index.ts (클라이언트 측 동등 분기)
 *
 * v1 라인업 (2026-05-19, Wave 2 — OQ-10 재결정):
 *   - naver   (oauth)   : 활성. debug = mock, real = stub throw (Wave 5).
 *   - coupang (hmac)    : 활성. debug = mock, real = stub throw (Wave 5).
 *   - gmarket (esm_jwt) : 활성. debug = mock, real = stub throw (Wave 5).
 *   - auction (esm_jwt) : 활성. debug = mock, real = stub throw (Wave 5).
 *   - 11st    (api_key) : v1 미사용 (오픈 준비중). debug 여도 즉시 throw.
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
import { createGmarketAdapter } from './gmarket.ts'
import { createNaverAdapter } from './naver.ts'

export interface GetAdapterOptions {
  scenario?: MockScenario
}

export function getMarketAdapter(
  marketId: MarketId,
  opts: GetAdapterOptions = {},
): MarketAdapter {
  // 11번가 — v1 미사용 다중 방어.
  if (marketId === '11st') {
    throw new Error(
      '11번가는 v1 미사용 (오픈 준비중) — v2 IP 화이트리스트 정책 해결 후',
    )
  }
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
  }
}

export type { MockScenario } from './debug.ts'
