/**
 * 지수 백오프 + jitter 재시도 wrapper.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §5
 *   - docs/architecture/v1/cross-cutting/registration-job-state.md §6
 *
 * 강제:
 *   - 무한 재시도 금지. maxAttempts 초과 시 즉시 throw.
 *   - MarketError.retryable === true 인 코드만 재시도 (rate_limit / server / network).
 *   - 429 의 Retry-After (retryAfterMs) 가 있으면 우선 사용.
 *   - unauthorized / validation / unknown 은 재시도 금지.
 *   - 로그 패턴: '↻ retry' (attempt / delayMs / market / code).
 *
 * 사용:
 *   await withRetry(() => adapter.createProduct(payload), {
 *     market, correlationId, jobId, logger
 *   })
 */

import { MarketError } from './errors.ts'
import type { Logger } from './logger.ts'

export interface RetryPolicy {
  /** 최초 호출 포함. 5 = 최초 1 + 재시도 4. 마켓별 차이는 호출측에서 주입. */
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

export const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 16_000,
}

export interface RetryContext {
  market: string
  correlationId: string
  jobId?: string
  logger: Logger
}

function jitter(base: number): number {
  // ±20%
  return base * (0.8 + Math.random() * 0.4)
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  ctx: RetryContext,
  policy: RetryPolicy = DEFAULT_RETRY,
): Promise<T> {
  let attempt = 0
  let lastErr: unknown
  while (attempt < policy.maxAttempts) {
    attempt += 1
    try {
      return await fn(attempt)
    } catch (e) {
      lastErr = e
      if (!(e instanceof MarketError) || !e.retryable) {
        throw e
      }
      if (attempt >= policy.maxAttempts) {
        ctx.logger.warn(
          {
            market: ctx.market,
            jobId: ctx.jobId,
            attempt,
            code: e.code,
          },
          '↻ retry exhausted',
        )
        throw e
      }
      const fromHeader =
        e.code === 'rate_limit' && typeof e.context.retryAfterMs === 'number'
          ? Math.min(e.context.retryAfterMs, policy.maxDelayMs)
          : null
      const exponential = Math.min(
        policy.baseDelayMs * 2 ** (attempt - 1),
        policy.maxDelayMs,
      )
      const delayMs = Math.round(jitter(fromHeader ?? exponential))
      ctx.logger.warn(
        {
          market: ctx.market,
          jobId: ctx.jobId,
          attempt,
          delayMs,
          code: e.code,
        },
        '↻ retry',
      )
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  // 도달 불가 — 위 루프 내 throw 가 보장. 안전망.
  throw lastErr instanceof Error ? lastErr : new Error('retry: unexpected')
}
