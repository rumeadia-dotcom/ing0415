/**
 * G마켓 ESM JWT real 어댑터 (Edge Function / Deno 측).
 *
 * 본 파일은 공용 ESM 어댑터를 site='G' 로 인스턴스화 하는 thin wrapper.
 * 로직 본문은 `./esm-shared.ts` 단일 출처.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9
 *   - WIP-5markets-mvp.md C-3 Phase 1
 */

import type { MarketAdapter } from '../market-adapter.ts'
import { createEsmAdapter } from './esm-shared.ts'

export function createGmarketAdapter(): MarketAdapter {
  return createEsmAdapter({ market: 'gmarket', site: 'G' })
}
