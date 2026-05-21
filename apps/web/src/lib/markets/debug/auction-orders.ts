/**
 * 옥션 debug 어댑터 fetchOrders 진입.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1
 */

import { auctionDebugAdapter } from './AuctionDebugAdapter'
import {
  type FetchOrdersInput,
  type MarketOrder,
  type StoredCredential,
} from '@/lib/schemas'

export function auctionDebugFetchOrders(
  input: FetchOrdersInput,
  credential?: StoredCredential,
): Promise<MarketOrder[]> {
  return auctionDebugAdapter.fetchOrders(input, credential)
}
