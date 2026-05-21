/**
 * G마켓 ESM 2.0 submitTracking (v2 확장).
 *
 * 본 파일은 공용 ESM `orders.ts` 의 `esmSubmitTracking` 을 site='G' 로 호출하는
 * thin wrapper.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD-v2-shipping.md §2.4
 */

import {
  type MarketSubmitTrackingResult,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'
import { esmSubmitTracking } from '../esm/orders'

export function gmarketSubmitTracking(
  input: SubmitTrackingInput,
  credential: StoredCredential | undefined,
): Promise<MarketSubmitTrackingResult> {
  return esmSubmitTracking({
    market: 'gmarket',
    site: 'G',
    input,
    credential,
  })
}
