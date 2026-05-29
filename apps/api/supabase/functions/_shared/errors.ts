/**
 * MarketError + HTTP 응답 에러 클래스 (Edge Function 측).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §7
 *   - src/lib/markets/errors.ts (클라이언트 측 단일 출처 미러)
 *
 * 강제:
 *   - 어댑터 본체에서 throw 하는 에러는 모두 MarketError. 그 외 throw 는 http.ts
 *     wrapper 에서 500 으로 변환.
 *   - error context 의 cause / marketErrorMessage 는 응답 body 로 노출하기 전
 *     `masking.maskError` 통과 필수 (호출측 책임).
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

  /** 재시도 가능 여부 (with-retry.ts 가 사용). */
  get retryable(): boolean {
    return (
      this.code === 'rate_limit' ||
      this.code === 'server' ||
      this.code === 'network'
    )
  }
}

/**
 * HTTP 응답으로 변환할 에러. http.ts 의 withRequest 가 catch.
 *
 * - 4xx 는 사용자 입력 / 인증 / 검증 실패. body 에 code / message 노출 허용.
 * - 5xx 는 서버 측 결함. message 는 사용자에게 노출 가능한 안전 문자열만.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const HttpErrors = {
  badRequest: (code: string, message: string, details?: Record<string, unknown>) =>
    new HttpError(400, code, message, details),
  unauthorized: (
    code = 'unauthorized',
    message = 'authentication required',
    details?: Record<string, unknown>,
  ) => new HttpError(401, code, message, details),
  forbidden: (
    code = 'forbidden',
    message = 'access denied',
    details?: Record<string, unknown>,
  ) => new HttpError(403, code, message, details),
  notFound: (
    code = 'not_found',
    message = 'resource not found',
    details?: Record<string, unknown>,
  ) => new HttpError(404, code, message, details),
  conflict: (code: string, message: string, details?: Record<string, unknown>) =>
    new HttpError(409, code, message, details),
  rateLimit: (retryAfterMs?: number, details?: Record<string, unknown>) =>
    new HttpError(429, 'rate_limit', 'too many requests', {
      retryAfterMs,
      ...(details ?? {}),
    }),
  internal: (
    code = 'internal',
    message = 'internal server error',
    details?: Record<string, unknown>,
  ) => new HttpError(500, code, message, details),
  /** upstream(외부 마켓 API) 응답 실패 — 우리 서버 버그가 아닌 외부 도달/응답 문제. */
  badGateway: (
    code = 'bad_gateway',
    message = 'upstream service error',
    details?: Record<string, unknown>,
  ) => new HttpError(502, code, message, details),
}
