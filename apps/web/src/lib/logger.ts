import { isDev } from './env'

/**
 * 간이 구조화 로거.
 * Sentry beforeSend / maskError 연동은 Stage F 에서.
 *
 * 사용처: 프론트엔드 도메인 코드. Edge Function 의 pino 기반 로거와 분리.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const PRIORITY: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL: Level = isDev ? 'debug' : 'warn'

function emit(level: Level, args: readonly unknown[]): void {
  if (PRIORITY[level] < PRIORITY[MIN_LEVEL]) return
   
  console[level](...args)
}

export const logger = {
  debug: (...args: unknown[]): void => emit('debug', args),
  info: (...args: unknown[]): void => emit('info', args),
  warn: (...args: unknown[]): void => emit('warn', args),
  error: (...args: unknown[]): void => emit('error', args),
}
