import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * Auth event audit log — Edge Function `auth-event-log` 호출 wrapper.
 *
 * 마스터: docs/architecture/v1/features/auth.md §5.5 / §10 (Edge Function 시그니처)
 *
 * 정책:
 * - **Fire-and-forget**: 실패해도 사용자 흐름 차단 금지. 로그인·로그아웃 등 본 흐름은 절대 막지 않음.
 * - **anonymous 적재 허용**: signup_attempted_existing_email 처럼 인증 전 이벤트도 호출 가능.
 * - 응답은 무시. 에러는 logger.warn 으로만 남기고 throw 하지 않음.
 * - IP / UA 는 Edge runtime 의 헤더에서 추출 후 hash — 본 클라이언트에선 평문 절대 전송 금지.
 */

export type AuthEventName =
  | 'auth.login_success'
  | 'auth.login_failure'
  | 'auth.logout'
  | 'auth.password_reset_requested'
  | 'auth.password_reset_completed'
  | 'auth.session_revoked_global'
  | 'auth.signup_attempted_existing_email'

export interface TrackAuthEventInput {
  event: AuthEventName
  /** 추가 컨텍스트 (provider, reason 등). 토큰·이메일·비밀번호 절대 포함 금지. */
  meta?: Record<string, unknown>
}

/**
 * 인증 이벤트를 audit log 에 적재한다.
 *
 * **반환값 = Promise<void>** 지만 await 하지 않는 fire-and-forget 호출이 정상 패턴.
 * 예외는 내부에서 swallow 되어 catch 가 필요 없음.
 */
export async function trackAuthEvent(input: TrackAuthEventInput): Promise<void> {
  const meta = input.meta ?? {}
  try {
    const supabase = getSupabase()
    const { error } = await supabase.functions.invoke('auth-event-log', {
      body: { event: input.event, meta },
    })
    if (error) {
      logger.warn(
        { event: input.event, err: error.message },
        'auth-event-log invoke failed',
      )
      return
    }
    logger.debug({ event: input.event }, 'auth event logged')
  } catch (e) {
    // 어떤 예외라도 사용자 흐름은 차단하지 않는다.
    logger.warn(
      { event: input.event, err: e instanceof Error ? e.message : String(e) },
      'auth-event-log threw',
    )
  }
}
