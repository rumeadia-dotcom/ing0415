/**
 * 프론트엔드 Sentry 초기화.
 *
 * 마스터: docs/architecture/v1/security.md §6.3 (Sentry 초기화 시 강제) / §6.2 (redact).
 *
 * 강제:
 * - VITE_SENTRY_DSN 누락 시 비활성 (개발자 로컬·CI 환경 보호).
 * - beforeSend / beforeBreadcrumb 모두 redact 통과 — 한쪽만 적용된 PR 차단.
 * - environment 는 빌드 모드 (dev / real) 그대로. 두 환경 데이터 절대 혼입 금지.
 *
 * 호출 시점: `src/main.tsx` 의 createRoot() 직전 1회.
 */

import * as Sentry from '@sentry/react'

import { env, isDev } from './env'
import { redact } from './security/redact'

let initialized = false

export function initSentry(): void {
  if (initialized) return
  if (!env.VITE_SENTRY_DSN) return // DSN 없으면 비활성. real 모드 누락 검증은 CI 에서.

  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: isDev ? 'dev' : 'real',
    integrations: [Sentry.browserTracingIntegration()],
    // dev 는 100% 추적 (콘솔 + Sentry 양쪽 검증), real 은 10%.
    tracesSampleRate: isDev ? 1.0 : 0.1,

    beforeSend(event) {
      // security.md §6.3: request / extra / contexts / tags / breadcrumbs 전체 마스킹.
      if (event.request) {
        event.request = redact(event.request) as typeof event.request
      }
      if (event.extra) {
        event.extra = redact(event.extra) as typeof event.extra
      }
      if (event.contexts) {
        event.contexts = redact(event.contexts) as typeof event.contexts
      }
      if (event.tags) {
        event.tags = redact(event.tags) as typeof event.tags
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (!b.data) return b
          // 메시지 자체는 코드 작성자 책임 (security.md §6.3 명시).
          // exactOptionalPropertyTypes 환경에서 undefined 재할당 회피 위해 in-place 패치.
          return { ...b, data: redact(b.data) as typeof b.data }
        })
      }
      return event
    },

    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = redact(breadcrumb.data) as typeof breadcrumb.data
      }
      return breadcrumb
    },
  })

  initialized = true
}
