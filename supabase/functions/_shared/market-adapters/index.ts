/**
 * 마켓 어댑터 단일 진입 (Edge Function 측).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §4.1
 *   - src/lib/markets/index.ts (클라이언트 측 동등 분기)
 *
 * 강제:
 *   - 본 함수 외 위치에서 `isDebug` 로 어댑터 본체 분기 금지. 발견 시 PR 차단.
 *   - debug 빌드와 real 빌드의 분기는 isDebug 단일 지점.
 *   - real 빌드에서 mock 코드 import 흔적이 발견되면 `grep:mock-leak` 차단.
 *
 * 옵션:
 *   - `scenario` 는 debug 모드에서만 의미. real 에서 전달 시 무시.
 */

import { isDebug } from '../env.ts'
import type { MarketAdapter } from '../market-adapter.ts'
import type { MarketId } from '../schemas.ts'
import { createMockAdapter, type MockScenario } from './debug.ts'
import { createNaverAdapter } from './naver.ts'
import { createCoupangAdapter } from './coupang.ts'

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
    case '11st':
    case 'gmarket':
    case 'auction':
      // v2 백로그 — 인터페이스만 유지.
      throw new Error(
        `market adapter not implemented for ${marketId} (v2 backlog)`,
      )
    default: {
      // exhaustive check
      const _exhaustive: never = marketId
      throw new Error(`unknown market: ${String(_exhaustive)}`)
    }
  }
}

export type { MockScenario } from './debug.ts'
