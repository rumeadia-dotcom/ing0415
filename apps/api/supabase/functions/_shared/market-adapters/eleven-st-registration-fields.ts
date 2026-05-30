/**
 * 11번가 마켓별 동적 등록필드 메타 단일 소스 (Edge / Deno 측).
 *
 * Web 미러: apps/web/src/lib/markets/real/11st/registration-fields.ts (구조 동일 — parity).
 * 마스터: docs/architecture/v1/features/11st.md §4.6 / §5, cross-cutting/market-adapter.md §9.8.
 *
 * `MarketAdapter.getRegistrationFields()` 반환 RegistrationFieldMeta[] 를 만든다.
 * 11st real 어댑터·mock 어댑터(debug)가 본 함수 1곳을 재사용(parity).
 * label / blockingReason / helpText 는 i18n key(Web locales/ko.ts) — Edge 는 key 문자열만 담는다.
 * 11번가 카드는 [출고지 select, 반품/교환지 select, 상품정보고시] 3필드(11st.md §3 / §4.6).
 *   출고지·반품지=PR-2 / officialNotice=PR-4(ESM kind:'officialNotice' 공용 프레임 재사용).
 */

import { RegistrationFieldMetaSchema, type RegistrationFieldMeta } from '../schemas.ts'

/** 11번가 동적 등록필드 3개 — [출고지 select, 반품/교환지 select, 상품정보고시]. (11st.md §4.6 / PR-2·PR-4) */
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
