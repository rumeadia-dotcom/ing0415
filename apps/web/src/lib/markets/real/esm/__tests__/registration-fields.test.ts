/**
 * ESM 동적 등록필드 (getRegistrationFields) 단위 테스트 (PR-3.5).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.6 / §6, cross-cutting/market-adapter.md §9.8.
 * 검증:
 *   - ESM(gmarket/auction) real 어댑터가 shippingProfile 필드 1개 반환 (pass).
 *   - 타 마켓(naver/coupang/11st) 어댑터가 getRegistrationFields 미정의 → [] 취급 (하위호환 회귀).
 *   - 필드 메타가 RegistrationFieldMetaSchema 를 통과 + 잘못된 메타는 거부 (pass + fail).
 *   - mock ↔ real 동일 구조 (parity 보강).
 */

import { describe, it, expect } from 'vitest'
import { RegistrationFieldMetaSchema } from '@/lib/schemas'
import { getEsmRegistrationFields } from '../registration-fields'
import { gmarketRealAdapter } from '../../../real/gmarket'
import { auctionRealAdapter } from '../../../real/auction'
import { naverRealAdapter } from '../../../real/naver'
import { coupangRealAdapter } from '../../../real/coupang'
import { createMockAdapter } from '../../../debug/createMockAdapter'

describe('getEsmRegistrationFields — 빌더', () => {
  it('shippingProfile + officialNotice 2필드를 반환한다 (PR-5)', () => {
    const fields = getEsmRegistrationFields()
    expect(fields).toHaveLength(2)
    expect(fields.map((f) => f.key)).toEqual([
      'shippingProfileId',
      'officialNotice',
    ])
  })

  it('shippingProfile 필드 (required, optionsSource=shippingProfiles, i18n key)', () => {
    const f = getEsmRegistrationFields().find(
      (x) => x.key === 'shippingProfileId',
    )
    expect(f?.kind).toBe('shippingProfile')
    expect(f?.required).toBe(true)
    expect(f?.optionsSource).toBe('shippingProfiles')
    // label / blockingReason 은 i18n key (하드코딩 문구 아님).
    expect(f?.label).toBe('markets.registrationFields.shippingProfile.label')
    expect(f?.blockingReason).toBe(
      'markets.registrationFields.shippingProfile.blockingReason',
    )
  })

  it('officialNotice 필드 (kind=officialNotice, required, optionsSource=static, i18n key)', () => {
    const f = getEsmRegistrationFields().find((x) => x.key === 'officialNotice')
    expect(f).toBeDefined()
    expect(f?.kind).toBe('officialNotice')
    expect(f?.required).toBe(true)
    expect(f?.optionsSource).toBe('static')
    expect(f?.label).toBe('markets.registrationFields.officialNotice.label')
    expect(f?.blockingReason).toBe(
      'markets.registrationFields.officialNotice.blockingReason',
    )
  })

  it('반환 필드는 RegistrationFieldMetaSchema 를 통과한다 (pass)', () => {
    for (const f of getEsmRegistrationFields()) {
      expect(RegistrationFieldMetaSchema.safeParse(f).success).toBe(true)
    }
  })

  it('잘못된 메타(kind 미지정)는 스키마가 거부한다 (fail)', () => {
    const bad = { key: 'shippingProfileId', label: 'x', required: true }
    expect(RegistrationFieldMetaSchema.safeParse(bad).success).toBe(false)
  })
})

describe('MarketAdapter.getRegistrationFields — 마켓별 정책', () => {
  it('gmarket real 어댑터가 shippingProfile + officialNotice 2필드 반환', () => {
    const fields = gmarketRealAdapter.getRegistrationFields?.() ?? []
    expect(fields.map((f) => f.key)).toEqual([
      'shippingProfileId',
      'officialNotice',
    ])
  })

  it('auction real 어댑터가 shippingProfile + officialNotice 2필드 반환', () => {
    const fields = auctionRealAdapter.getRegistrationFields?.() ?? []
    expect(fields.map((f) => f.key)).toEqual([
      'shippingProfileId',
      'officialNotice',
    ])
  })

  it('naver real 어댑터는 getRegistrationFields 미정의 → [] (하위호환)', () => {
    expect(naverRealAdapter.getRegistrationFields).toBeUndefined()
    expect(naverRealAdapter.getRegistrationFields?.() ?? []).toEqual([])
  })

  it('coupang real 어댑터는 getRegistrationFields 미정의 → [] (하위호환)', () => {
    expect(coupangRealAdapter.getRegistrationFields).toBeUndefined()
    expect(coupangRealAdapter.getRegistrationFields?.() ?? []).toEqual([])
  })

  it('mock ESM(gmarket) 어댑터가 real 과 동일 구조 반환 (parity)', () => {
    const mock = createMockAdapter('gmarket')
    const mockFields = mock.getRegistrationFields?.() ?? []
    const realFields = gmarketRealAdapter.getRegistrationFields?.() ?? []
    expect(mockFields).toEqual(realFields)
  })

  it('mock 비-ESM(naver) 어댑터는 getRegistrationFields 미정의 (하위호환)', () => {
    const mock = createMockAdapter('naver')
    expect(mock.getRegistrationFields).toBeUndefined()
  })
})
