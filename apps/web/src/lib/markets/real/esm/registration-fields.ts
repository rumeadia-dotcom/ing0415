/**
 * ESM(G마켓·옥션) 마켓별 동적 등록필드 메타 단일 소스 (Web 측).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.6 / §5 / §6, cross-cutting/market-adapter.md.
 *
 * `MarketAdapter.getRegistrationFields()` 가 반환하는 RegistrationFieldMeta[] 를 만든다.
 * gmarket/auction thin wrapper 가 공용 어댑터(shared-adapter.ts)를 통해 동일 필드를 노출하고,
 * mock 어댑터(createMockAdapter)도 동일 구조를 반환하도록 본 함수 1곳을 재사용한다(parity).
 *
 * label / blockingReason / helpText 는 i18n key(locales/ko.ts) — UI(MarketOptionsCard, PR-3.5)가
 * t() 로 해석. 하드코딩 금지 원칙 준수(여기서는 key 만 담는다).
 *
 * officialNotice 필드는 PR-5 담당 — 여기서 넣지 않는다.
 */

import { RegistrationFieldMetaSchema, type RegistrationFieldMeta } from '@/lib/schemas'

/**
 * ESM 배송 프로필 선택 필드 1개를 반환한다.
 * - kind='shippingProfile', optionsSource='shippingProfiles' → MarketOptionsCard 가
 *   useEsmShippingProfiles 로 옵션을 채운다(PR-3.5).
 * - required=true → Step3Schema 가 값 필수 검증. 미입력 시 blockingReason tooltip.
 */
export function getEsmRegistrationFields(): RegistrationFieldMeta[] {
  return [
    RegistrationFieldMetaSchema.parse({
      key: 'shippingProfileId',
      label: 'markets.registrationFields.shippingProfile.label',
      kind: 'shippingProfile',
      required: true,
      optionsSource: 'shippingProfiles',
      helpText: 'markets.registrationFields.shippingProfile.helpText',
      blockingReason: 'markets.registrationFields.shippingProfile.blockingReason',
    }),
  ]
}
