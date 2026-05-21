/**
 * logen-register-shipment 본체 처리:
 *   1) 자격증명 + orders 로드
 *   2) getSlipNo(slipQty = N) — 재시도 3회 (1s, 4s, 9s)
 *   3) registerOrderData(주문 × N) — Promise.allSettled + 주문별 재시도 3회
 *   4) DB 전이 + 결과 집계
 *
 * 강제:
 *   - 1개 주문 실패가 다른 주문 진행을 막지 않음 (allSettled).
 *   - 모든 외부 호출은 구조화 로그 + correlationId 부착.
 *   - 자격증명 평문은 본 함수 스코프 종료 시 GC 대상으로만 존재 (반환 / 로깅 금지).
 */

import { MarketError, type Logger } from '../../_shared/index.ts'
import type { getServiceClient } from '../../_shared/supabase.ts'
import type { LogenClient } from './client.ts'
import { markOrderFailed, markOrderRegistered } from './db-update.ts'
import { loadLogenCredential } from './load-credential.ts'
import { loadOrdersForRegister } from './load-orders.ts'
import { withLogenRetry } from './retry-backoff.ts'
import { buildRegisterPayload, todayYYYYMMDD } from './transform.ts'
import type { LogenCredential, OrderForRegister } from './types.ts'

type Service = ReturnType<typeof getServiceClient>

export interface ProcessInput {
  service: Service
  sellerId: string
  orderIds: string[]
  client: LogenClient
  correlationId: string
  logger: Logger
  /** 테스트에서 sleep 단축. */
  sleep?: (ms: number) => Promise<void>
}

export interface OrderResult {
  orderId: string
  status: 'registered' | 'failed' | 'skipped'
  slipNo?: string
  fixTakeNo?: string
  errorCode?: string
  errorMessage?: string
}

export interface ProcessResult {
  registered: number
  failed: number
  skipped: number
  results: OrderResult[]
}

/**
 * slipNo 배열 산출 — getSlipNo 응답이 slipNo[] 를 직접 주면 그것을 사용, 누락 시
 * startSlipNo ~ closeSlipNo 범위에서 숫자 연속 생성 (zero-padded 길이 = startSlipNo 길이).
 */
export function expandSlipNoRange(
  startSlipNo: string,
  closeSlipNo: string,
): string[] {
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

export async function processRegistration(
  input: ProcessInput,
): Promise<ProcessResult> {
  const { service, sellerId, orderIds, client, correlationId, logger } = input

  // 1. 자격증명 + 주문 로드 (병렬)
  const [credential, orders] = await Promise.all([
    loadLogenCredential({ service, sellerId, correlationId, logger }),
    loadOrdersForRegister(service, sellerId, orderIds, logger),
  ])

  if (orders.length === 0) {
    logger.info({ sellerId, requested: orderIds.length }, 'no eligible orders')
    return { registered: 0, failed: 0, skipped: orderIds.length, results: [] }
  }

  // 2. getSlipNo (slipQty = eligible orders)
  const slipResp = await withLogenRetry(
    () => client.getSlipNo({ userId: credential.userId, slipQty: orders.length }),
    {
      correlationId,
      logger,
      op: 'getSlipNo',
      sleep: input.sleep,
    },
  )

  const slipNos = slipResp.slipNo && slipResp.slipNo.length === orders.length
    ? slipResp.slipNo
    : expandSlipNoRange(slipResp.startSlipNo, slipResp.closeSlipNo)

  if (slipNos.length < orders.length) {
    // 채번 부족 — 전체 실패 처리 (자격증명/계약 문제 가능성)
    logger.error(
      {
        sellerId,
        requested: orders.length,
        issued: slipNos.length,
      },
      'getSlipNo issued less than requested',
    )
    const err = new MarketError(
      'server',
      'getSlipNo issued insufficient slipNo',
      { market: 'logen' },
    )
    const failedResults: OrderResult[] = []
    for (const order of orders) {
      await markOrderFailed({ service, sellerId, orderId: order.id, err, logger })
      failedResults.push({
        orderId: order.id,
        status: 'failed',
        errorCode: 'server',
        errorMessage: err.message,
      })
    }
    return {
      registered: 0,
      failed: orders.length,
      skipped: orderIds.length - orders.length,
      results: failedResults,
    }
  }

  // 3. registerOrderData 병렬 + 주문별 재시도
  const takeDt = todayYYYYMMDD()
  const tasks = orders.map((order, idx) => {
    const slipNo = slipNos[idx]
    if (slipNo === undefined) {
      // 위 slipNos.length < orders.length 가드로 도달 불가. 안전망.
      return Promise.resolve<OrderResult>({
        orderId: order.id,
        status: 'failed',
        errorCode: 'server',
        errorMessage: 'slipNo missing',
      })
    }
    return registerOne({
      service,
      sellerId,
      order,
      slipNo,
      credential,
      takeDt,
      client,
      correlationId,
      logger,
      sleep: input.sleep,
    })
  })

  const settled = await Promise.allSettled(tasks)

  const results: OrderResult[] = settled.map((s, idx) => {
    if (s.status === 'fulfilled') {
      return s.value
    }
    const order = orders[idx]
    // task 자체가 throw 한 경우 — registerOne 내부에서 모두 catch 처리하지만 안전망.
    const err = s.reason
    const errorCode = err instanceof MarketError ? err.code : 'unknown'
    const errorMessage =
      err instanceof MarketError ? err.message : 'logen register failed'
    return {
      orderId: order?.id ?? 'unknown',
      status: 'failed',
      errorCode,
      errorMessage,
    }
  })

  const registered = results.filter((r) => r.status === 'registered').length
  const failed = results.filter((r) => r.status === 'failed').length

  return {
    registered,
    failed,
    skipped: orderIds.length - orders.length,
    results,
  }
}

/**
 * 단일 주문 등록 — 재시도 포함. 모든 실패는 catch 해서 OrderResult 로 반환.
 */
async function registerOne(args: {
  service: Service
  sellerId: string
  order: OrderForRegister
  slipNo: string
  credential: LogenCredential
  takeDt: string
  client: LogenClient
  correlationId: string
  logger: Logger
  sleep?: (ms: number) => Promise<void>
}): Promise<OrderResult> {
  const { service, sellerId, order, slipNo, credential, takeDt, client, correlationId, logger } = args

  const payload = buildRegisterPayload({ credential, order, slipNo, takeDt })

  try {
    const resp = await withLogenRetry(
      () => client.registerOrderData(payload),
      {
        correlationId,
        logger,
        op: 'registerOrderData',
        sleep: args.sleep,
      },
    )

    try {
      await markOrderRegistered({
        service,
        sellerId,
        orderId: order.id,
        fixTakeNo: resp.fixTakeNo,
        slipNo,
        logger,
      })
    } catch {
      // DB update 실패 — 데이터 정합 위협이지만 잡 자체는 진행. 실패로 분류.
      return {
        orderId: order.id,
        status: 'failed',
        errorCode: 'server',
        errorMessage: 'order update failed',
      }
    }

    return {
      orderId: order.id,
      status: 'registered',
      slipNo,
      fixTakeNo: resp.fixTakeNo,
    }
  } catch (err) {
    await markOrderFailed({ service, sellerId, orderId: order.id, err, logger })
    const errorCode = err instanceof MarketError ? err.code : 'unknown'
    const errorMessage =
      err instanceof MarketError ? err.message : 'logen register failed'
    return {
      orderId: order.id,
      status: 'failed',
      errorCode,
      errorMessage,
    }
  }
}
