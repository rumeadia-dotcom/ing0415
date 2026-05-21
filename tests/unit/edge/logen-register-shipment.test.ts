/**
 * logen-register-shipment Edge Function 단위·통합 테스트.
 *
 * 파일 위치: tests/unit/edge/logen-register-shipment.test.ts
 *
 * 마스터:
 *   - apps/api/supabase/functions/logen-register-shipment/
 *   - docs/spec/PRD-v2-shipping.md §2.2
 *   - docs/spec/user_flow-v2-shipping.md s8 n51 / n50
 *
 * Edge Function 코드는 Deno 전용 import (`npm:zod`, `.ts` 확장) 로 Vitest 가 직접 import 불가.
 * 본 테스트는 동일 알고리즘을 인라인으로 재현하여 검증한다 (coupang-edge.test.ts 패턴):
 *   - retry 지수 백오프 (1s, 4s, 9s) 정책
 *   - slipNo 범위 확장
 *   - isLogenSuccess resultCd 판정
 *   - buildRegisterPayload 필드 매핑
 *   - 전체 오케스트레이션 시나리오:
 *       T1. happy path (3건 전체 성공)
 *       T2. 부분 실패 (1건 실패 / 2건 성공)
 *       T3. 전체 실패 (모든 주문 server 에러)
 *       T4. 재시도 검증 (rate_limit 2회 후 성공)
 *       T5. unauthorized 즉시 종료 (재시도 안 함)
 *       T6. slipNo 부족 시 전체 실패
 */

import { describe, it, expect, vi } from 'vitest'

// ── inline mirror: errors / MarketError ────────────────────────────

type MarketErrorCode =
  | 'unauthorized'
  | 'rate_limit'
  | 'validation'
  | 'network'
  | 'server'
  | 'unknown'

class MarketError extends Error {
  readonly code: MarketErrorCode
  constructor(code: MarketErrorCode, message: string) {
    super(message)
    this.name = 'MarketError'
    this.code = code
  }
  get retryable(): boolean {
    return (
      this.code === 'rate_limit' ||
      this.code === 'server' ||
      this.code === 'network'
    )
  }
}

// ── inline mirror: retry-backoff.ts ────────────────────────────────

const LOGEN_BACKOFF_MS = [1_000, 4_000, 9_000] as const
const LOGEN_MAX_ATTEMPTS = 3

async function withLogenRetry<T>(
  fn: (attempt: number) => Promise<T>,
  ctx: { sleep?: (ms: number) => Promise<void> },
): Promise<T> {
  const sleep = ctx.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  let lastErr: unknown
  for (let attempt = 1; attempt <= LOGEN_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (e) {
      lastErr = e
      const retryable = e instanceof MarketError && e.retryable
      if (!retryable) throw e
      if (attempt >= LOGEN_MAX_ATTEMPTS) throw e
      const delayMs = LOGEN_BACKOFF_MS[attempt - 1] ?? 1_000
      await sleep(delayMs)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('retry: unexpected')
}

// ── inline mirror: types.ts (isLogenSuccess) ───────────────────────

const LOGEN_SUCCESS_CODES = new Set(['0000', '00', 'SUCCESS', 'OK'])
function isLogenSuccess(resultCd: string): boolean {
  const v = resultCd.trim()
  return LOGEN_SUCCESS_CODES.has(v) || LOGEN_SUCCESS_CODES.has(v.toUpperCase())
}

// ── inline mirror: process.ts expandSlipNoRange ────────────────────

function expandSlipNoRange(startSlipNo: string, closeSlipNo: string): string[] {
  const start = Number(startSlipNo)
  const close = Number(closeSlipNo)
  if (!Number.isFinite(start) || !Number.isFinite(close) || close < start) {
    return []
  }
  const pad = startSlipNo.length
  const out: string[] = []
  for (let n = start; n <= close; n += 1) {
    out.push(String(n).padStart(pad, '0'))
  }
  return out
}

// ── inline mirror: transform.ts buildRegisterPayload ───────────────

interface MockLogenCredential {
  userId: string
  custCd: string
  sender: { name: string; address: string; phone: string }
  fare: { fareTy: string; dlvFare: number }
}

interface MockOrder {
  id: string
  receiver_name: string
  receiver_address: string
  receiver_phone: string
  quantity: number
}

function buildRegisterPayload(args: {
  credential: MockLogenCredential
  order: MockOrder
  slipNo: string
  takeDt: string
}) {
  const { credential, order, slipNo, takeDt } = args
  return {
    userId: credential.userId,
    custCd: credential.custCd,
    takeDt,
    sndCustNm: credential.sender.name,
    sndCustAddr: credential.sender.address,
    sndTelNo: credential.sender.phone,
    rcvCustNm: order.receiver_name,
    rcvCustAddr: order.receiver_address,
    rcvTelNo: order.receiver_phone,
    fareTy: credential.fare.fareTy,
    qty: order.quantity,
    dlvFare: credential.fare.dlvFare,
    fixTakeNo: order.id,
    slipNo,
  }
}

// ── orchestration helper (process.ts processRegistration mirror) ────

interface MockLogenClient {
  getSlipNo(args: { userId: string; slipQty: number }): Promise<{
    startSlipNo: string
    closeSlipNo: string
    slipNo?: string[]
  }>
  registerOrderData(payload: { fixTakeNo: string }): Promise<{
    fixTakeNo: string
    resultCd: string
  }>
}

interface OrderResult {
  orderId: string
  status: 'registered' | 'failed' | 'skipped'
  slipNo?: string
  fixTakeNo?: string
  errorCode?: string
  errorMessage?: string
}

async function processRegistrationMirror(args: {
  credential: MockLogenCredential
  orders: MockOrder[]
  client: MockLogenClient
  sleep?: (ms: number) => Promise<void>
}): Promise<{
  registered: number
  failed: number
  skipped: number
  results: OrderResult[]
}> {
  const { credential, orders, client, sleep } = args
  if (orders.length === 0) {
    return { registered: 0, failed: 0, skipped: 0, results: [] }
  }

  const slipResp = await withLogenRetry(
    () => client.getSlipNo({ userId: credential.userId, slipQty: orders.length }),
    { sleep },
  )

  const slipNos =
    slipResp.slipNo && slipResp.slipNo.length === orders.length
      ? slipResp.slipNo
      : expandSlipNoRange(slipResp.startSlipNo, slipResp.closeSlipNo)

  if (slipNos.length < orders.length) {
    const err = new MarketError('server', 'getSlipNo issued insufficient slipNo')
    return {
      registered: 0,
      failed: orders.length,
      skipped: 0,
      results: orders.map((o) => ({
        orderId: o.id,
        status: 'failed',
        errorCode: 'server',
        errorMessage: err.message,
      })),
    }
  }

  const tasks = orders.map(async (order, idx) => {
    const slipNo = slipNos[idx] ?? ''
    try {
      const resp = await withLogenRetry(
        () =>
          client.registerOrderData({
            fixTakeNo: order.id,
          }),
        { sleep },
      )
      if (!isLogenSuccess(resp.resultCd)) {
        // 클라이언트 mock 이 resultCd 만 던질 경우의 fallback. 실제 client.ts 는 이미 throw.
        throw new MarketError(
          'validation',
          `logen registerOrderData failed (resultCd=${resp.resultCd})`,
        )
      }
      return {
        orderId: order.id,
        status: 'registered' as const,
        slipNo,
        fixTakeNo: resp.fixTakeNo,
      }
    } catch (err) {
      const errorCode =
        err instanceof MarketError ? err.code : 'unknown'
      const errorMessage =
        err instanceof MarketError ? err.message : 'logen register failed'
      return {
        orderId: order.id,
        status: 'failed' as const,
        errorCode,
        errorMessage,
      }
    }
  })

  const results = await Promise.all(tasks)
  return {
    registered: results.filter((r) => r.status === 'registered').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: 0,
    results,
  }
}

// ─────────────────────────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────────────────────────

function makeCredential(): MockLogenCredential {
  return {
    userId: 'LOGEN_USER_001',
    custCd: 'CUST_001',
    sender: { name: '판매자', address: '서울시 강남구 1', phone: '010-0000-0000' },
    fare: { fareTy: 'C', dlvFare: 0 },
  }
}

function makeOrders(n: number): MockOrder[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `order-${i + 1}`,
    receiver_name: `수취인${i + 1}`,
    receiver_address: `주소${i + 1}`,
    receiver_phone: `010-1111-${String(i + 1).padStart(4, '0')}`,
    quantity: 1,
  }))
}

// 빠른 sleep — 테스트에서 실제 대기 회피
const noSleep = vi.fn(async (_ms: number) => undefined)

describe('logen-register-shipment', () => {
  describe('retry-backoff', () => {
    it('U1. retryable 에러는 지정된 횟수까지 재시도 후 throw', async () => {
      const sleep = vi.fn(async (_ms: number) => undefined)
      const fn = vi
        .fn<[number], Promise<string>>()
        .mockRejectedValue(new MarketError('server', '5xx'))

      await expect(withLogenRetry(fn, { sleep })).rejects.toBeInstanceOf(MarketError)
      expect(fn).toHaveBeenCalledTimes(LOGEN_MAX_ATTEMPTS)
      // 2회 대기 (3회 시도 사이) — 1s, 4s
      expect(sleep).toHaveBeenCalledTimes(LOGEN_MAX_ATTEMPTS - 1)
      expect(sleep).toHaveBeenNthCalledWith(1, 1_000)
      expect(sleep).toHaveBeenNthCalledWith(2, 4_000)
    })

    it('U2. non-retryable 에러는 즉시 throw, 재시도 없음', async () => {
      const sleep = vi.fn(async (_ms: number) => undefined)
      const fn = vi
        .fn<[number], Promise<string>>()
        .mockRejectedValue(new MarketError('unauthorized', '401'))

      await expect(withLogenRetry(fn, { sleep })).rejects.toThrow('401')
      expect(fn).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
    })

    it('U3. 중간에 성공하면 그 결과 반환', async () => {
      const sleep = vi.fn(async (_ms: number) => undefined)
      const fn = vi
        .fn<[number], Promise<string>>()
        .mockRejectedValueOnce(new MarketError('rate_limit', '429'))
        .mockResolvedValueOnce('ok')

      const r = await withLogenRetry(fn, { sleep })
      expect(r).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('expandSlipNoRange', () => {
    it('U4. zero-padded 연속 번호 생성', () => {
      const r = expandSlipNoRange('001000', '001003')
      expect(r).toEqual(['001000', '001001', '001002', '001003'])
    })
    it('U5. close < start 면 빈 배열', () => {
      expect(expandSlipNoRange('100', '50')).toEqual([])
    })
    it('U6. 비숫자 입력은 빈 배열', () => {
      expect(expandSlipNoRange('abc', 'def')).toEqual([])
    })
  })

  describe('isLogenSuccess', () => {
    it('U7. 0000 / SUCCESS / OK 는 성공', () => {
      expect(isLogenSuccess('0000')).toBe(true)
      expect(isLogenSuccess('SUCCESS')).toBe(true)
      expect(isLogenSuccess('OK')).toBe(true)
      expect(isLogenSuccess('00')).toBe(true)
    })
    it('U8. 그 외 코드는 실패', () => {
      expect(isLogenSuccess('9999')).toBe(false)
      expect(isLogenSuccess('FAIL')).toBe(false)
    })
  })

  describe('buildRegisterPayload', () => {
    it('U9. 발송인은 자격증명에서 / 수취인은 주문에서 매핑', () => {
      const cred = makeCredential()
      const orders = makeOrders(1)
      const order = orders[0]
      if (!order) throw new Error('test setup: makeOrders failed')
      const payload = buildRegisterPayload({
        credential: cred,
        order,
        slipNo: 'S001',
        takeDt: '20260521',
      })
      expect(payload).toMatchObject({
        userId: 'LOGEN_USER_001',
        custCd: 'CUST_001',
        takeDt: '20260521',
        sndCustNm: '판매자',
        rcvCustNm: '수취인1',
        rcvCustAddr: '주소1',
        fixTakeNo: 'order-1',
        slipNo: 'S001',
        fareTy: 'C',
        dlvFare: 0,
        qty: 1,
      })
    })
  })

  // ── 통합 시나리오 ──────────────────────────────────────────────

  describe('orchestration', () => {
    it('T1. happy path — 3건 전체 성공', async () => {
      const credential = makeCredential()
      const orders = makeOrders(3)
      const client: MockLogenClient = {
        getSlipNo: vi.fn(async () => ({
          startSlipNo: '000100',
          closeSlipNo: '000102',
        })),
        registerOrderData: vi.fn(async (p) => ({
          fixTakeNo: p.fixTakeNo,
          resultCd: '0000',
        })),
      }

      const r = await processRegistrationMirror({ credential, orders, client, sleep: noSleep })
      expect(r.registered).toBe(3)
      expect(r.failed).toBe(0)
      expect(r.results.every((x) => x.status === 'registered')).toBe(true)
      expect(r.results.map((x) => x.slipNo)).toEqual(['000100', '000101', '000102'])
      expect(client.registerOrderData).toHaveBeenCalledTimes(3)
    })

    it('T2. 부분 실패 — 1건 검증 실패 / 2건 성공', async () => {
      const credential = makeCredential()
      const orders = makeOrders(3)
      const client: MockLogenClient = {
        getSlipNo: vi.fn(async () => ({
          startSlipNo: '000100',
          closeSlipNo: '000102',
        })),
        registerOrderData: vi.fn(async (p) => {
          if (p.fixTakeNo === 'order-2') {
            throw new MarketError('validation', 'invalid receiver phone')
          }
          return { fixTakeNo: p.fixTakeNo, resultCd: '0000' }
        }),
      }
      const r = await processRegistrationMirror({ credential, orders, client, sleep: noSleep })
      expect(r.registered).toBe(2)
      expect(r.failed).toBe(1)
      const failed = r.results.find((x) => x.status === 'failed')
      expect(failed?.orderId).toBe('order-2')
      expect(failed?.errorCode).toBe('validation')
    })

    it('T3. 전체 실패 — 모든 주문 server 에러 (재시도 3회 후 종료)', async () => {
      const credential = makeCredential()
      const orders = makeOrders(2)
      const client: MockLogenClient = {
        getSlipNo: vi.fn(async () => ({
          startSlipNo: '000100',
          closeSlipNo: '000101',
        })),
        registerOrderData: vi.fn(async () => {
          throw new MarketError('server', 'logen 503')
        }),
      }
      const r = await processRegistrationMirror({ credential, orders, client, sleep: noSleep })
      expect(r.registered).toBe(0)
      expect(r.failed).toBe(2)
      // 2 주문 × 3 시도 = 6
      expect(client.registerOrderData).toHaveBeenCalledTimes(6)
    })

    it('T4. 재시도 검증 — rate_limit 2회 후 성공', async () => {
      const credential = makeCredential()
      const orders = makeOrders(1)
      let calls = 0
      const client: MockLogenClient = {
        getSlipNo: vi.fn(async () => ({
          startSlipNo: '000100',
          closeSlipNo: '000100',
        })),
        registerOrderData: vi.fn(async (p) => {
          calls += 1
          if (calls < 3) {
            throw new MarketError('rate_limit', '429')
          }
          return { fixTakeNo: p.fixTakeNo, resultCd: '0000' }
        }),
      }
      const r = await processRegistrationMirror({ credential, orders, client, sleep: noSleep })
      expect(r.registered).toBe(1)
      expect(client.registerOrderData).toHaveBeenCalledTimes(3)
    })

    it('T5. unauthorized — 재시도 없이 즉시 실패', async () => {
      const credential = makeCredential()
      const orders = makeOrders(2)
      const client: MockLogenClient = {
        getSlipNo: vi.fn(async () => ({
          startSlipNo: '000100',
          closeSlipNo: '000101',
        })),
        registerOrderData: vi.fn(async () => {
          throw new MarketError('unauthorized', 'invalid userId')
        }),
      }
      const r = await processRegistrationMirror({ credential, orders, client, sleep: noSleep })
      expect(r.failed).toBe(2)
      // 재시도 안 함 → 주문당 1회
      expect(client.registerOrderData).toHaveBeenCalledTimes(2)
      expect(r.results.every((x) => x.errorCode === 'unauthorized')).toBe(true)
    })

    it('T6. slipNo 부족 — 전체 실패 처리', async () => {
      const credential = makeCredential()
      const orders = makeOrders(3)
      const client: MockLogenClient = {
        // 2건만 채번 (주문은 3건)
        getSlipNo: vi.fn(async () => ({
          startSlipNo: '000100',
          closeSlipNo: '000101',
        })),
        registerOrderData: vi.fn(),
      }
      const r = await processRegistrationMirror({ credential, orders, client, sleep: noSleep })
      expect(r.registered).toBe(0)
      expect(r.failed).toBe(3)
      expect(client.registerOrderData).not.toHaveBeenCalled()
      expect(r.results.every((x) => x.errorCode === 'server')).toBe(true)
    })

    it('T7. getSlipNo 자체가 unauthorized — 전체 throw (재시도 없음)', async () => {
      const credential = makeCredential()
      const orders = makeOrders(2)
      const client: MockLogenClient = {
        getSlipNo: vi.fn(async () => {
          throw new MarketError('unauthorized', 'invalid userId')
        }),
        registerOrderData: vi.fn(),
      }
      await expect(
        processRegistrationMirror({ credential, orders, client, sleep: noSleep }),
      ).rejects.toThrow('invalid userId')
      expect(client.registerOrderData).not.toHaveBeenCalled()
    })
  })
})
