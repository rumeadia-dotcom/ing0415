/**
 * ESM 동적 등록필드 (getRegistrationFields) 단위 테스트 (PR-3.5).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.6 / §6, cross-cutting/market-adapter.md §9.8.
 * 검증:
 *   - ESM(gmarket/auction) real 어댑터가 조회형 [출하지, 발송정책, 상품정보고시] 3필드 반환 (pass).
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

describe('getEsmRegistrationFields — 빌더 (조회형 전환 PR-E2)', () => {
  it('출하지 + 발송정책 + officialNotice 3필드를 반환한다', () => {
    const fields = getEsmRegistrationFields()
    expect(fields).toHaveLength(3)
    expect(fields.map((f) => f.key)).toEqual([
      'shippingPlaceNo',
      'dispatchPolicyNo',
      'officialNotice',
    ])
  })

  it('출하지(shippingPlaceNo) 필드 (kind=select, required, optionsSource=esmShippingPlace, i18n key)', () => {
    const f = getEsmRegistrationFields().find(
      (x) => x.key === 'shippingPlaceNo',
    )
    expect(f?.kind).toBe('select')
    expect(f?.required).toBe(true)
    expect(f?.optionsSource).toBe('esmShippingPlace')
    // label / blockingReason 은 i18n key (하드코딩 문구 아님).
    expect(f?.label).toBe('markets.registrationFields.esmShippingPlace.label')
    expect(f?.blockingReason).toBe(
      'markets.registrationFields.esmShippingPlace.blockingReason',
    )
  })

  it('발송정책(dispatchPolicyNo) 필드 (kind=select, required, optionsSource=esmDispatchPolicy, i18n key)', () => {
    const f = getEsmRegistrationFields().find(
      (x) => x.key === 'dispatchPolicyNo',
    )
    expect(f?.kind).toBe('select')
    expect(f?.required).toBe(true)
    expect(f?.optionsSource).toBe('esmDispatchPolicy')
    expect(f?.label).toBe('markets.registrationFields.esmDispatchPolicy.label')
    expect(f?.blockingReason).toBe(
      'markets.registrationFields.esmDispatchPolicy.blockingReason',
    )
  })

  it('생성형 shippingProfile kind / shippingProfiles optionsSource 는 enum 에서 제거됐다 (PR-E5)', () => {
    // 빌더는 조회형 필드만 반환 — 생성형 잔재 없음.
    const fields = getEsmRegistrationFields()
    expect(fields.map((f) => f.optionsSource)).toEqual([
      'esmShippingPlace',
      'esmDispatchPolicy',
      'static',
    ])
    // 스키마 레벨 negative-assertion — 제거된 enum 값은 이제 런타임 parse 가 거부한다.
    //   (PR-E3/E4 까지 보존됐던 TS2367 회피 리터럴 비교를 schema reject 로 대체.)
    expect(
      RegistrationFieldMetaSchema.safeParse({
        key: 'shippingProfileId',
        label: 'x',
        kind: 'shippingProfile',
        required: true,
      }).success,
    ).toBe(false)
    expect(
      RegistrationFieldMetaSchema.safeParse({
        key: 'shippingProfileId',
        label: 'x',
        kind: 'select',
        required: true,
        optionsSource: 'shippingProfiles',
      }).success,
    ).toBe(false)
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
    const bad = { key: 'shippingPlaceNo', label: 'x', required: true }
    expect(RegistrationFieldMetaSchema.safeParse(bad).success).toBe(false)
  })

  it('알 수 없는 optionsSource 는 스키마가 거부한다 (fail)', () => {
    const bad = {
      key: 'shippingPlaceNo',
      label: 'x',
      kind: 'select',
      required: true,
      optionsSource: 'esmShippingLookup', // 우산 개념 — 실제 enum 값 아님
    }
    expect(RegistrationFieldMetaSchema.safeParse(bad).success).toBe(false)
  })
})

describe('MarketAdapter.getRegistrationFields — 마켓별 정책', () => {
  it('gmarket real 어댑터가 출하지+발송정책+officialNotice 3필드 반환', () => {
    const fields = gmarketRealAdapter.getRegistrationFields?.() ?? []
    expect(fields.map((f) => f.key)).toEqual([
      'shippingPlaceNo',
      'dispatchPolicyNo',
      'officialNotice',
    ])
  })

  it('auction real 어댑터가 출하지+발송정책+officialNotice 3필드 반환', () => {
    const fields = auctionRealAdapter.getRegistrationFields?.() ?? []
    expect(fields.map((f) => f.key)).toEqual([
      'shippingPlaceNo',
      'dispatchPolicyNo',
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
