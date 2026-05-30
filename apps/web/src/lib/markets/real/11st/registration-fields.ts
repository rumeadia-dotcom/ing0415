/**
 * 11번가 마켓별 동적 등록필드 메타 단일 소스 (Web 측).
 *
 * 마스터: docs/architecture/v1/features/11st.md §4.6 / §5, cross-cutting/market-adapter.md §9.8.
 *
 * `MarketAdapter.getRegistrationFields()` 가 반환하는 RegistrationFieldMeta[] 를 만든다.
 * 11st real 어댑터·mock 어댑터(createMockAdapter)가 본 함수 1곳을 재사용해 동일 구조를 노출(parity).
 *
 * label / blockingReason / helpText 는 i18n key(locales/ko.ts) — UI(MarketOptionsCard)가 t() 로 해석.
 *
 * 11번가 카드는 [출고지 select, 반품/교환지 select, 상품정보고시] 3필드를 노출한다
 * (11st.md §3 / §4.6 / §5 — 출고지·반품지=PR-2 / officialNotice=PR-4).
 * 출고지/반품지는 조회형(Layer 2) — useElevenStShippingAddresses 가 셀러오피스 등록분을 채운다.
 * officialNotice 는 ESM 의 kind:'officialNotice' 공용 프레임을 재사용한다(11번가 상품군 마스터 주입).
 */

import { RegistrationFieldMetaSchema, type RegistrationFieldMeta } from '@/lib/schemas'

/**
 * 11번가 동적 등록필드 3개를 반환한다.
 *
 * 1) outboundAddrSeq — kind='select', optionsSource='elevenStOutbound'.
 *    MarketOptionsCard 가 useElevenStShippingAddresses(marketAccountId).outbound 로 옵션을 채운다.
 * 2) returnAddrSeq   — kind='select', optionsSource='elevenStReturn'.
 *    반품/교환지 목록(returnAddrs)으로 채운다.
 * 3) officialNotice  — kind='officialNotice', optionsSource='static' (11st.md §4.6 / PR-4).
 *    상품정보고시(ProductNotification). ESM OfficialNoticeField 재사용 + 11번가 상품군 마스터 주입.
 *    UI 값은 generic 형태({officialNoticeNo, details:[{code,value}]}) — transformProduct 가
 *    11번가 ProductNotification({type, item:[{code,name}]})으로 변환(map.ts normalizeElevenStOfficialNotice).
 *
 * 세 필드 모두 required=true → makeStep3Schema 가 값 필수 검증. 미입력 시 blockingReason tooltip.
 * 수집된 값은 mapping.marketOptions[key] → 오케스트레이터가 addrSeqOut/addrSeqIn / officialNotice 로
 * 매핑(PR-3 transformProduct 가 소비).
 */
export function getElevenStRegistrationFields(): RegistrationFieldMeta[] {
  return [
    RegistrationFieldMetaSchema.parse({
      key: 'outboundAddrSeq',
      label: 'markets.registrationFields.elevenStOutbound.label',
      kind: 'select',
      required: true,
      optionsSource: 'elevenStOutbound',
      helpText: 'markets.registrationFields.elevenStOutbound.helpText',
      blockingReason: 'markets.registrationFields.elevenStOutbound.blockingReason',
    }),
    RegistrationFieldMetaSchema.parse({
      key: 'returnAddrSeq',
      label: 'markets.registrationFields.elevenStReturn.label',
      kind: 'select',
      required: true,
      optionsSource: 'elevenStReturn',
      helpText: 'markets.registrationFields.elevenStReturn.helpText',
      blockingReason: 'markets.registrationFields.elevenStReturn.blockingReason',
    }),
    RegistrationFieldMetaSchema.parse({
      key: 'officialNotice',
      label: 'markets.registrationFields.elevenStOfficialNotice.label',
      kind: 'officialNotice',
      required: true,
      optionsSource: 'static',
      helpText: 'markets.registrationFields.elevenStOfficialNotice.helpText',
      blockingReason: 'markets.registrationFields.elevenStOfficialNotice.blockingReason',
    }),
  ]
}
