/**
 * ESM(G마켓·옥션) 마켓별 동적 등록필드 메타 단일 소스 (Edge / Deno 측).
 *
 * Web 미러: apps/web/src/lib/markets/real/esm/registration-fields.ts (구조 동일 — Zod Mirror Check).
 * 마스터: docs/architecture/v1/features/esm.md §4.6 / §6, cross-cutting/market-adapter.md.
 *
 * `MarketAdapter.getRegistrationFields()` 반환 RegistrationFieldMeta[] 를 만든다.
 * gmarket/auction thin wrapper(esm-shared)와 mock 어댑터(debug)가 본 함수 1곳을 재사용(parity).
 * label / blockingReason / helpText 는 i18n key(Web locales/ko.ts) — Edge 는 key 문자열만 담는다.
 * ESM 카드는 [출하지 select, 발송정책 select, 상품정보고시] 3필드를 노출한다
 * (esm.md "전환 결정 2026-05-30" 조회형 / §4.6 / §5).
 *
 * ⚠ 조회형 전환(PR-E2): 생성형 shippingProfile(optionsSource='shippingProfiles') → 조회형
 *   출하지(esmShippingPlace) + 발송정책(esmDispatchPolicy) 2필드. Web 미러와 구조 동일.
 */

import { RegistrationFieldMetaSchema, type RegistrationFieldMeta } from '../schemas.ts'

/** ESM 동적 등록필드 3개 — [출하지 select, 발송정책 select, 상품정보고시]. (esm.md 전환 결정 / PR-E2) */
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
