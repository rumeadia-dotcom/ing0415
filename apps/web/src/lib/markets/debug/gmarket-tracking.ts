/**
 * G마켓 debug 어댑터 submitTracking 진입.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.4
 */

import { gmarketDebugAdapter } from './GmarketDebugAdapter'
import {
  type MarketSubmitTrackingResult,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'

export function gmarketDebugSubmitTracking(
  input: SubmitTrackingInput,
  credential?: StoredCredential,
): Promise<MarketSubmitTrackingResult> {
  return gmarketDebugAdapter.submitTracking(input, credential)
}
