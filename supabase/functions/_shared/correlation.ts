/**
 * correlationId 발급 / 헤더 추출.
 *
 * 마스터:
 *   - docs/architecture/v1/security.md §6.4 (모든 외부 호출에 correlationId 부여)
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §6.1
 *
 * 강제:
 *   - 모든 Edge Function 진입점은 `x-correlation-id` 헤더가 있으면 그대로 사용,
 *     없으면 새로 발급. 응답 헤더에 동일 값 echo.
 *   - jobId 는 registration-run 등 잡 컨텍스트에서만. authenticate / refresh
 *     처럼 잡 외 호출은 correlationId 만.
 */

const CORRELATION_HEADER = 'x-correlation-id'

/** RFC 4122 v4 (crypto.randomUUID — Deno 표준). */
export function generateCorrelationId(): string {
  return crypto.randomUUID()
}

/**
 * 요청 헤더에서 correlationId 추출, 없으면 새로 발급.
 * 외부에서 받은 값은 헤더 인젝션 방지를 위해 길이/형식 검증.
 */
export function correlationFromRequest(req: Request): string {
  const incoming = req.headers.get(CORRELATION_HEADER)
  if (
    incoming &&
    incoming.length >= 8 &&
    incoming.length <= 64 &&
    /^[A-Za-z0-9-]+$/.test(incoming)
  ) {
    return incoming
  }
  return generateCorrelationId()
}

export { CORRELATION_HEADER }
