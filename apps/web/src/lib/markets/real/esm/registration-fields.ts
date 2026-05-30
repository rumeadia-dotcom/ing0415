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
 * ESM 카드는 [출하지 select, 발송정책 select, 상품정보고시] 3필드를 노출한다
 * (esm.md "전환 결정 2026-05-30" 조회형 / §4.6 / §5).
 * gmarket/auction thin wrapper·mock 어댑터가 본 함수 1곳을 재사용하므로 두 사이트 모두 자동 반영.
 *
 * ⚠ 조회형 전환(PR-E2): 생성형 shippingProfile(optionsSource='shippingProfiles') 단일 필드를
 *   조회형 출하지(placeNo) + 발송정책(dispatchPolicyNo) 2필드로 분리한다. 우리 앱은 더 이상
 *   배송 프로필을 만들지 않고, 셀러가 ESM Plus 에 만든 것을 useEsmShippingOptions 로 조회·선택만 한다.
 */

import { RegistrationFieldMetaSchema, type RegistrationFieldMeta } from '@/lib/schemas'

/**
 * ESM 동적 등록필드 3개를 반환한다(조회형 — esm.md "전환 결정" / PR-E2).
 *
 * 1) shippingPlaceNo — kind='select', optionsSource='esmShippingPlace'.
 *    MarketOptionsCard 가 useEsmShippingOptions(marketAccountId).places 로 옵션을 채운다(ESM 출하지).
 * 2) dispatchPolicyNo — kind='select', optionsSource='esmDispatchPolicy'.
 *    useEsmShippingOptions(...).dispatchPolicies 로 옵션을 채운다. 발송정책은 사이트별(G/A)이라
 *    조회 응답이 site 로 태깅되며(계정 site 분만 내려옴), 카드는 그 목록을 그대로 노출한다.
 * 3) officialNotice — kind='officialNotice' (PR-5). 상품군 select + 군별 필수항목 입력.
 *    옵션 출처는 정적 41 상품군 마스터(official-notice-groups.ts) → optionsSource='static'.
 *
 * 세 필드 모두 required=true → makeStep3Schema 가 값 필수 검증. 미입력 시 blockingReason tooltip.
 * 수집된 값(placeNo/dispatchPolicyNo)은 mapping.marketOptions[key] → 오케스트레이터가
 * mapping.extra.placeNo/dispatchPolicyNo 로 적재(PR-4 transformProduct 가 소비).
 */
export function getEsmRegistrationFields(): RegistrationFieldMeta[] {
  return [
    RegistrationFieldMetaSchema.parse({
      key: 'shippingPlaceNo',
      label: 'markets.registrationFields.esmShippingPlace.label',
      kind: 'select',
      required: true,
      optionsSource: 'esmShippingPlace',
      helpText: 'markets.registrationFields.esmShippingPlace.helpText',
      blockingReason: 'markets.registrationFields.esmShippingPlace.blockingReason',
    }),
    RegistrationFieldMetaSchema.parse({
      key: 'dispatchPolicyNo',
      label: 'markets.registrationFields.esmDispatchPolicy.label',
      kind: 'select',
      required: true,
      optionsSource: 'esmDispatchPolicy',
      helpText: 'markets.registrationFields.esmDispatchPolicy.helpText',
      blockingReason: 'markets.registrationFields.esmDispatchPolicy.blockingReason',
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
