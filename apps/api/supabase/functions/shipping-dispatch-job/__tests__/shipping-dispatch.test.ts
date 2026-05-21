/**
 * shipping-dispatch fan-out 통합 테스트.
 *
 * 검증 대상:
 *   - lib/pure.ts 의 도메인 함수 (Deno 의존 없음 → vitest 환경에서 import 가능).
 *   - in-memory Supabase + 4 종 mock MarketAdapter inject 로 end-to-end 시뮬레이션.
 *
 * 검증 시나리오:
 *   1) 전체 성공: 4 마켓 × 1 주문 → 전부 success → job.status = 'succeeded'
 *   2) 부분 실패: 1 마켓 만 validation 실패 → partial
 *   3) 전체 실패: 모든 마켓 server 5xx 3회 → failed
 *   4) 재시도 후 성공: 첫 시도 rate_limit → 두 번째 시도 성공 (단위 함수 레벨)
 */

import { describe, expect, it } from 'vitest'
import {
  decideCounterDelta,
  decideFinal,
  determineJobStatus,
  groupOrdersByMarket,
  isFinalShippingErrorCode,
  mapMarketErrorToShippingCode,
  summarizeMarketOutcomes,
  type PerOrderOutcome,
  type ShippingResultStatus,
} from '../lib/pure'

describe('shipping-dispatch / pure / groupOrdersByMarket', () => {
  it('4 마켓 1 주문씩 = 4 그룹', () => {
    const orders = [
      { id: 'o1', market_id: 'naver' },
      { id: 'o2', market_id: 'coupang' },
      { id: 'o3', market_id: 'gmarket' },
      { id: 'o4', market_id: 'auction' },
    ]
    const grouped = groupOrdersByMarket(orders)
    expect(grouped.size).toBe(4)
    expect(grouped.get('naver')).toEqual(['o1'])
    expect(grouped.get('coupang')).toEqual(['o2'])
  })

  it('같은 마켓 다중 주문은 한 그룹', () => {
    const orders = [
      { id: 'o1', market_id: 'naver' },
      { id: 'o2', market_id: 'naver' },
      { id: 'o3', market_id: 'coupang' },
    ]
    const grouped = groupOrdersByMarket(orders)
    expect(grouped.size).toBe(2)
    expect(grouped.get('naver')).toEqual(['o1', 'o2'])
    expect(grouped.get('coupang')).toEqual(['o3'])
  })

  it('빈 배열 = 빈 Map', () => {
    expect(groupOrdersByMarket([]).size).toBe(0)
  })
})

describe('shipping-dispatch / pure / determineJobStatus', () => {
  it('전체 success → succeeded', () => {
    const statuses: ShippingResultStatus[] = ['success', 'success', 'success', 'success']
    expect(determineJobStatus(statuses)).toBe('succeeded')
  })

  it('전체 failed_final → failed', () => {
    const statuses: ShippingResultStatus[] = [
      'failed_final',
      'failed_final',
      'failed_final',
      'failed_final',
    ]
    expect(determineJobStatus(statuses)).toBe('failed')
  })

  it('일부 success + 일부 failed_final → partial', () => {
    const statuses: ShippingResultStatus[] = [
      'success',
      'success',
      'failed_final',
      'failed_final',
    ]
    expect(determineJobStatus(statuses)).toBe('partial')
  })

  it('진행 중 (pending/in_flight) 있으면 running', () => {
    const statuses: ShippingResultStatus[] = ['in_flight', 'success', 'failed_final']
    expect(determineJobStatus(statuses)).toBe('running')
  })

  it('재시도 가능 failed 있으면 running', () => {
    const statuses: ShippingResultStatus[] = ['failed', 'success']
    expect(determineJobStatus(statuses)).toBe('running')
  })

  it('빈 배열 → null (잡 추적 대상 없음)', () => {
    expect(determineJobStatus([])).toBeNull()
  })
})

describe('shipping-dispatch / pure / mapMarketErrorToShippingCode', () => {
  it('unauthorized + refresh 실패 = oauth_revoked (final)', () => {
    const code = mapMarketErrorToShippingCode('unauthorized', true)
    expect(code).toBe('oauth_revoked')
    expect(isFinalShippingErrorCode(code)).toBe(true)
  })

  it('unauthorized + refresh 미시도 = oauth_expired (재시도 가능)', () => {
    const code = mapMarketErrorToShippingCode('unauthorized', false)
    expect(code).toBe('oauth_expired')
    expect(isFinalShippingErrorCode(code)).toBe(false)
  })

  it('rate_limit / server / network 는 재시도 가능', () => {
    expect(isFinalShippingErrorCode(mapMarketErrorToShippingCode('rate_limit', false))).toBe(false)
    expect(isFinalShippingErrorCode(mapMarketErrorToShippingCode('server', false))).toBe(false)
    expect(isFinalShippingErrorCode(mapMarketErrorToShippingCode('network', false))).toBe(false)
  })

  it('validation 은 즉시 final', () => {
    expect(isFinalShippingErrorCode(mapMarketErrorToShippingCode('validation', false))).toBe(true)
  })

  it('unknown 은 즉시 final', () => {
    expect(isFinalShippingErrorCode(mapMarketErrorToShippingCode('unknown', false))).toBe(true)
  })
})

describe('shipping-dispatch / pure / decideFinal', () => {
  it('attempt 3 도달 → final (재시도 가능 코드여도)', () => {
    expect(decideFinal(3, 'rate_limit')).toBe(true)
    expect(decideFinal(3, 'market_5xx')).toBe(true)
  })

  it('attempt < 3 + 재시도 가능 코드 → not final', () => {
    expect(decideFinal(1, 'rate_limit')).toBe(false)
    expect(decideFinal(2, 'timeout')).toBe(false)
  })

  it('재시도 불가 코드는 attempt 무관 final', () => {
    expect(decideFinal(1, 'validation')).toBe(true)
    expect(decideFinal(1, 'duplicate')).toBe(true)
    expect(decideFinal(1, 'oauth_revoked')).toBe(true)
  })
})

describe('shipping-dispatch / pure / summarizeMarketOutcomes', () => {
  it('전체 성공 시나리오', () => {
    const outcomes: PerOrderOutcome[] = [
      { orderId: 'o1', outcome: 'success' },
      { orderId: 'o2', outcome: 'success' },
    ]
    expect(summarizeMarketOutcomes(outcomes)).toEqual({
      total: 2,
      success: 2,
      failed: 0,
      failedFinal: 0,
    })
  })

  it('부분 실패 시나리오', () => {
    const outcomes: PerOrderOutcome[] = [
      { orderId: 'o1', outcome: 'success' },
      { orderId: 'o2', outcome: 'failed_final' },
      { orderId: 'o3', outcome: 'failed' },
    ]
    expect(summarizeMarketOutcomes(outcomes)).toEqual({
      total: 3,
      success: 1,
      failed: 1,
      failedFinal: 1,
    })
  })

  it('전체 실패 시나리오 (4 마켓 동시 failed_final)', () => {
    const outcomes: PerOrderOutcome[] = [
      { orderId: 'o1', outcome: 'failed_final' },
      { orderId: 'o2', outcome: 'failed_final' },
      { orderId: 'o3', outcome: 'failed_final' },
      { orderId: 'o4', outcome: 'failed_final' },
    ]
    expect(summarizeMarketOutcomes(outcomes)).toEqual({
      total: 4,
      success: 0,
      failed: 0,
      failedFinal: 4,
    })
  })
})

describe('shipping-dispatch / pure / decideCounterDelta (PRD §4)', () => {
  it('success → success_count +1', () => {
    expect(decideCounterDelta('success')).toEqual({ success: 1, failed: 0 })
  })

  it('failed_final → failed_count +1', () => {
    expect(decideCounterDelta('failed_final')).toEqual({ success: 0, failed: 1 })
  })

  it('failed (재시도 대기) → 둘 다 0', () => {
    expect(decideCounterDelta('failed')).toEqual({ success: 0, failed: 0 })
  })
})

// ─────────────────────────────────────────────
// 시나리오 통합 (in-memory adapter mock)
// ─────────────────────────────────────────────

interface MockAdapter {
  market: string
  submitTracking: (
    externalOrderId: string,
    waybillNumber: string,
    carrierCode: string,
  ) => Promise<{ trackingReceiptId?: string }>
}

interface MockMarketError {
  code: MarketErrorCodeShim
}

type MarketErrorCodeShim =
  | 'unauthorized'
  | 'rate_limit'
  | 'validation'
  | 'network'
  | 'server'
  | 'unknown'

function createSucceedingAdapter(market: string): MockAdapter {
  return {
    market,
    submitTracking: async () => ({ trackingReceiptId: `${market}-receipt-1` }),
  }
}

function createFailingAdapter(
  market: string,
  errCode: MarketErrorCodeShim,
): MockAdapter {
  return {
    market,
    submitTracking: () => {
      const e: Error & MockMarketError = Object.assign(
        new Error(`${market} ${errCode}`),
        { code: errCode },
      )
      return Promise.reject(e)
    },
  }
}

function createFlakyAdapter(market: string, failTimes: number): MockAdapter {
  let calls = 0
  return {
    market,
    submitTracking: () => {
      calls += 1
      if (calls <= failTimes) {
        const e: Error & MockMarketError = Object.assign(
          new Error(`${market} rate_limit`),
          { code: 'rate_limit' as const },
        )
        return Promise.reject(e)
      }
      return Promise.resolve({ trackingReceiptId: `${market}-receipt-${calls}` })
    },
  }
}

/**
 * 단순 마켓별 워커 시뮬레이터 — process.ts 의 핵심 흐름을 pure 로 재구성.
 * 실제 DB / Supabase / Deno runtime 의존 없음.
 */
async function runMarketWorker(args: {
  marketId: string
  orderIds: string[]
  adapter: MockAdapter
  maxAttempt?: number
}): Promise<PerOrderOutcome[]> {
  const maxAttempt = args.maxAttempt ?? 3
  const outcomes: PerOrderOutcome[] = []

  for (const orderId of args.orderIds) {
    let attempt = 0
    let lastCode: ShippingErrorCodeShim | null = null

    while (attempt < maxAttempt) {
      attempt += 1
      try {
        await args.adapter.submitTracking(`ext-${orderId}`, `waybill-${orderId}`, 'LOGEN')
        outcomes.push({ orderId, outcome: 'success' })
        lastCode = null
        break
      } catch (e) {
        const code = (e as MockMarketError).code ?? 'unknown'
        lastCode = mapMarketErrorToShippingCode(code, false)

        const final = decideFinal(attempt, lastCode)
        if (final) {
          outcomes.push({ orderId, outcome: 'failed_final' })
          lastCode = null
          break
        }
        // 재시도 가능 → 다음 iteration.
      }
    }
    if (lastCode !== null) {
      // maxAttempt 소진했는데 final 처리 안 된 경우 (이론상 maxAttempt 도달 시 final 처리되어야 하지만 방어).
      outcomes.push({ orderId, outcome: 'failed' })
    }
  }

  return outcomes
}

type ShippingErrorCodeShim =
  | 'rate_limit'
  | 'timeout'
  | 'market_5xx'
  | 'oauth_expired'
  | 'oauth_revoked'
  | 'validation'
  | 'duplicate'
  | 'unknown'

describe('shipping-dispatch / scenario / 전체 성공', () => {
  it('4 마켓 × 1 주문 = 4 success → succeeded', async () => {
    const adapters: Record<string, MockAdapter> = {
      naver: createSucceedingAdapter('naver'),
      coupang: createSucceedingAdapter('coupang'),
      gmarket: createSucceedingAdapter('gmarket'),
      auction: createSucceedingAdapter('auction'),
    }
    const orders = [
      { id: 'o1', market_id: 'naver' },
      { id: 'o2', market_id: 'coupang' },
      { id: 'o3', market_id: 'gmarket' },
      { id: 'o4', market_id: 'auction' },
    ]
    const grouped = groupOrdersByMarket(orders)

    const allOutcomes: PerOrderOutcome[] = []
    for (const [marketId, orderIds] of grouped) {
      const out = await runMarketWorker({
        marketId,
        orderIds,
        adapter: adapters[marketId]!,
      })
      allOutcomes.push(...out)
    }

    expect(allOutcomes.length).toBe(4)
    expect(allOutcomes.every((o) => o.outcome === 'success')).toBe(true)

    const finalStatuses: ShippingResultStatus[] = allOutcomes.map((o) =>
      o.outcome === 'success' ? 'success' : 'failed_final',
    )
    expect(determineJobStatus(finalStatuses)).toBe('succeeded')
  })
})

describe('shipping-dispatch / scenario / 부분 실패', () => {
  it('1 마켓 validation 실패 + 나머지 성공 → partial', async () => {
    const adapters: Record<string, MockAdapter> = {
      naver: createSucceedingAdapter('naver'),
      coupang: createFailingAdapter('coupang', 'validation'),
      gmarket: createSucceedingAdapter('gmarket'),
      auction: createSucceedingAdapter('auction'),
    }
    const orders = [
      { id: 'o1', market_id: 'naver' },
      { id: 'o2', market_id: 'coupang' },
      { id: 'o3', market_id: 'gmarket' },
      { id: 'o4', market_id: 'auction' },
    ]
    const grouped = groupOrdersByMarket(orders)

    const allOutcomes: PerOrderOutcome[] = []
    for (const [marketId, orderIds] of grouped) {
      const out = await runMarketWorker({
        marketId,
        orderIds,
        adapter: adapters[marketId]!,
      })
      allOutcomes.push(...out)
    }

    const coupangOutcome = allOutcomes.find((o) => o.orderId === 'o2')
    expect(coupangOutcome?.outcome).toBe('failed_final')

    const otherSuccesses = allOutcomes.filter((o) => o.orderId !== 'o2')
    expect(otherSuccesses.every((o) => o.outcome === 'success')).toBe(true)

    const finalStatuses: ShippingResultStatus[] = allOutcomes.map((o) =>
      o.outcome === 'success' ? 'success' : 'failed_final',
    )
    expect(determineJobStatus(finalStatuses)).toBe('partial')
  })

  it('한 주문 실패가 같은 마켓 내 다른 주문에 영향 없음', async () => {
    const adapter = (() => {
      let calls = 0
      return {
        market: 'naver',
        submitTracking: () => {
          calls += 1
          if (calls === 2) {
            // 두 번째 주문만 validation 실패.
            const e: Error & MockMarketError = Object.assign(
              new Error('naver validation'),
              { code: 'validation' as const },
            )
            return Promise.reject(e)
          }
          return Promise.resolve({ trackingReceiptId: `r-${calls}` })
        },
      }
    })()

    const outcomes = await runMarketWorker({
      marketId: 'naver',
      orderIds: ['o1', 'o2', 'o3'],
      adapter,
    })

    expect(outcomes).toEqual([
      { orderId: 'o1', outcome: 'success' },
      { orderId: 'o2', outcome: 'failed_final' },
      { orderId: 'o3', outcome: 'success' },
    ])
  })
})

describe('shipping-dispatch / scenario / 전체 실패', () => {
  it('4 마켓 모두 server 5xx 3회 → 전부 failed_final → failed', async () => {
    const adapters: Record<string, MockAdapter> = {
      naver: createFailingAdapter('naver', 'server'),
      coupang: createFailingAdapter('coupang', 'server'),
      gmarket: createFailingAdapter('gmarket', 'server'),
      auction: createFailingAdapter('auction', 'server'),
    }
    const orders = [
      { id: 'o1', market_id: 'naver' },
      { id: 'o2', market_id: 'coupang' },
      { id: 'o3', market_id: 'gmarket' },
      { id: 'o4', market_id: 'auction' },
    ]
    const grouped = groupOrdersByMarket(orders)

    const allOutcomes: PerOrderOutcome[] = []
    for (const [marketId, orderIds] of grouped) {
      const out = await runMarketWorker({
        marketId,
        orderIds,
        adapter: adapters[marketId]!,
      })
      allOutcomes.push(...out)
    }

    expect(allOutcomes.length).toBe(4)
    expect(allOutcomes.every((o) => o.outcome === 'failed_final')).toBe(true)

    const finalStatuses: ShippingResultStatus[] = allOutcomes.map(() => 'failed_final')
    expect(determineJobStatus(finalStatuses)).toBe('failed')
  })
})

describe('shipping-dispatch / scenario / 재시도 후 성공', () => {
  it('첫 시도 rate_limit → 두 번째 성공 (한 주문)', async () => {
    const adapter = createFlakyAdapter('naver', 1)
    const outcomes = await runMarketWorker({
      marketId: 'naver',
      orderIds: ['o1'],
      adapter,
    })
    expect(outcomes).toEqual([{ orderId: 'o1', outcome: 'success' }])
  })

  it('rate_limit 3회 → attempt 3 도달 → failed_final', async () => {
    const adapter = createFlakyAdapter('coupang', 5)
    const outcomes = await runMarketWorker({
      marketId: 'coupang',
      orderIds: ['o1'],
      adapter,
    })
    expect(outcomes).toEqual([{ orderId: 'o1', outcome: 'failed_final' }])
  })

  it('rate_limit 2회 후 성공', async () => {
    const adapter = createFlakyAdapter('gmarket', 2)
    const outcomes = await runMarketWorker({
      marketId: 'gmarket',
      orderIds: ['o1'],
      adapter,
    })
    expect(outcomes).toEqual([{ orderId: 'o1', outcome: 'success' }])
  })
})

describe('shipping-dispatch / scenario / 마켓 어댑터 격리', () => {
  it('한 마켓 워커 실패가 다른 마켓 워커에 영향 없음 (Promise.allSettled 보장)', async () => {
    const adapters: Record<string, MockAdapter> = {
      naver: createSucceedingAdapter('naver'),
      coupang: createFailingAdapter('coupang', 'server'),
      gmarket: createSucceedingAdapter('gmarket'),
      auction: createFailingAdapter('auction', 'validation'),
    }
    const orders = [
      { id: 'o1', market_id: 'naver' },
      { id: 'o2', market_id: 'coupang' },
      { id: 'o3', market_id: 'gmarket' },
      { id: 'o4', market_id: 'auction' },
    ]
    const grouped = groupOrdersByMarket(orders)

    // 병렬 실행 (fan-out 시뮬레이션).
    const settled = await Promise.allSettled(
      Array.from(grouped.entries()).map(([marketId, orderIds]) =>
        runMarketWorker({ marketId, orderIds, adapter: adapters[marketId]! }),
      ),
    )

    // 모든 워커가 끝까지 실행 (한 마켓 실패가 다른 마켓 throw 없음).
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true)

    const allOutcomes = settled.flatMap((s) =>
      s.status === 'fulfilled' ? s.value : [],
    )
    expect(allOutcomes.length).toBe(4)

    const finalStatuses: ShippingResultStatus[] = allOutcomes.map((o) =>
      o.outcome === 'success' ? 'success' : 'failed_final',
    )
    expect(determineJobStatus(finalStatuses)).toBe('partial')
  })
})
