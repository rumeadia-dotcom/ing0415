/**
 * esm-shipping-list / 조회 응답 정규화 단위 테스트 (PR-E1).
 *
 * 검증 대상: lib/normalize.ts 의 pure 헬퍼 (Deno 의존 없음 → vitest 환경 import 가능).
 *   index.ts 의 Deno.serve entry 는 vitest 에서 직접 import 불가 (npm:/Deno specifier).
 *   따라서 정규화/site 분기 로직만 순수 단위로 검증한다 (esm-shipping-profile error-row.test 와 동일 패턴).
 *
 * 마스터:
 *   - docs/architecture/v1/features/esm.md "⚠ 전환 결정 (2026-05-30): 생성형 → 조회형" / PR-E1
 *   - esm-api/product/17.md (출하지 전체조회) / 19.md (발송정책 전체조회)
 *   - testing.md R-001 / CLAUDE.md "pass + fail(빈 목록·필드 누락) ≥1"
 */

import { describe, expect, it } from 'vitest'
import {
  normalizeDispatchPolicies,
  normalizeShippingPlaces,
} from '../lib/normalize'

// ─────────────────────────────────────────────
// 출하지 (shippingPlaces[])
// ─────────────────────────────────────────────

describe('normalizeShippingPlaces', () => {
  it('정상 응답 — shippingPlaces 배열을 정규화 (placeNo int → string)', () => {
    const raw = {
      shippingPlaces: [
        {
          placeNo: 177067,
          placeName: '테스트001',
          addrNo: 440831,
          isDefaultShippingPlace: false,
          backwoodsAdditionalShippingFee: 20000,
        },
        {
          placeNo: 177063,
          placeName: '기본출하지',
          isDefaultShippingPlace: true,
        },
      ],
    }
    expect(normalizeShippingPlaces(raw)).toEqual([
      { placeNo: '177067', placeName: '테스트001', isDefault: false },
      { placeNo: '177063', placeName: '기본출하지', isDefault: true },
    ])
  })

  it('PII/부가 필드(addrNo·주소·추가배송비)는 정규화 결과에 통과시키지 않는다', () => {
    const raw = {
      shippingPlaces: [
        {
          placeNo: 1,
          placeName: 'A',
          addrNo: 999,
          jejuAdditionalShippingFee: 10000,
          isDefaultShippingPlace: true,
        },
      ],
    }
    const [place] = normalizeShippingPlaces(raw)
    expect(Object.keys(place ?? {}).sort()).toEqual([
      'isDefault',
      'placeName',
      'placeNo',
    ])
  })

  it('빈 목록 — shippingPlaces 가 빈 배열이면 [] (셀러 설정 없음)', () => {
    expect(normalizeShippingPlaces({ shippingPlaces: [] })).toEqual([])
  })

  it('필드 누락 — placeNo / placeName 없는 항목은 스킵', () => {
    const raw = {
      shippingPlaces: [
        { placeName: '번호없음', isDefaultShippingPlace: true }, // placeNo 누락 → 스킵
        { placeNo: 5, isDefaultShippingPlace: false }, // placeName 누락 → 스킵
        { placeNo: 7, placeName: '정상', isDefaultShippingPlace: false },
      ],
    }
    expect(normalizeShippingPlaces(raw)).toEqual([
      { placeNo: '7', placeName: '정상', isDefault: false },
    ])
  })

  it('wrapper 누락 / 알 수 없는 형태 → 빈 배열 (조회실패 안전 기본값)', () => {
    expect(normalizeShippingPlaces({})).toEqual([])
    expect(normalizeShippingPlaces(null)).toEqual([])
    expect(normalizeShippingPlaces('oops')).toEqual([])
    expect(normalizeShippingPlaces({ shippingPlaces: 'not-array' })).toEqual([])
  })

  it('배열을 직접 받아도 정규화 (wrapper 없는 응답 내성)', () => {
    expect(
      normalizeShippingPlaces([
        { placeNo: 3, placeName: 'X', isDefaultShippingPlace: false },
      ]),
    ).toEqual([{ placeNo: '3', placeName: 'X', isDefault: false }])
  })
})

// ─────────────────────────────────────────────
// 발송정책 (dispatchPolicies[]) — 사이트별 태깅
// ─────────────────────────────────────────────

describe('normalizeDispatchPolicies', () => {
  it('정상 응답 — 호출 site 로 태깅 (G)', () => {
    const raw = {
      dispatchPolicies: [
        {
          dispatchPolicyNo: 910,
          dispatchPolicyName: '당일발송',
          dispatchType: 'A',
          dispatchCloseTime: '23:30',
          isDefault: true,
        },
      ],
    }
    expect(normalizeDispatchPolicies(raw, 'G')).toEqual([
      {
        site: 'G',
        dispatchPolicyNo: '910',
        dispatchPolicyName: '당일발송',
        dispatchType: 'A',
        isDefault: true,
      },
    ])
  })

  it('site 분기 — 옥션(A) 호출은 결과를 A 로 태깅', () => {
    const raw = {
      dispatchPolicies: [
        {
          dispatchPolicyNo: 920,
          dispatchPolicyName: '순차발송',
          dispatchType: 'B',
          isDefault: false,
        },
      ],
    }
    const gmkt = normalizeDispatchPolicies(raw, 'G')
    const iac = normalizeDispatchPolicies(raw, 'A')
    expect(gmkt[0]?.site).toBe('G')
    expect(iac[0]?.site).toBe('A')
    // 동일 raw 라도 site 만 다름 — dispatchPolicyNo.{gmkt|iac} 매칭 분기 보장.
    expect(gmkt[0]?.dispatchPolicyNo).toBe('920')
    expect(iac[0]?.dispatchPolicyNo).toBe('920')
  })

  it('빈 목록 — dispatchPolicies 가 빈 배열이면 []', () => {
    expect(normalizeDispatchPolicies({ dispatchPolicies: [] }, 'G')).toEqual([])
  })

  it('필드 누락 — 번호/이름/유형 중 하나라도 없으면 스킵', () => {
    const raw = {
      dispatchPolicies: [
        { dispatchPolicyName: 'x', dispatchType: 'A', isDefault: true }, // 번호 누락
        { dispatchPolicyNo: 1, dispatchType: 'A', isDefault: true }, // 이름 누락
        { dispatchPolicyNo: 2, dispatchPolicyName: 'y', isDefault: true }, // 유형 누락
        {
          dispatchPolicyNo: 3,
          dispatchPolicyName: '정상',
          dispatchType: 'B',
          isDefault: false,
        },
      ],
    }
    expect(normalizeDispatchPolicies(raw, 'A')).toEqual([
      {
        site: 'A',
        dispatchPolicyNo: '3',
        dispatchPolicyName: '정상',
        dispatchType: 'B',
        isDefault: false,
      },
    ])
  })

  it('유효하지 않은 dispatchType(Z) 항목은 스킵', () => {
    const raw = {
      dispatchPolicies: [
        {
          dispatchPolicyNo: 1,
          dispatchPolicyName: '잘못된유형',
          dispatchType: 'Z',
          isDefault: true,
        },
      ],
    }
    expect(normalizeDispatchPolicies(raw, 'G')).toEqual([])
  })

  it('wrapper 누락 / 알 수 없는 형태 → 빈 배열', () => {
    expect(normalizeDispatchPolicies({}, 'G')).toEqual([])
    expect(normalizeDispatchPolicies(null, 'A')).toEqual([])
    expect(normalizeDispatchPolicies({ dispatchPolicies: 42 }, 'G')).toEqual([])
  })
})
