/**
 * 마켓 어댑터 에러.
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §7
 *
 * 어댑터 내부에서 마켓 API 호출 / 응답 검증 실패 시 본 클래스만 throw.
 * 호출측(Edge Function 오케스트레이터)이 `code` 별로 재시도·UX 분기.
 */

export type MarketErrorCode =
  | 'unauthorized'
  | 'rate_limit'
  | 'validation'
  | 'network'
  | 'server'
  | 'unknown'

export interface MarketErrorContext {
  market: string
  status?: number
  retryAfterMs?: number
  marketErrorCode?: string
  marketErrorMessage?: string
  cause?: unknown
}

export class MarketError extends Error {
  readonly code: MarketErrorCode
  readonly context: MarketErrorContext

  constructor(
    code: MarketErrorCode,
    message: string,
    context: MarketErrorContext,
  ) {
    super(message)
    this.name = 'MarketError'
    this.code = code
    this.context = context
  }
}
