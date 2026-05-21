/**
 * G마켓 debug 어댑터 fetchOrders 진입.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD-v2-shipping.md §2.1
 */

import { gmarketDebugAdapter } from './GmarketDebugAdapter'
import {
  type FetchOrdersInput,
  type MarketOrder,
  type StoredCredential,
} from '@/lib/schemas'

export function gmarketDebugFetchOrders(
  input: FetchOrdersInput,
  credential?: StoredCredential,
): Promise<MarketOrder[]> {
  return gmarketDebugAdapter.fetchOrders(input, credential)
}
