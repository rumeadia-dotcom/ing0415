/**
 * G마켓 ESM 2.0 fetchOrders + submitTracking 단위 테스트 (v2 확장).
 *
 * 본 spec 은 site='G' 분기를 검증한다. ESM 공용 로직은 esm/orders.ts.
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
import { gmarketFetchOrders } from '../orders'
import { gmarketSubmitTracking } from '../tracking'

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

const VALID_GMARKET_CRED: StoredCredential = {
  kind: 'esm_jwt',
  payload: {
    masterId: 'esm-master',
    secretKey: 'esm-secret',
    sellerId: 'gmarket-seller',
    site: 'G',
  },
}

// site 불일치 케이스
const WRONG_SITE_CRED: StoredCredential = {
  kind: 'esm_jwt',
  payload: {
    masterId: 'esm-master',
    secretKey: 'esm-secret',
    sellerId: 'auction-seller',
    site: 'A',
  },
}

const VALID_FETCH_INPUT = {
  sellerId: '22222222-2222-2222-2222-222222222222',
}

const VALID_TRACKING_INPUT = {
  externalOrderId: 'ESM-2026052100000001',
  waybillNumber: '111122223333',
  carrierCode: 'LOGEN' as const,
}

const ESM_HAPPY_RESPONSE = {
  resultCode: '0000',
  resultMessage: 'OK',
  data: {
    orders: [
      {
        orderNo: 'ESM-2026052100000001',
        buyerName: '이서연',
        receiverName: '이서연',
        receiverZipCode: '06236',
        receiverAddress: '서울특별시 강남구 강남대로 100, 5층',
        receiverPhone: '010-7777-1111',
        itemName: '테스트 ESM 상품',
        orderQty: 1,
        orderPrice: 18000,
        orderStatus: 'PAID',
        paidDate: '2026-05-21T01:00:00+00:00',
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

describe('gmarketFetchOrders (site=G)', () => {
  it('happy: ESM 응답 → MarketOrder[] 정규화 (market=gmarket)', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: true, status: 200, body: ESM_HAPPY_RESPONSE },
    ]) as unknown as typeof fetch

    const orders = await gmarketFetchOrders(VALID_FETCH_INPUT, VALID_GMARKET_CRED)
    expect(orders.length).toBe(1)
    const order = orders[0]
    if (!order) throw new Error('order missing')
    expect(() => MarketOrderSchema.parse(order)).not.toThrow()
    expect(order.market).toBe('gmarket')
    expect(order.status).toBe('new_pay')
    expect(order.externalOrderId).toBe('ESM-2026052100000001')
  })

  it('site 불일치 자격증명 → MarketError("validation")', async () => {
    await expect(
      gmarketFetchOrders(VALID_FETCH_INPUT, WRONG_SITE_CRED),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('credential 누락 → MarketError("unauthorized")', async () => {
    await expect(
      gmarketFetchOrders(VALID_FETCH_INPUT, undefined),
    ).rejects.toBeInstanceOf(MarketError)
  })

  it('5xx 응답 → MarketError("server")', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 502, body: { message: 'bad gateway' } },
    ]) as unknown as typeof fetch

    await expect(
      gmarketFetchOrders(VALID_FETCH_INPUT, VALID_GMARKET_CRED),
    ).rejects.toMatchObject({ code: 'server' })
  })
})

describe('gmarketSubmitTracking (site=G)', () => {
  it('happy: resultCode=0000 응답 → ok=true', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: true,
        status: 200,
        body: { resultCode: '0000', resultMessage: 'OK', data: { shipNo: 'S-1' } },
      },
    ]) as unknown as typeof fetch

    const result = await gmarketSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_GMARKET_CRED,
    )
    expect(() => MarketSubmitTrackingResultSchema.parse(result)).not.toThrow()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.dispatchId).toBe('S-1')
    }
  })

  it('200 + resultCode=ERR_DUP → ok=false + errorCode', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: true,
        status: 200,
        body: { resultCode: 'ERR_DUP', resultMessage: '이미 발송' },
      },
    ]) as unknown as typeof fetch

    const result = await gmarketSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_GMARKET_CRED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('ERR_DUP')
    }
  })

  it('401 응답 → MarketError("unauthorized")', async () => {
    globalThis.fetch = makeFetchMock([
      { ok: false, status: 401, body: { message: 'jwt invalid' } },
    ]) as unknown as typeof fetch

    await expect(
      gmarketSubmitTracking(VALID_TRACKING_INPUT, VALID_GMARKET_CRED),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('site 불일치 자격증명 → MarketError("validation")', async () => {
    await expect(
      gmarketSubmitTracking(VALID_TRACKING_INPUT, WRONG_SITE_CRED),
    ).rejects.toMatchObject({ code: 'validation' })
  })
})
