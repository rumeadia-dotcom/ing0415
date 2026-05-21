/**
 * 네이버 fetchOrders + submitTracking 단위 테스트 (v2 확장).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1, §6.4
 *
 * fetchOrders 카테고리:
 *   - happy: NEW_PAY_WAITING 목록 → MarketOrder[] 정규화 (status='new_pay').
 *   - oauth credential 누락 → MarketError('unauthorized').
 *   - 5xx 응답 → MarketError('server').
 *   - 401 응답 → MarketError('unauthorized').
 *   - 429 응답 → MarketError('rate_limit') + retryAfterMs.
 *
 * submitTracking 카테고리:
 *   - happy: 200 → ok=true.
 *   - 400/422 (마켓 정상 거부) → ok=false + errorCode.
 *   - 401 → MarketError('unauthorized') throw.
 *   - 입력 검증 실패 (빈 waybillNumber) → MarketError('validation').
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MarketError } from '@/lib/markets/errors'
import {
  MarketOrderSchema,
  MarketSubmitTrackingResultSchema,
  type StoredCredential,
} from '@/lib/schemas'
import {
  naverFetchOrders,
  naverSubmitTracking,
  normalizeNaverStatus,
} from '../orders'

// fixture 인라인 (tests/fixtures/orders/naver-orders-happy.json 의 data 부분과 동기 유지).
const NAVER_HAPPY_RESPONSE = {
  data: [
    {
      productOrderId: '2026052100000001',
      orderId: '2026052100000001-01',
      buyerName: '홍길동',
      shippingAddress: {
        name: '홍길동',
        tel1: '010-1234-5678',
        baseAddress: '서울특별시 강남구 테헤란로 1',
        detailAddress: '타워 5F',
      },
      productName: '테스트 상품 A',
      quantity: 2,
      totalPaymentAmount: 24000,
      productOrderStatus: 'PAYED',
      paymentDate: '2026-05-21T03:00:00+00:00',
    },
    {
      productOrderId: '2026052100000002',
      orderId: '2026052100000002-01',
      buyerName: '김철수',
      shippingAddress: {
        name: '김철수',
        tel1: '010-9999-8888',
        baseAddress: '부산광역시 해운대구 센텀로 99',
        detailAddress: '',
      },
      productName: '테스트 상품 B',
      quantity: 1,
      totalPaymentAmount: 50000,
      productOrderStatus: 'PAYED',
      paymentDate: '2026-05-21T04:15:00+00:00',
    },
  ],
}

const ORIGINAL_FETCH = globalThis.fetch

function makeFetchMock(responses: { ok: boolean; status: number; body: unknown }[]) {
  let idx = 0
  return vi.fn().mockImplementation(() => {
    const r = responses[idx] ?? responses[responses.length - 1]
    idx++
    if (!r) throw new Error('no response')
    const text = typeof r.body === 'string' ? r.body : JSON.stringify(r.body)
    return Promise.resolve({
      ok: r.ok,
      status: r.status,
      text: () => Promise.resolve(text),
      json: () => Promise.resolve(r.body),
    })
  })
}

const VALID_OAUTH_CRED: StoredCredential = {
  kind: 'oauth',
  payload: {
    accessToken: 'naver-access-token',
    refreshToken: 'naver-refresh-token',
    expiresAt: '2027-01-01T00:00:00+00:00',
    tokenType: 'Bearer',
  },
  expiresAt: '2027-01-01T00:00:00+00:00',
}

const VALID_FETCH_INPUT = {
  sellerId: '22222222-2222-2222-2222-222222222222',
}

const VALID_TRACKING_INPUT = {
  externalOrderId: '2026052100000001',
  waybillNumber: '123456789012',
  carrierCode: 'LOGEN' as const,
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

// ─────────────────────────────────────────────
// normalizeNaverStatus 단위 테스트 (순수 함수)
// ─────────────────────────────────────────────

describe('normalizeNaverStatus', () => {
  it('PAYED → new_pay', () => {
    expect(normalizeNaverStatus('PAYED')).toBe('new_pay')
  })
  it('DISPATCHED → dispatched', () => {
    expect(normalizeNaverStatus('DISPATCHED')).toBe('dispatched')
  })
  it('알 수 없는 값 → unknown (안전 fallback)', () => {
    expect(normalizeNaverStatus('XX_FOO')).toBe('unknown')
  })
})

// ─────────────────────────────────────────────
// naverFetchOrders
// ─────────────────────────────────────────────

describe('naverFetchOrders', () => {
  it('happy: fixture 응답 → MarketOrder[] (status=new_pay) 정규화', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: true, status: 200, body: NAVER_HAPPY_RESPONSE },
    ]) as unknown as typeof fetch

    const orders = await naverFetchOrders(VALID_FETCH_INPUT, VALID_OAUTH_CRED)
    expect(orders.length).toBe(2)
    for (const o of orders) {
      expect(() => MarketOrderSchema.parse(o)).not.toThrow()
      expect(o.market).toBe('naver')
      expect(o.status).toBe('new_pay')
    }
    expect(orders[0]?.externalOrderId).toBe('2026052100000001')
    expect(orders[0]?.buyerName).toBe('홍길동')
    expect(orders[0]?.receiverAddress).toContain('테헤란로')
    expect(orders[0]?.quantity).toBe(2)
  })

  it('oauth credential 누락 → MarketError("unauthorized")', async () => {
    await expect(
      naverFetchOrders(VALID_FETCH_INPUT, undefined),
    ).rejects.toBeInstanceOf(MarketError)
  })

  it('5xx 응답 → MarketError("server")', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 503, body: { message: 'down' } },
    ]) as unknown as typeof fetch

    await expect(
      naverFetchOrders(VALID_FETCH_INPUT, VALID_OAUTH_CRED),
    ).rejects.toMatchObject({ code: 'server' })
  })

  it('401 응답 → MarketError("unauthorized")', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 401, body: { message: 'token expired' } },
    ]) as unknown as typeof fetch

    await expect(
      naverFetchOrders(VALID_FETCH_INPUT, VALID_OAUTH_CRED),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('429 응답 → MarketError("rate_limit") + retryAfterMs > 0', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 429, body: { message: 'too many' } },
    ]) as unknown as typeof fetch

    try {
      await naverFetchOrders(VALID_FETCH_INPUT, VALID_OAUTH_CRED)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(MarketError)
      const err = e as MarketError
      expect(err.code).toBe('rate_limit')
      expect(err.context.retryAfterMs).toBeGreaterThan(0)
    }
  })
})

// ─────────────────────────────────────────────
// naverSubmitTracking
// ─────────────────────────────────────────────

describe('naverSubmitTracking', () => {
  it('happy: 200 응답 → ok=true', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: true, status: 200, body: { dispatchId: 'D-12345' } },
    ]) as unknown as typeof fetch

    const result = await naverSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_OAUTH_CRED,
    )
    expect(() => MarketSubmitTrackingResultSchema.parse(result)).not.toThrow()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.dispatchId).toBe('D-12345')
    }
  })

  it('400 응답 (마켓 정상 거부) → ok=false + errorCode (throw X)', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: false,
        status: 400,
        body: { code: 'already_dispatched', message: '이미 발송' },
      },
    ]) as unknown as typeof fetch

    const result = await naverSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_OAUTH_CRED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('already_dispatched')
      expect(result.errorMessage).toBe('이미 발송')
    }
  })

  it('401 응답 → MarketError("unauthorized") throw (횡단 실패)', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 401, body: { message: 'token expired' } },
    ]) as unknown as typeof fetch

    await expect(
      naverSubmitTracking(VALID_TRACKING_INPUT, VALID_OAUTH_CRED),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('빈 waybillNumber → MarketError("validation") (입력 zod 거부)', async () => {
    await expect(
      naverSubmitTracking(
        {
          externalOrderId: '2026052100000001',
          waybillNumber: '',
          carrierCode: 'LOGEN',
        },
        VALID_OAUTH_CRED,
      ),
    ).rejects.toMatchObject({ code: 'validation' })
  })
})
