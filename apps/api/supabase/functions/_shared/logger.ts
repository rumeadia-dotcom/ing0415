/**
 * 구조화 JSON 로거 (Deno / Edge Function).
 *
 * 마스터:
 *   - CLAUDE.md "외부 API 로깅 패턴"
 *   - docs/architecture/v1/security.md §6.4
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §6
 *
 * 강제:
 *   - print / console.log / console.error 직접 사용 금지. 본 로거 경유.
 *   - 모든 로그 라인은 단일 JSON 객체 + `\n` (Supabase Logflare / DataDog 호환).
 *   - context 객체는 자동으로 maskRecord 통과 → 토큰·PII 노출 차단.
 *   - real 모드 기본 레벨 = warn, debug 모드 = debug.
 *   - 외부 호출 3종 패턴 (`→ request` / `← response` / `← error`) 은 호출측이
 *     반드시 동일 메시지 형태로 작성. linter 가 grep 가능하도록.
 *
 * pino / winston 미사용 — Deno 호환 빌드 검증 부담 회피, 표준 JSON 직접 출력.
 */

import { env, isDebug } from './env.ts'
import { maskRecord } from './masking.ts'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

export interface LogContext {
  correlationId?: string
  jobId?: string
  market?: string
  sellerId?: string
  // 자유 키 — 호출측에서 attempt / latencyMs / status 등 추가.
  // PII / 토큰 키는 maskRecord 가 자동 마스킹.
  [key: string]: unknown
}

export interface Logger {
  debug(ctx: LogContext, msg: string): void
  info(ctx: LogContext, msg: string): void
  warn(ctx: LogContext, msg: string): void
  error(ctx: LogContext, msg: string): void
  /** 컨텍스트를 누적해 새 logger 반환 (요청 단위 상속용). */
  with(extra: LogContext): Logger
}

const MIN_LEVEL: LogLevel = isDebug ? 'debug' : 'warn'

function emit(
  service: string,
  defaults: LogContext,
  level: LogLevel,
  ctx: LogContext,
  msg: string,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return
  const merged: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    service,
    mode: env.APP_MODE,
    msg,
    ...defaults,
    ...ctx,
  }
  const masked = maskRecord(merged) as Record<string, unknown>
  // 단일 라인 JSON — Supabase Logflare 가 그대로 파싱
  const line = JSON.stringify(masked)
  // stderr / stdout 분기는 Edge Function 환경에서 둘 다 동일하게 수집됨.
  if (level === 'error' || level === 'warn') {
    // Deno: 표준에러로 출력하면 Supabase 로그 콘솔에서 별도 색상 표시
    console.error(line)
  } else {
    console.log(line)
  }
}

export function createLogger(
  service: string,
  defaults: LogContext = {},
): Logger {
  return {
    debug: (ctx, msg) => emit(service, defaults, 'debug', ctx, msg),
    info: (ctx, msg) => emit(service, defaults, 'info', ctx, msg),
    warn: (ctx, msg) => emit(service, defaults, 'warn', ctx, msg),
    error: (ctx, msg) => emit(service, defaults, 'error', ctx, msg),
    with: (extra: LogContext) =>
      createLogger(service, { ...defaults, ...extra }),
  }
}
