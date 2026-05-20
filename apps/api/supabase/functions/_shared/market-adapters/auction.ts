/**
 * 옥션 ESM JWT real 어댑터 (Edge Function / Deno 측).
 *
 * 본 파일은 공용 ESM 어댑터를 site='A' 로 인스턴스화 하는 thin wrapper.
 * 로직 본문은 `./esm-shared.ts` 단일 출처 — G마켓과 어댑터 구조 동일, site 만 다름.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9
 *   - WIP-5markets-mvp.md C-3 Phase 2
 */

import type { MarketAdapter } from '../market-adapter.ts'
import { createEsmAdapter } from './esm-shared.ts'

export function createAuctionAdapter(): MarketAdapter {
  return createEsmAdapter({ market: 'auction', site: 'A' })
}
