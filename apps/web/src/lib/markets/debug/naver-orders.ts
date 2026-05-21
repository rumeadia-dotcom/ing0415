/**
 * 네이버 debug 어댑터 fetchOrders / submitTracking 진입.
 *
 * v2 mock 은 createMockAdapter 에서 마켓별 인스턴스로 만들고 본 파일은 네이버
 * 인스턴스를 가리킨다. fetchOrders 만 export — submitTracking 은 naver-tracking.ts.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1
 */

import { naverDebugAdapter } from './NaverDebugAdapter'
import {
  type FetchOrdersInput,
  type MarketOrder,
  type StoredCredential,
} from '@/lib/schemas'

export function naverDebugFetchOrders(
  input: FetchOrdersInput,
  credential?: StoredCredential,
): Promise<MarketOrder[]> {
  return naverDebugAdapter.fetchOrders(input, credential)
}
