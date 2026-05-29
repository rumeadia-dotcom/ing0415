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
 * ESM 카드는 [배송 프로필, 상품정보고시] 2필드를 노출한다(esm.md §1.5 / §4.6 / §5).
 * gmarket/auction thin wrapper·mock 어댑터가 본 함수 1곳을 재사용하므로 두 사이트 모두 자동 반영.
 */

import { RegistrationFieldMetaSchema, type RegistrationFieldMeta } from '@/lib/schemas'

/**
 * ESM 동적 등록필드 2개를 반환한다.
 *
 * 1) shippingProfileId — kind='shippingProfile', optionsSource='shippingProfiles'.
 *    MarketOptionsCard 가 useEsmShippingProfiles 로 옵션을 채운다(PR-3.5).
 * 2) officialNotice — kind='officialNotice' (PR-5). 상품군 select + 군별 필수항목 입력.
 *    옵션 출처는 정적 41 상품군 마스터(official-notice-groups.ts) → optionsSource='static'.
 *    frontend 는 선택 군의 requiredItemCodes(또는 라이브 codes API)로 항목 폼을 동적 생성.
 *
 * 두 필드 모두 required=true → makeStep3Schema 가 값 필수 검증. 미입력 시 blockingReason tooltip.
 * 수집된 값은 mapping.marketOptions[key] → 오케스트레이터가 mapping.extra.officialNotice 로 적재
 * (PR-4 transformProduct 가 소비). 본 PR(5)은 선언만 — 적재/매핑은 frontend/PR-4 경로.
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
    RegistrationFieldMetaSchema.parse({
      key: 'officialNotice',
      label: 'markets.registrationFields.officialNotice.label',
      kind: 'officialNotice',
      required: true,
      optionsSource: 'static',
      helpText: 'markets.registrationFields.officialNotice.helpText',
      blockingReason: 'markets.registrationFields.officialNotice.blockingReason',
    }),
  ]
}
