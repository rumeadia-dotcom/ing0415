import { createMockAdapter } from './createMockAdapter'
import type { MarketAdapter } from '../types'

/**
 * 11번가 debug 어댑터.
 *
 * 2026-05-25 — 5마켓 정식 (CLAUDE.md s5) 의 통합 mock 분기로 진입. 다른 4마켓
 * (naver / coupang / gmarket / auction) 와 동일하게 `createMockAdapter('11st')`
 * wrapper. credentialKind='api_key' (영구 키) 이라 refreshToken 정의 없음.
 *
 * 본 어댑터의 createProduct / fetchOrders 등 mock 응답은 다른 4마켓과 동일한
 * 정규화된 schema (CreateProductResult / MarketOrder[]) 로 반환 — useMock=true
 * 셀러 / E2E / 단위 테스트 모두 5마켓 일관 흐름.
 *
 * real 어댑터는 `apps/web/src/lib/markets/real/11st/index.ts` (스캐폴드) +
 * `apps/api/supabase/functions/_shared/market-adapters/eleven-st.ts` (Edge
 * Function 측) — spec 입수 후 transformProduct / createProduct / fetchCategoryTree
 * 본체 구현 별도 PR.
 */
export const elevenstDebugAdapter: MarketAdapter = createMockAdapter('11st')
