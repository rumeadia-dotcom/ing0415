/**
 * 옥션 ESM JWT real 어댑터 (프론트엔드 / Vite 환경).
 *
 * 본 파일은 공용 ESM 어댑터를 site='A' 로 인스턴스화 하는 thin wrapper.
 * 로직 본문은 `apps/web/src/lib/markets/real/esm/shared-adapter.ts` 단일 출처.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9
 *   - WIP-5markets-mvp.md C-3 Phase 2
 */

import type { MarketAdapter } from '../../types'
import { createEsmRealAdapter } from '../esm/shared-adapter'

export const auctionRealAdapter: MarketAdapter = createEsmRealAdapter({
  market: 'auction',
  site: 'A',
})
