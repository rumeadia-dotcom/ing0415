import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session as SupabaseSession, User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * AuthContext / useAuth — auth.md §3 / §3.5
 *
 * - Supabase 세션 1개를 단일 소스로 보유.
 * - `onAuthStateChange` 구독으로 갱신·로그아웃·refresh 자동 반영.
 * - persistSession=true 라 새 탭 진입 시 storage 에서 자동 복구 (mount 시 getSession 으로 hydrate).
 *
 * 상태:
 *  - `status: 'loading'`  부트스트랩 hydrate 중
 *  - `status: 'authed'`   세션 보유
 *  - `status: 'anonymous'` 세션 없음
 */

export type AuthStatus = 'loading' | 'authed' | 'anonymous'

type ActionResult = { ok: true } | { ok: false; error: unknown }

interface AuthContextValue {
  status: AuthStatus
  session: SupabaseSession | null
  user: User | null
  signInWithPassword: (email: string, password: string) => Promise<ActionResult>
  signUp: (input: {
    email: string
    password: string
    displayName: string
    marketingConsent: boolean
  }) => Promise<ActionResult>
  sendPasswordResetEmail: (email: string) => Promise<ActionResult>
  updatePassword: (newPassword: string) => Promise<ActionResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<SupabaseSession | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    const supabase = getSupabase()
    let mounted = true

    // 1) storage 에서 세션 hydrate
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          logger.warn({ err: error.message }, 'auth.getSession error')
        }
        setSession(data.session)
        setStatus(data.session ? 'authed' : 'anonymous')
      })
      .catch((e: unknown) => {
        if (!mounted) return
        logger.warn({ err: String(e) }, 'auth.getSession threw')
        setSession(null)
        setStatus('anonymous')
      })

    // 2) 이후 모든 변화 구독 (signIn / signOut / token refresh / recovery)
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return
      logger.debug({ event }, 'auth.onAuthStateChange')
      setSession(next)
      setStatus(next ? 'authed' : 'anonymous')
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabase()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { ok: false as const, error }
      return { ok: true as const }
    },
    [],
  )

  const signUp = useCallback<AuthContextValue['signUp']>(async (input) => {
    const supabase = getSupabase()
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        // 이메일 인증 후 콜백 — Supabase 가 토큰 부착해 리다이렉트
        emailRedirectTo: `${origin}/login`,
        // auth.md §2.2: signup 시 사용자 메타로 displayName / marketingConsent 전달
        // 트리거 handle_new_seller 가 public.sellers 행 생성에 활용.
        data: {
          display_name: input.displayName,
          marketing_consent: input.marketingConsent,
        },
      },
    })
    if (error) return { ok: false as const, error }
    return { ok: true as const }
  }, [])

  const sendPasswordResetEmail = useCallback<
    AuthContextValue['sendPasswordResetEmail']
  >(async (email) => {
    const supabase = getSupabase()
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })
    if (error) return { ok: false as const, error }
    return { ok: true as const }
  }, [])

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(
    async (newPassword) => {
      const supabase = getSupabase()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) return { ok: false as const, error }
      return { ok: true as const }
    },
    [],
  )

  const signOut = useCallback(async () => {
    const supabase = getSupabase()
    // auth.md §3.5: 로그아웃 scope = global
    await supabase.auth.signOut({ scope: 'global' })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      signInWithPassword,
      signUp,
      sendPasswordResetEmail,
      updatePassword,
      signOut,
    }),
    [
      status,
      session,
      signInWithPassword,
      signUp,
      sendPasswordResetEmail,
      updatePassword,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth 는 <AuthProvider> 내부에서만 사용할 수 있습니다')
  }
  return ctx
}
