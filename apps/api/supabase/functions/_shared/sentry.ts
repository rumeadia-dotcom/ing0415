/**
 * Sentry 초기화 + beforeSend 마스킹 (Edge Function 측).
 *
 * 마스터:
 *   - docs/architecture/v1/security.md §6.3
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §7.2
 *
 * 강제:
 *   - 프론트 (`src/lib/sentry.ts`) 와 동일 마스킹 룰 적용 — 한쪽만 적용된 PR 차단.
 *   - SENTRY_DSN 미설정 시 no-op (debug 로컬 / E2E 환경 호환).
 *   - capture 호출은 본 모듈을 통해서만 — 직접 `Sentry.captureException` 호출 금지
 *     (마스킹 우회 가능). `captureMarketError(err, ctx)` 사용.
 */

import * as Sentry from 'npm:@sentry/deno@8.36.0'
import { env, isDebug } from './env.ts'
import { maskError, maskRecord } from './masking.ts'

let initialized = false

export function initSentry(serviceName: string): void {
  if (initialized) return
  initialized = true
  if (!env.SENTRY_DSN) return

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_MODE,
    serverName: serviceName,
    // Edge Function 짧은 수명 — release/version 자동 감지 불가, 호출측 release 주입.
    tracesSampleRate: isDebug ? 0.0 : 0.1,
    beforeSend(event) {
      // request / extra / contexts / tags / breadcrumbs 전부 재귀 마스킹.
      if (event.request) {
        event.request = maskRecord(event.request) as typeof event.request
      }
      if (event.extra) {
        event.extra = maskRecord(event.extra) as typeof event.extra
      }
      if (event.contexts) {
        event.contexts = maskRecord(event.contexts) as typeof event.contexts
      }
      if (event.tags) {
        event.tags = maskRecord(event.tags) as typeof event.tags
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => ({
          ...b,
          data: b.data
            ? (maskRecord(b.data) as typeof b.data)
            : b.data,
        }))
      }
      return event
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = maskRecord(breadcrumb.data) as typeof breadcrumb.data
      }
      return breadcrumb
    },
  })
}

/**
 * 마켓 호출·OAuth·DB RPC 에서 발생한 에러를 Sentry 로 보낸다.
 * `maskError` 가 message / context / stack 을 모두 마스킹한 후 전송.
 */
export function captureMarketError(
  err: unknown,
  ctx: Record<string, unknown>,
): void {
  if (!initialized || !env.SENTRY_DSN) return
  const masked = maskError(err)
  Sentry.captureException(err, {
    extra: {
      maskedError: masked,
      ctx: maskRecord(ctx),
    },
  })
}

/** Edge Function 종료 직전 flush — 짧은 수명 함수에서 손실 방지. */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized || !env.SENTRY_DSN) return
  await Sentry.flush(timeoutMs)
}
