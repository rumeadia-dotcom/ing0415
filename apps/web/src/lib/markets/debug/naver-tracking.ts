/**
 * 네이버 debug 어댑터 submitTracking 진입.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.4
 */

import { naverDebugAdapter } from './NaverDebugAdapter'
import {
  type MarketSubmitTrackingResult,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'

export function naverDebugSubmitTracking(
  input: SubmitTrackingInput,
  credential?: StoredCredential,
): Promise<MarketSubmitTrackingResult> {
  return naverDebugAdapter.submitTracking(input, credential)
}
