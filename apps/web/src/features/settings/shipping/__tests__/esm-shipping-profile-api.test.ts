/**
 * esm-shipping-profile-api 단위 테스트 (PR-3 frontend).
 *
 * 마스터: docs/architecture/v1/features/esm.md §3 / §4.5 / §7(PR-3)
 *
 * 커버리지:
 *  - listEsmShippingProfiles: snake_case row → camelCase 프로필 (pass)
 *  - listEsmShippingProfiles: select error → EsmShippingProfileError (fail)
 *  - createEsmShippingProfile: 성공 응답 parse (pass)
 *  - createEsmShippingProfile: Edge err 본문(code/message) → EsmShippingProfileError (fail)
 *  - createEsmShippingProfile: 잘못된 입력 zod parse 차단 (fail)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EsmShippingProfileCreateInput } from '@/lib/schemas/esm'

const orderMock = vi.fn()
const eqMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()
const invokeMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: fromMock,
    functions: { invoke: invokeMock },
  }),
}))

import {
  listEsmShippingProfiles,
  createEsmShippingProfile,
  EsmShippingProfileError,
} from '../api/esm-shipping-profile-api'

const SELLER_ID = '00000000-0000-4000-8000-000000000001'
const ACCOUNT_ID = '00000000-0000-4000-8000-000000001003'

function makeRow(over: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    seller_id: SELLER_ID,
    market_account_id: ACCOUNT_ID,
    site: 'G',
    profile_label: '기본 출고지',
    addr_no: 'ADDR-1',
    place_no: 'PLACE-1',
    bundle_policy_no: 'BUNDLE-1',
    dispatch_policy_no: 'DISP-1',
    dispatch_type: 'B',
    shipping_fee: 3000,
    fee_type: 1,
    status: 'active',
    created_at: '2026-05-30T00:00:00.000+09:00',
    updated_at: '2026-05-30T00:00:00.000+09:00',
    ...over,
  }
}

const VALID_INPUT: EsmShippingProfileCreateInput = {
  marketAccountId: ACCOUNT_ID,
  site: 'G',
  profileLabel: '기본 출고지',
  dispatchType: 'B',
  shippingFee: 3000,
  feeType: 1,
  address: {
    zipCode: '06236',
    addressMain: '서울 강남구 테헤란로 123',
    contactName: '홍길동',
    contactPhone: '010-1234-5678',
  },
}

beforeEach(() => {
  orderMock.mockReset()
  eqMock.mockReset()
  selectMock.mockReset()
  fromMock.mockReset()
  invokeMock.mockReset()
  // builder chain: from().select().eq('status','active')[.eq('market_account_id')].order()
  // status='active' 필터가 항상 선행, marketAccountId 는 조건부, order 가 최종 await 대상.
  fromMock.mockReturnValue({ select: selectMock })
  selectMock.mockReturnValue({ eq: eqMock })
  eqMock.mockReturnValue({ eq: eqMock, order: orderMock })
})

describe('listEsmShippingProfiles', () => {
  it('pass: snake_case row 를 camelCase 프로필로 변환', async () => {
    orderMock.mockResolvedValueOnce({ data: [makeRow()], error: null })
    const result = await listEsmShippingProfiles()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: '00000000-0000-4000-8000-0000000000aa',
      sellerId: SELLER_ID,
      marketAccountId: ACCOUNT_ID,
      site: 'G',
      profileLabel: '기본 출고지',
      dispatchPolicyNo: 'DISP-1',
      shippingFee: 3000,
      feeType: 1,
    })
    expect(fromMock).toHaveBeenCalledWith('esm_shipping_profiles')
  })

  it('pass: status=active 필터 + marketAccountId 지정 시 eq 필터 적용', async () => {
    orderMock.mockResolvedValueOnce({ data: [], error: null })
    const result = await listEsmShippingProfiles(ACCOUNT_ID)
    expect(eqMock).toHaveBeenCalledWith('status', 'active')
    expect(eqMock).toHaveBeenCalledWith('market_account_id', ACCOUNT_ID)
    expect(result).toEqual([])
  })

  it('fail: select error → EsmShippingProfileError', async () => {
    orderMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'rls denied' },
    })
    await expect(listEsmShippingProfiles()).rejects.toBeInstanceOf(
      EsmShippingProfileError,
    )
  })
})

describe('createEsmShippingProfile', () => {
  it('pass: 성공 응답을 EsmShippingProfileSchema 로 parse', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        id: '00000000-0000-4000-8000-0000000000bb',
        sellerId: SELLER_ID,
        marketAccountId: ACCOUNT_ID,
        site: 'G',
        profileLabel: '기본 출고지',
        addrNo: 'ADDR-1',
        placeNo: 'PLACE-1',
        bundlePolicyNo: 'BUNDLE-1',
        dispatchPolicyNo: 'DISP-1',
        dispatchType: 'B',
        shippingFee: 3000,
        feeType: 1,
        status: 'active',
        createdAt: '2026-05-30T00:00:00.000+09:00',
        updatedAt: '2026-05-30T00:00:00.000+09:00',
      },
      error: null,
    })
    const result = await createEsmShippingProfile(VALID_INPUT)
    expect(result.id).toBe('00000000-0000-4000-8000-0000000000bb')
    expect(invokeMock).toHaveBeenCalledWith('esm-shipping-profile', {
      body: expect.objectContaining({ marketAccountId: ACCOUNT_ID }),
    })
  })

  it('fail: Edge err 본문(code/message) → EsmShippingProfileError(code 보존)', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        code: 'profile_label_duplicate',
        message: '동일 라벨의 배송 프로필이 이미 존재합니다',
      },
      error: null,
    })
    await expect(createEsmShippingProfile(VALID_INPUT)).rejects.toMatchObject({
      code: 'profile_label_duplicate',
    })
  })

  it('fail: 잘못된 입력은 zod 에서 차단 (Edge 호출 전)', async () => {
    const bad = {
      ...VALID_INPUT,
      profileLabel: '',
    } as EsmShippingProfileCreateInput
    await expect(createEsmShippingProfile(bad)).rejects.toBeInstanceOf(Error)
    expect(invokeMock).not.toHaveBeenCalled()
  })
})
