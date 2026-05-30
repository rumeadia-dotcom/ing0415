/**
 * ESM 상품정보고시 41개 상품군 마스터 상수 + strict 스키마 단위 테스트 (PR-5).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.4
 * 근거 원문: docs/architecture/v1/features/esm-api/product/161.md
 * testing.md R-001: 새 상수 무결성 + 새 스키마 pass 1 + fail ≥1.
 */

import { describe, it, expect } from 'vitest'
import {
  ESM_OFFICIAL_NOTICE_NOS,
  ESM_OFFICIAL_NOTICE_GROUPS,
  ESM_OFFICIAL_NOTICE_GROUP_BY_NO,
  EsmOfficialNoticeNoSchema,
  EsmOfficialNoticeStrictSchema,
  getEsmOfficialNoticeOptions,
} from '../official-notice-groups'

describe('ESM 상품군 마스터 — 무결성', () => {
  it('상품군 코드는 정확히 41개 (1~41)', () => {
    expect(ESM_OFFICIAL_NOTICE_NOS).toHaveLength(41)
    expect(ESM_OFFICIAL_NOTICE_GROUPS).toHaveLength(41)
    expect(ESM_OFFICIAL_NOTICE_NOS[0]).toBe('1')
    expect(ESM_OFFICIAL_NOTICE_NOS[40]).toBe('41')
  })

  it('코드는 중복 없이 1..41 을 빠짐없이 덮는다', () => {
    const nos = ESM_OFFICIAL_NOTICE_GROUPS.map((g) => g.officialNoticeNo)
    expect(new Set(nos).size).toBe(41)
    const expected = Array.from({ length: 41 }, (_, i) => String(i + 1))
    expect([...nos].sort((a, b) => Number(a) - Number(b))).toEqual(expected)
  })

  it('모든 군은 비어있지 않은 명칭을 가진다', () => {
    for (const g of ESM_OFFICIAL_NOTICE_GROUPS) {
      expect(g.officialNoticeName.length).toBeGreaterThan(0)
    }
  })

  it('문서(161.md) 확인분: 1=의류, 41=살생물제품 (docVerified)', () => {
    const g1 = ESM_OFFICIAL_NOTICE_GROUP_BY_NO['1']
    const g41 = ESM_OFFICIAL_NOTICE_GROUP_BY_NO['41']
    expect(g1.officialNoticeName).toBe('의류')
    expect(g1.docVerified).toBe(true)
    expect(g41.officialNoticeName).toBe('살생물제품')
    expect(g41.docVerified).toBe(true)
    // 문서 sample 의 항목코드 41-1 이 정적 보강됨.
    expect(g41.requiredItemCodes).toContain('41-1')
  })

  it('BY_NO 맵은 모든 코드를 O(1) 로 조회한다', () => {
    for (const no of ESM_OFFICIAL_NOTICE_NOS) {
      expect(ESM_OFFICIAL_NOTICE_GROUP_BY_NO[no]?.officialNoticeNo).toBe(no)
    }
  })

  it('select 옵션은 41개 {value,label}', () => {
    const opts = getEsmOfficialNoticeOptions()
    expect(opts).toHaveLength(41)
    expect(opts[0]).toEqual({ value: '1', label: '의류' })
  })
})

describe('EsmOfficialNoticeNoSchema — enum', () => {
  it("'1'~'41' 통과 (pass)", () => {
    expect(EsmOfficialNoticeNoSchema.safeParse('1').success).toBe(true)
    expect(EsmOfficialNoticeNoSchema.safeParse('41').success).toBe(true)
  })

  it("'0' / '42' / 'abc' 거부 (fail)", () => {
    expect(EsmOfficialNoticeNoSchema.safeParse('0').success).toBe(false)
    expect(EsmOfficialNoticeNoSchema.safeParse('42').success).toBe(false)
    expect(EsmOfficialNoticeNoSchema.safeParse('abc').success).toBe(false)
  })
})

describe('EsmOfficialNoticeStrictSchema — 군 정합 + 필수항목', () => {
  it('유효 군 + details 통과 (pass)', () => {
    expect(
      EsmOfficialNoticeStrictSchema.safeParse({
        officialNoticeNo: '1',
        details: [{ code: '1-1', value: '면 100%' }],
      }).success,
    ).toBe(true)
  })

  it('상품군 코드가 41 범위 밖이면 실패 (fail)', () => {
    expect(
      EsmOfficialNoticeStrictSchema.safeParse({
        officialNoticeNo: '99',
        details: [],
      }).success,
    ).toBe(false)
  })

  it('hasStaticItems=false 군은 details 항목을 강제하지 않는다 (런타임 보강)', () => {
    // 41군은 정적 항목 41-1 이 있으나 hasStaticItems=false → details 강제 안 함.
    expect(
      EsmOfficialNoticeStrictSchema.safeParse({
        officialNoticeNo: '41',
        details: [],
      }).success,
    ).toBe(true)
  })
})
