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

/**
 * 마켓 어댑터 단일 진입 (Edge Function 측).
 *
 * v1 활성 마켓 (2026-05-19 결정 — OQ-10):
 *   - naver: 활성 (debug = mock, real = 실 어댑터)
 *   - coupang | 11st | gmarket | auction: 호출 시 즉시 throw (오픈 준비중)
 *     쿠팡은 HMAC 인증으로 OAuth 가정 인터페이스와 부정합 → v2 인터페이스 확장 후 통합.
 *     coupang.ts stub 은 인터페이스 호환을 위해 유지하되 v1 운영 경로에서 차단.
 *
 * 강제:
 *   - 본 함수 외 위치에서 `isDebug` 로 어댑터 본체 분기 금지. 발견 시 PR 차단.
 *   - real 빌드에서 mock 코드 import 흔적이 발견되면 `grep:mock-leak` 차단.
 */

export interface GetAdapterOptions {
  scenario?: MockScenario
}

export function getMarketAdapter(
  marketId: MarketId,
  opts: GetAdapterOptions = {},
): MarketAdapter {
  // v1 활성 = naver 1개. 그 외는 debug 모드여도 호출 차단.
  if (marketId !== 'naver') {
    throw new Error(
      `Adapter ${marketId} is not in v1 (오픈 준비중) — see CLAUDE.md MVP 범위`,
    )
  }
  if (isDebug) {
    return createMockAdapter(marketId, opts.scenario)
  }
  return createNaverAdapter()
}

export type { MockScenario } from './debug.ts'
