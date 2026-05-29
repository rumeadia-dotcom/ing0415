/**
 * 쿠팡 fetchOrders + submitTracking 단위 테스트 (v2 확장).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1, §6.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MarketError } from '@/lib/markets/errors'
import {
  MarketOrderSchema,
  MarketSubmitTrackingResultSchema,
  type StoredCredential,
} from '@/lib/schemas'
import {
  COUPANG_ORDERS_MAX_PAGES,
  coupangFetchOrders,
  coupangSubmitTracking,
  normalizeCoupangStatus,
} from '../orders'

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

const VALID_HMAC_CRED: StoredCredential = {
  kind: 'hmac',
  payload: {
    accessKey: 'coupang-access-key',
    secretKey: 'coupang-secret-key',
    vendorId: 'A00012345',
  },
}

const VALID_FETCH_INPUT = {
  sellerId: '22222222-2222-2222-2222-222222222222',
}

const VALID_TRACKING_INPUT = {
  externalOrderId: '333000111',
  waybillNumber: '987654321098',
  carrierCode: 'LOGEN' as const,
}

const COUPANG_HAPPY_RESPONSE = {
  code: '200',
  message: 'OK',
  data: [
    {
      shipmentBoxId: 333000111,
      orderId: 50000000001,
      ordererName: '박영희',
      receiverAddr1: '인천광역시 연수구 송도과학로 1',
      receiverAddr2: '101동 1505호',
      receiverName: '박영희',
      receiverPhoneNumber: '010-2222-3333',
      orderItems: [
        {
          vendorItemName: '테스트 쿠팡 상품',
          shippingCount: 3,
          orderPrice: 30000,
        },
      ],
      status: 'ACCEPT',
      orderedAt: '2026-05-21T02:30:00+00:00',
    },
  ],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

describe('normalizeCoupangStatus', () => {
  it('ACCEPT → new_pay', () => {
    expect(normalizeCoupangStatus('ACCEPT')).toBe('new_pay')
  })
  it('FINAL_DELIVERY → delivered', () => {
    expect(normalizeCoupangStatus('FINAL_DELIVERY')).toBe('delivered')
  })
  it('알 수 없는 raw status → unknown', () => {
    expect(normalizeCoupangStatus('WTF')).toBe('unknown')
  })
})

const COUPANG_V5_HAPPY_RESPONSE = {
  code: 200,
  message: 'OK',
  data: [
    {
      shipmentBoxId: 333000111,
      orderId: 50000000001,
      orderedAt: '2026-05-21T02:30:00+00:00',
      paidAt: '2026-05-21T02:31:00+00:00',
      orderer: { name: '박영희', safeNumber: '+82-10-1111-2222' },
      receiver: {
        name: '박영희',
        safeNumber: '010-2222-3333',
        addr1: '인천광역시 연수구 송도과학로 1',
        addr2: '101동 1505호',
      },
      orderItems: [
        {
          vendorItemId: 12345,
          vendorItemName: '테스트 쿠팡 상품',
          shippingCount: 3,
          orderPrice: { currencyCode: 'KRW', units: 30000, nanos: 0 },
        },
      ],
      status: 'ACCEPT',
    },
  ],
}

describe('coupangFetchOrders', () => {
  it('happy (v4 flat fallback): 응답 → MarketOrder[] 정규화 + status=new_pay + 합산 금액', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: true, status: 200, body: COUPANG_HAPPY_RESPONSE },
    ]) as unknown as typeof fetch

    const orders = await coupangFetchOrders(VALID_FETCH_INPUT, VALID_HMAC_CRED)
    expect(orders.length).toBe(1)
    const order = orders[0]
    if (!order) throw new Error('order missing')
    expect(() => MarketOrderSchema.parse(order)).not.toThrow()
    expect(order.market).toBe('coupang')
    expect(order.status).toBe('new_pay')
    expect(order.externalOrderId).toBe('333000111')
    expect(order.quantity).toBe(3)
    // 30000 * 3 = 90000
    expect(order.orderAmount).toBe(90_000)
  })

  it('happy (v5 nested): orderer/receiver/Money 매핑', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: true, status: 200, body: COUPANG_V5_HAPPY_RESPONSE },
    ]) as unknown as typeof fetch

    const orders = await coupangFetchOrders(VALID_FETCH_INPUT, VALID_HMAC_CRED)
    expect(orders.length).toBe(1)
    const order = orders[0]
    if (!order) throw new Error('order missing')
    expect(() => MarketOrderSchema.parse(order)).not.toThrow()
    expect(order.market).toBe('coupang')
    expect(order.status).toBe('new_pay')
    expect(order.externalOrderId).toBe('333000111')
    expect(order.buyerName).toBe('박영희')
    expect(order.receiverName).toBe('박영희')
    expect(order.receiverAddress).toBe(
      '인천광역시 연수구 송도과학로 1 101동 1505호',
    )
    expect(order.receiverPhone).toBe('010-2222-3333')
    expect(order.quantity).toBe(3)
    expect(order.orderAmount).toBe(90_000)
  })

  it('hmac credential 누락 → MarketError("unauthorized")', async () => {
    await expect(
      coupangFetchOrders(VALID_FETCH_INPUT, undefined),
    ).rejects.toBeInstanceOf(MarketError)
  })

  it('5xx 응답 → MarketError("server")', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 503, body: { message: 'down' } },
    ]) as unknown as typeof fetch

    await expect(
      coupangFetchOrders(VALID_FETCH_INPUT, VALID_HMAC_CRED),
    ).rejects.toMatchObject({ code: 'server' })
  })

  it('429 응답 → MarketError("rate_limit") + retryAfterMs', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 429, body: { message: 'too many' } },
    ]) as unknown as typeof fetch

    try {
      await coupangFetchOrders(VALID_FETCH_INPUT, VALID_HMAC_CRED)
      throw new Error('should have thrown')
    } catch (e) {
      const err = e as MarketError
      expect(err.code).toBe('rate_limit')
      expect(err.context.retryAfterMs).toBeGreaterThan(0)
    }
  })

  // ─────────────────────────────────────────────
  // 페이징 (nextToken) — v5 follow-up 호출
  // ─────────────────────────────────────────────

  function makePageBody(args: {
    shipmentBoxId: number
    nextToken?: string
  }) {
    return {
      code: 200,
      message: 'OK',
      data: [
        {
          shipmentBoxId: args.shipmentBoxId,
          orderId: args.shipmentBoxId,
          orderedAt: '2026-05-21T02:30:00+00:00',
          paidAt: '2026-05-21T02:31:00+00:00',
          orderer: { name: '셀러', safeNumber: '+82-10-0000-0000' },
          receiver: {
            name: '수취',
            safeNumber: '010-0000-0000',
            addr1: '서울시 강남구',
            addr2: '1동 1호',
          },
          orderItems: [
            {
              vendorItemId: 1,
              vendorItemName: '상품',
              shippingCount: 1,
              orderPrice: { currencyCode: 'KRW', units: 10000, nanos: 0 },
            },
          ],
          status: 'ACCEPT',
        },
      ],
      ...(args.nextToken !== undefined ? { nextToken: args.nextToken } : {}),
    }
  }

  it('페이징: nextToken 없음 (단일 페이지) → 1회 호출 후 종료', async () => {
    const fetchMock = makeFetchMock([
      { ok: true, status: 200, body: makePageBody({ shipmentBoxId: 1 }) },
    ])
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const orders = await coupangFetchOrders(VALID_FETCH_INPUT, VALID_HMAC_CRED)
    expect(orders.length).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('페이징: 2 페이지 (nextToken="abc" → "" 종료) → 결과 concat', async () => {
    const fetchMock = makeFetchMock([
      {
        ok: true,
        status: 200,
        body: makePageBody({ shipmentBoxId: 1, nextToken: 'abc' }),
      },
      {
        ok: true,
        status: 200,
        body: makePageBody({ shipmentBoxId: 2, nextToken: '' }),
      },
    ])
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const orders = await coupangFetchOrders(VALID_FETCH_INPUT, VALID_HMAC_CRED)
    expect(orders.length).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // 2번째 호출 URL 에 nextToken=abc 포함 여부 확인.
    const secondCallUrl = fetchMock.mock.calls[1]?.[0]
    expect(typeof secondCallUrl).toBe('string')
    expect(String(secondCallUrl)).toContain('nextToken=abc')
  })

  it('페이징: MAX_PAGES (5) cap — 6 페이지째는 호출하지 않음', async () => {
    // 5 페이지 모두 nextToken 다른 값으로 응답 → MAX 도달 후 종료.
    const fetchMock = makeFetchMock([
      { ok: true, status: 200, body: makePageBody({ shipmentBoxId: 1, nextToken: 't1' }) },
      { ok: true, status: 200, body: makePageBody({ shipmentBoxId: 2, nextToken: 't2' }) },
      { ok: true, status: 200, body: makePageBody({ shipmentBoxId: 3, nextToken: 't3' }) },
      { ok: true, status: 200, body: makePageBody({ shipmentBoxId: 4, nextToken: 't4' }) },
      { ok: true, status: 200, body: makePageBody({ shipmentBoxId: 5, nextToken: 't5' }) },
      // 6번째 호출이 발생하면 안 됨 (fail-fast).
      { ok: true, status: 200, body: makePageBody({ shipmentBoxId: 99, nextToken: '' }) },
    ])
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const orders = await coupangFetchOrders(VALID_FETCH_INPUT, VALID_HMAC_CRED)
    expect(COUPANG_ORDERS_MAX_PAGES).toBe(5)
    expect(orders.length).toBe(COUPANG_ORDERS_MAX_PAGES)
    expect(fetchMock).toHaveBeenCalledTimes(COUPANG_ORDERS_MAX_PAGES)
  })

  it('페이징: 동일 nextToken 2번 연속 → MarketError("server") + nextToken_loop', async () => {
    const fetchMock = makeFetchMock([
      { ok: true, status: 200, body: makePageBody({ shipmentBoxId: 1, nextToken: 'same' }) },
      { ok: true, status: 200, body: makePageBody({ shipmentBoxId: 2, nextToken: 'same' }) },
    ])
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      await coupangFetchOrders(VALID_FETCH_INPUT, VALID_HMAC_CRED)
      throw new Error('should have thrown')
    } catch (e) {
      const err = e as MarketError
      expect(err.code).toBe('server')
      expect(err.context.marketErrorCode).toBe('nextToken_loop')
    }
  })
})

describe('coupangSubmitTracking', () => {
  it('happy (v4 /orders/invoices): responseList[0].succeed=true + resultCode=OK → ok=true', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          code: 200,
          message: 'OK',
          data: {
            responseCode: 0,
            responseMessage: 'SUCCESS',
            responseList: [
              {
                shipmentBoxId: 333000111,
                succeed: true,
                resultCode: 'OK',
                retryRequired: false,
                resultMessage: null,
              },
            ],
          },
        },
      },
    ]) as unknown as typeof fetch

    const result = await coupangSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_HMAC_CRED,
    )
    expect(() => MarketSubmitTrackingResultSchema.parse(result)).not.toThrow()
    expect(result.ok).toBe(true)
  })

  it('happy (legacy 단건 응답 fallback): resultCode=SUCCESS → ok=true', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          code: '200',
          message: 'OK',
          data: { resultCode: 'SUCCESS', resultMessage: 'OK' },
        },
      },
    ]) as unknown as typeof fetch

    const result = await coupangSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_HMAC_CRED,
    )
    expect(() => MarketSubmitTrackingResultSchema.parse(result)).not.toThrow()
    expect(result.ok).toBe(true)
  })

  it('v4 invoices 실패: responseList[0].succeed=false + resultCode → ok=false + errorCode', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: true,
        status: 200,
        body: {
          code: 200,
          message: 'OK',
          data: {
            responseCode: 99,
            responseMessage: 'FAILED',
            responseList: [
              {
                shipmentBoxId: 333000111,
                succeed: false,
                resultCode: 'DUPLICATE_INVOICE_NUMBER',
                retryRequired: true,
                resultMessage: '이미 저장된 송장번호가 있습니다.',
              },
            ],
          },
        },
      },
    ]) as unknown as typeof fetch

    const result = await coupangSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_HMAC_CRED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('DUPLICATE_INVOICE_NUMBER')
    }
  })

  it('400 응답 (마켓 정상 거부) → ok=false + errorCode', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: false,
        status: 400,
        body: { code: 'ALREADY_DISPATCHED', message: '이미 발송됨' },
      },
    ]) as unknown as typeof fetch

    const result = await coupangSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_HMAC_CRED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('ALREADY_DISPATCHED')
    }
  })

  it('401 응답 → MarketError("unauthorized") throw', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 401, body: { message: 'invalid signature' } },
    ]) as unknown as typeof fetch

    await expect(
      coupangSubmitTracking(VALID_TRACKING_INPUT, VALID_HMAC_CRED),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('빈 waybillNumber → MarketError("validation")', async () => {
    await expect(
      coupangSubmitTracking(
        {
          externalOrderId: '333000111',
          waybillNumber: '',
          carrierCode: 'LOGEN',
        },
        VALID_HMAC_CRED,
      ),
    ).rejects.toMatchObject({ code: 'validation' })
  })
})
