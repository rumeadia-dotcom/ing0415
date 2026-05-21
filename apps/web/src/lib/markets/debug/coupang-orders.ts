/**
 * 쿠팡 debug 어댑터 fetchOrders 진입.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD-v2-shipping.md §2.1
 */

import { coupangDebugAdapter } from './CoupangDebugAdapter'
import {
  type FetchOrdersInput,
  type MarketOrder,
  type StoredCredential,
} from '@/lib/schemas'

export function coupangDebugFetchOrders(
  input: FetchOrdersInput,
  credential?: StoredCredential,
): Promise<MarketOrder[]> {
  return coupangDebugAdapter.fetchOrders(input, credential)
}
