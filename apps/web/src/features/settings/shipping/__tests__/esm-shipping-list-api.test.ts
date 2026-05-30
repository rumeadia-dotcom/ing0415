/**
 * esm-shipping-list-api 단위 테스트 (PR-E2 frontend, 조회형 전환).
 *
 * 마스터: docs/architecture/v1/features/esm.md "전환 결정 2026-05-30" / PR-E2
 *
 * 커버리지:
 *  - getEsmShippingOptions: POST { marketAccountId } body 로 esm-shipping-list 호출 (호출 규약)
 *  - 200 응답 → EsmShippingListResponseSchema parse (pass)
 *  - 빈 목록(ESM Plus 미등록)은 에러 아님 (pass — empty)
 *  - Edge err 본문(code/message) → EsmShippingListError(code 보존) (fail)
 *  - FunctionsHttpError(error.context Response) 본문 파싱 (fail)
 *  - 응답이 스키마 위반(PII 등 잘못된 필드)이면 parse throw (fail)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: invokeMock },
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  getEsmShippingOptions,
  EsmShippingListError,
} from '../api/esm-shipping-list-api'

const ACCOUNT_ID = '00000000-0000-4000-8000-000000001003'

function validResponse() {
  return {
    site: 'G' as const,
    places: [{ placeNo: '1001', placeName: '기본 출하지', isDefault: true }],
    dispatchPolicies: [
      {
        site: 'G' as const,
        dispatchPolicyNo: '2001',
        dispatchPolicyName: '오늘출발',
        dispatchType: 'A' as const,
        isDefault: true,
      },
    ],
  }
}

beforeEach(() => {
  invokeMock.mockReset()
})

describe('getEsmShippingOptions', () => {
  it('pass: POST { marketAccountId } body 로 호출 + 200 응답 parse', async () => {
    invokeMock.mockResolvedValueOnce({ data: validResponse(), error: null })
    const result = await getEsmShippingOptions(ACCOUNT_ID)
    expect(invokeMock).toHaveBeenCalledWith('esm-shipping-list', {
      body: { marketAccountId: ACCOUNT_ID },
    })
    expect(result.places).toHaveLength(1)
    expect(result.dispatchPolicies[0]?.dispatchPolicyNo).toBe('2001')
    expect(result.site).toBe('G')
  })

  it('pass(empty): 빈 목록(ESM Plus 미등록)은 에러 아님', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { site: 'A', places: [], dispatchPolicies: [] },
      error: null,
    })
    const result = await getEsmShippingOptions(ACCOUNT_ID)
    expect(result.places).toEqual([])
    expect(result.dispatchPolicies).toEqual([])
  })

  it('fail: Edge err 본문(code/message) → EsmShippingListError(code 보존)', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        error: {
          code: 'esm_places_http_401',
          message: 'ESM 인증 실패',
          correlationId: 'cid-1',
        },
      },
      error: { message: 'edge non-2xx', context: undefined },
    })
    await expect(getEsmShippingOptions(ACCOUNT_ID)).rejects.toMatchObject({
      code: 'esm_places_http_401',
      correlationId: 'cid-1',
    })
  })

  it('fail: FunctionsHttpError(error.context Response) 본문에서 code 복원', async () => {
    const ctx = {
      clone: () => ({
        json: async () => ({
          error: { code: 'forbidden', message: 'not your account' },
        }),
      }),
      json: async () => ({}),
    }
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'http error', context: ctx },
    })
    await expect(getEsmShippingOptions(ACCOUNT_ID)).rejects.toMatchObject({
      code: 'forbidden',
    })
  })

  it('fail: 응답이 스키마 위반이면 parse throw', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { site: 'G', places: [{ placeNo: '', placeName: 'x', isDefault: false }], dispatchPolicies: [] },
      error: null,
    })
    await expect(getEsmShippingOptions(ACCOUNT_ID)).rejects.toBeInstanceOf(Error)
  })

  it('EsmShippingListError 인스턴스 — code/correlationId 보존', () => {
    const e = new EsmShippingListError({
      code: 'internal',
      message: 'x',
      correlationId: 'c',
    })
    expect(e).toBeInstanceOf(EsmShippingListError)
    expect(e.code).toBe('internal')
    expect(e.correlationId).toBe('c')
  })
})
