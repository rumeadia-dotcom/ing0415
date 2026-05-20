import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: invokeMock },
  }),
}))

import { trackAuthEvent } from '../api/auth-event-log'

beforeEach(() => {
  invokeMock.mockReset()
})

describe('trackAuthEvent', () => {
  it('happy: supabase.functions.invoke 를 정확한 fn 이름 + body 로 호출', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null })
    await trackAuthEvent({
      event: 'auth.login_success',
      meta: { provider: 'email' },
    })
    expect(invokeMock).toHaveBeenCalledTimes(1)
    expect(invokeMock).toHaveBeenCalledWith('auth-event-log', {
      body: { event: 'auth.login_success', meta: { provider: 'email' } },
    })
  })

  it('meta 미지정 시 빈 객체로 전송 (백엔드 default 와 일치)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null })
    await trackAuthEvent({ event: 'auth.logout' })
    const call = invokeMock.mock.calls[0]?.[1] as { body: { meta: unknown } }
    expect(call.body.meta).toEqual({})
  })

  it('invoke 가 error 반환해도 throw 하지 않음 (fire-and-forget)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'network down' },
    })
    await expect(
      trackAuthEvent({ event: 'auth.login_failure' }),
    ).resolves.toBeUndefined()
  })

  it('invoke 가 예외 throw 해도 swallow (사용자 흐름 차단 X)', async () => {
    invokeMock.mockRejectedValue(new Error('boom'))
    await expect(
      trackAuthEvent({ event: 'auth.password_reset_requested' }),
    ).resolves.toBeUndefined()
  })

  it('이벤트 이름 7종 모두 호출 가능 (타입 검증)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null })
    const events = [
      'auth.login_success',
      'auth.login_failure',
      'auth.logout',
      'auth.password_reset_requested',
      'auth.password_reset_completed',
      'auth.session_revoked_global',
      'auth.signup_attempted_existing_email',
    ] as const
    for (const e of events) {
      await trackAuthEvent({ event: e })
    }
    expect(invokeMock).toHaveBeenCalledTimes(7)
  })
})
