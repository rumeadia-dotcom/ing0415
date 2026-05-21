/**
 * 로젠 전용 지수 백오프 재시도 (1s / 4s / 9s).
 *
 * - 본 함수는 _shared/retry.ts 의 withRetry 와 별개. PRD-v2-shipping.md §2.2 의
 *   "재시도 3회 지수 백오프 (1s, 4s, 9s)" 를 정확히 따르기 위해 별도 정책.
 * - MarketError.retryable 만 재시도 (rate_limit / server / network).
 * - unauthorized / validation 은 즉시 종료 — 셀러 자격증명 / 데이터 오류는 재시도 의미 없음.
 *
 * 강제:
 *   - maxAttempts (=3) 초과 시 즉시 throw — 무한 재시도 금지.
 */

import { MarketError, type Logger } from '../../_shared/index.ts'

export const LOGEN_BACKOFF_MS = [1_000, 4_000, 9_000] as const
export const LOGEN_MAX_ATTEMPTS = 3

export interface LogenRetryContext {
  readonly correlationId: string
  readonly logger: Logger
  readonly op: string
  /** 대기 시간 주입 (테스트에서 0ms 로 단축). default = setTimeout */
  readonly sleep?: (ms: number) => Promise<void>
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function withLogenRetry<T>(
  fn: (attempt: number) => Promise<T>,
  ctx: LogenRetryContext,
): Promise<T> {
  const sleep = ctx.sleep ?? defaultSleep
  let lastErr: unknown
  for (let attempt = 1; attempt <= LOGEN_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (e) {
      lastErr = e
      const isMarketErr = e instanceof MarketError
      const retryable = isMarketErr && e.retryable
      if (!retryable) {
        // non-retryable → 즉시 throw (unauthorized / validation 등)
        throw e
      }
      if (attempt >= LOGEN_MAX_ATTEMPTS) {
        ctx.logger.warn(
          {
            market: 'logen',
            op: ctx.op,
            attempt,
            code: e.code,
            correlationId: ctx.correlationId,
          },
          '↻ logen retry exhausted',
        )
        throw e
      }
      const fallbackDelay = LOGEN_BACKOFF_MS[LOGEN_BACKOFF_MS.length - 1] ?? 1_000
      const delayMs = LOGEN_BACKOFF_MS[attempt - 1] ?? fallbackDelay
      ctx.logger.warn(
        {
          market: 'logen',
          op: ctx.op,
          attempt,
          delayMs,
          code: e.code,
          correlationId: ctx.correlationId,
        },
        '↻ logen retry',
      )
      await sleep(delayMs)
    }
  }
  // 도달 불가
  throw lastErr instanceof Error ? lastErr : new Error('logen retry: unexpected')
}
