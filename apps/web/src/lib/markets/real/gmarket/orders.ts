/**
 * G마켓 ESM 2.0 fetchOrders (v2 확장).
 *
 * 본 파일은 공용 ESM `orders.ts` 의 `esmFetchOrders` 를 site='G' 로 호출하는
 * thin wrapper. 마켓별 단위 테스트가 import 대상으로 기대하는 파일 위치를 유지.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1
 */

import {
  type FetchOrdersInput,
  type MarketOrder,
  type StoredCredential,
} from '@/lib/schemas'
import { esmFetchOrders } from '../esm/orders'

export function gmarketFetchOrders(
  input: FetchOrdersInput,
  credential: StoredCredential | undefined,
): Promise<MarketOrder[]> {
  return esmFetchOrders({
    market: 'gmarket',
    site: 'G',
    input,
    credential,
  })
}
