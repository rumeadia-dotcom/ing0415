/**
 * 쿠팡 debug 어댑터 submitTracking 진입.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD-v2-shipping.md §2.4
 */

import { coupangDebugAdapter } from './CoupangDebugAdapter'
import {
  type MarketSubmitTrackingResult,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'

export function coupangDebugSubmitTracking(
  input: SubmitTrackingInput,
  credential?: StoredCredential,
): Promise<MarketSubmitTrackingResult> {
  return coupangDebugAdapter.submitTracking(input, credential)
}
