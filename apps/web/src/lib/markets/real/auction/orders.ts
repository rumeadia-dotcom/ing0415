/**
 * 옥션 ESM 2.0 fetchOrders (v2 확장).
 *
 * 본 파일은 공용 ESM `orders.ts` 의 `esmFetchOrders` 를 site='A' 로 호출하는
 * thin wrapper.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD-v2-shipping.md §2.1
 */

import {
  type FetchOrdersInput,
  type MarketOrder,
  type StoredCredential,
} from '@/lib/schemas'
import { esmFetchOrders } from '../esm/orders'

export function auctionFetchOrders(
  input: FetchOrdersInput,
  credential: StoredCredential | undefined,
): Promise<MarketOrder[]> {
  return esmFetchOrders({
    market: 'auction',
    site: 'A',
    input,
    credential,
  })
}
