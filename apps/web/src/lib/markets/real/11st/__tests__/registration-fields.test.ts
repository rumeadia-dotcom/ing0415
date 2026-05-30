/**
 * 11번가 동적 등록필드 (getRegistrationFields) 단위 테스트 (PR-2·PR-4).
 *
 * 마스터: docs/architecture/v1/features/11st.md §3 / §4.6 / §5 / §7, market-adapter.md §9.8.
 * 검증:
 *   - 11st real 어댑터가 출고지/반품지 select + 상품정보고시 3필드 반환 (pass).
 *   - 필드 메타가 RegistrationFieldMetaSchema 통과 + 잘못된 메타는 거부 (pass + fail).
 *   - getRegistrationFieldsForMarket('11st') 가 어댑터와 동일 메타 반환.
 *   - mock ↔ real 동일 구조 (parity, R-006). officialNotice 존재(PR-4).
 */

import { describe, it, expect } from 'vitest'
import { RegistrationFieldMetaSchema } from '@/lib/schemas'
import { getElevenStRegistrationFields } from '../registration-fields'
import { elevenstRealAdapter } from '../index'
import { createMockAdapter } from '../../../debug/createMockAdapter'
import { getRegistrationFieldsForMarket } from '../../../registration-fields'

describe('getElevenStRegistrationFields — 빌더', () => {
  it('출고지/반품지 + 상품정보고시 3필드를 반환한다 (PR-2·PR-4)', () => {
    const fields = getElevenStRegistrationFields()
    expect(fields).toHaveLength(3)
    expect(fields.map((f) => f.key)).toEqual([
      'outboundAddrSeq',
      'returnAddrSeq',
      'officialNotice',
    ])
  })

  it('출고지 필드 (kind=select, required, optionsSource=elevenStOutbound, i18n key)', () => {
    const f = getElevenStRegistrationFields().find(
      (x) => x.key === 'outboundAddrSeq',
    )
    expect(f?.kind).toBe('select')
    expect(f?.required).toBe(true)
    expect(f?.optionsSource).toBe('elevenStOutbound')
    expect(f?.label).toBe('markets.registrationFields.elevenStOutbound.label')
    expect(f?.blockingReason).toBe(
      'markets.registrationFields.elevenStOutbound.blockingReason',
    )
  })

  it('반품/교환지 필드 (kind=select, required, optionsSource=elevenStReturn)', () => {
    const f = getElevenStRegistrationFields().find(
      (x) => x.key === 'returnAddrSeq',
    )
    expect(f?.kind).toBe('select')
    expect(f?.required).toBe(true)
    expect(f?.optionsSource).toBe('elevenStReturn')
  })

  it('상품정보고시 필드 (kind=officialNotice, required, optionsSource=static, i18n key) — PR-4', () => {
    const f = getElevenStRegistrationFields().find((x) => x.key === 'officialNotice')
    expect(f?.kind).toBe('officialNotice')
    expect(f?.required).toBe(true)
    expect(f?.optionsSource).toBe('static')
    expect(f?.label).toBe('markets.registrationFields.elevenStOfficialNotice.label')
    expect(f?.blockingReason).toBe(
      'markets.registrationFields.elevenStOfficialNotice.blockingReason',
    )
  })

  it('반환 필드는 RegistrationFieldMetaSchema 를 통과한다 (pass)', () => {
    for (const f of getElevenStRegistrationFields()) {
      expect(RegistrationFieldMetaSchema.safeParse(f).success).toBe(true)
    }
  })

  it('잘못된 메타(kind 미지정)는 스키마가 거부한다 (fail)', () => {
    const bad = { key: 'outboundAddrSeq', label: 'x', required: true }
    expect(RegistrationFieldMetaSchema.safeParse(bad).success).toBe(false)
  })
})

describe('MarketAdapter.getRegistrationFields — 11번가', () => {
  it('real 어댑터가 출고지/반품지 + 상품정보고시 3필드 반환', () => {
    const fields = elevenstRealAdapter.getRegistrationFields?.() ?? []
    expect(fields.map((f) => f.key)).toEqual([
      'outboundAddrSeq',
      'returnAddrSeq',
      'officialNotice',
    ])
  })

  it('getRegistrationFieldsForMarket("11st") 가 어댑터와 동일 메타 반환', () => {
    expect(getRegistrationFieldsForMarket('11st')).toEqual(
      getElevenStRegistrationFields(),
    )
  })

  it('mock 11st 어댑터가 real 과 동일 구조 반환 (parity)', () => {
    const mock = createMockAdapter('11st')
    const mockFields = mock.getRegistrationFields?.() ?? []
    const realFields = elevenstRealAdapter.getRegistrationFields?.() ?? []
    expect(mockFields).toEqual(realFields)
  })
})
