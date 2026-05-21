/**
 * 옥션 ESM 2.0 fetchOrders + submitTracking 단위 테스트 (v2 확장).
 *
 * 본 spec 은 site='A' 분기를 검증한다. ESM 공용 로직은 esm/orders.ts.
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
import { auctionFetchOrders } from '../orders'
import { auctionSubmitTracking } from '../tracking'

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

const VALID_AUCTION_CRED: StoredCredential = {
  kind: 'esm_jwt',
  payload: {
    masterId: 'esm-master',
    secretKey: 'esm-secret',
    sellerId: 'auction-seller',
    site: 'A',
  },
}

const WRONG_SITE_CRED: StoredCredential = {
  kind: 'esm_jwt',
  payload: {
    masterId: 'esm-master',
    secretKey: 'esm-secret',
    sellerId: 'gmarket-seller',
    site: 'G',
  },
}

const VALID_FETCH_INPUT = {
  sellerId: '22222222-2222-2222-2222-222222222222',
}

const VALID_TRACKING_INPUT = {
  externalOrderId: 'ESM-AUCTION-0001',
  waybillNumber: '444455556666',
  carrierCode: 'LOGEN' as const,
}

const ESM_HAPPY_RESPONSE = {
  resultCode: '0000',
  resultMessage: 'OK',
  data: {
    orders: [
      {
        orderNo: 'ESM-AUCTION-0001',
        buyerName: '정민호',
        receiverName: '정민호',
        receiverZipCode: '03187',
        receiverAddress: '서울특별시 종로구 종로 1',
        receiverPhone: '010-5555-6666',
        itemName: '옥션 테스트 상품',
        orderQty: 2,
        orderPrice: 12000,
        orderStatus: 'PAID',
        paidDate: '2026-05-21T05:00:00+00:00',
      },
    ],
  },
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

describe('auctionFetchOrders (site=A)', () => {
  it('happy: ESM 응답 → MarketOrder[] 정규화 (market=auction)', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: true, status: 200, body: ESM_HAPPY_RESPONSE },
    ]) as unknown as typeof fetch

    const orders = await auctionFetchOrders(VALID_FETCH_INPUT, VALID_AUCTION_CRED)
    expect(orders.length).toBe(1)
    const order = orders[0]
    if (!order) throw new Error('order missing')
    expect(() => MarketOrderSchema.parse(order)).not.toThrow()
    expect(order.market).toBe('auction')
    expect(order.status).toBe('new_pay')
  })

  it('site 불일치 자격증명 → MarketError("validation")', async () => {
    await expect(
      auctionFetchOrders(VALID_FETCH_INPUT, WRONG_SITE_CRED),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('credential 누락 → MarketError("unauthorized")', async () => {
    await expect(
      auctionFetchOrders(VALID_FETCH_INPUT, undefined),
    ).rejects.toBeInstanceOf(MarketError)
  })
})

describe('auctionSubmitTracking (site=A)', () => {
  it('happy: resultCode=SUCCESS → ok=true', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: true,
        status: 200,
        body: { resultCode: 'SUCCESS', resultMessage: 'OK' },
      },
    ]) as unknown as typeof fetch

    const result = await auctionSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_AUCTION_CRED,
    )
    expect(() => MarketSubmitTrackingResultSchema.parse(result)).not.toThrow()
    expect(result.ok).toBe(true)
  })

  it('422 응답 (정상 거부) → ok=false', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: false,
        status: 422,
        body: { resultCode: 'INVALID_INVOICE', resultMessage: '송장 번호 형식 오류' },
      },
    ]) as unknown as typeof fetch

    const result = await auctionSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_AUCTION_CRED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('INVALID_INVOICE')
    }
  })

  it('5xx 응답 → MarketError("server")', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 500, body: { message: 'oops' } },
    ]) as unknown as typeof fetch

    await expect(
      auctionSubmitTracking(VALID_TRACKING_INPUT, VALID_AUCTION_CRED),
    ).rejects.toMatchObject({ code: 'server' })
  })
})
