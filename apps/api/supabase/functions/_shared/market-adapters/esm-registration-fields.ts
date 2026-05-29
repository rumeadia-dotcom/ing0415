/**
 * ESM(G마켓·옥션) 마켓별 동적 등록필드 메타 단일 소스 (Edge / Deno 측).
 *
 * Web 미러: apps/web/src/lib/markets/real/esm/registration-fields.ts (구조 동일 — Zod Mirror Check).
 * 마스터: docs/architecture/v1/features/esm.md §4.6 / §6, cross-cutting/market-adapter.md.
 *
 * `MarketAdapter.getRegistrationFields()` 반환 RegistrationFieldMeta[] 를 만든다.
 * gmarket/auction thin wrapper(esm-shared)와 mock 어댑터(debug)가 본 함수 1곳을 재사용(parity).
 * label / blockingReason / helpText 는 i18n key(Web locales/ko.ts) — Edge 는 key 문자열만 담는다.
 * officialNotice 필드는 PR-5 담당 — 여기서 넣지 않는다.
 */

import { RegistrationFieldMetaSchema, type RegistrationFieldMeta } from '../schemas.ts'

/** ESM 배송 프로필 선택 필드 1개. (esm.md §4.6) */
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
