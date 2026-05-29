import type { MarketId, RegistrationFieldMeta } from '@/lib/schemas'
import { getEsmRegistrationFields } from './real/esm/registration-fields'

/**
 * 마켓별 동적 등록필드 메타의 **동기 resolver** (s3 3단계 MarketOptionsCard 렌더용).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.6 / §5 / §6, cross-cutting/market-adapter.md §9.8.
 *
 * 왜 어댑터(getMarketAdapter)를 직접 안 쓰나:
 *   - `getMarketAdapter(market)` 는 async + dynamic import (어댑터 본체 chunk 로드).
 *   - `getRegistrationFields()` 는 fetch/Date.now/Math.random 금지의 **순수·정적** 함수이고,
 *     mock↔real 이 동일 구조를 반환(parity.spec 보장)한다. 즉 마켓별로 컴파일타임에
 *     결정되는 상수다 → 렌더 시점에 무거운 어댑터를 await 할 필요가 없다.
 *   - 따라서 UI 는 본 동기 resolver 로 메타만 즉시 얻는다(컴포넌트 내 마켓 하드코딩 분기 금지
 *     원칙은 유지 — UI 는 marketId → 메타 배열만 받고, 메타 kind 로만 렌더 분기).
 *
 * 하위호환: ESM(gmarket/auction) 외 마켓은 `[]` → 카테고리 매핑만(현 동작 불변).
 * officialNotice 필드는 PR-5 가 getEsmRegistrationFields 에 추가하면 자동 반영된다.
 */
export function getRegistrationFieldsForMarket(
  marketId: MarketId,
): RegistrationFieldMeta[] {
  switch (marketId) {
    case 'gmarket':
    case 'auction':
      return getEsmRegistrationFields()
    default:
      return []
  }
}
