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

// ESM 공식 주문조회 응답 (esm-api/order-shipping/67.md — PascalCase, RequestOrders).
const ESM_HAPPY_RESPONSE = {
  ResultCode: 0,
  Message: '',
  Data: {
    SiteType: 2,
    TotalCount: 1,
    SellerId: 'gmarket-seller',
    RequestOrders: [
      {
        OrderNo: 'ESM-2026052100000001',
        OrderStatus: 1,
        BuyerName: '이서연',
        ReceiverName: '이서연',
        ZipCode: '06236',
        DelFullAddress: '서울특별시 강남구 강남대로 100, 5층',
        HpNo: '010-7777-1111',
        GoodsName: '테스트 ESM 상품',
        ContrAmount: 1,
        OrderAmount: '18000.0000',
        OrderDate: '2026-05-21T01:00:00',
        PayDate: '2026-05-21T01:00:00',
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
  it('happy: ResultCode=0 응답 → ok=true (esm-api/.../70.md)', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: true,
        status: 200,
        body: { ResultCode: 0, Message: 'Success', Data: { OrderNo: 2503423671 } },
      },
    ]) as unknown as typeof fetch

    const result = await gmarketSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_GMARKET_CRED,
    )
    expect(() => MarketSubmitTrackingResultSchema.parse(result)).not.toThrow()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.dispatchId).toBe('2503423671')
    }
  })

  it('200 + ResultCode=3000 (정상 거부) → ok=false + errorCode', async () => {
    globalThis.fetch = makeFetchMock([
      {
        ok: true,
        status: 200,
        body: { ResultCode: 3000, Message: '해당 주문 내역이 없습니다.' },
      },
    ]) as unknown as typeof fetch

    const result = await gmarketSubmitTracking(
      VALID_TRACKING_INPUT,
      VALID_GMARKET_CRED,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('3000')
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
