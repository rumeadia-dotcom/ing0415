import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, useMock } from './env'
import { createMockSupabase } from './mock/createMockSupabase'

/**
 * Supabase 클라이언트 단일 인스턴스 (frontend.md §3.1 / platform.md).
 *
 * useMock=true:
 *  - in-memory mock client 반환. Auth / from / rpc / channel / functions / storage
 *    모두 fixtures 기반. 네트워크 호출 0.
 * useMock=false (dev-db 또는 real):
 *  - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 필수. 누락 시 throw.
 */
let cached: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (cached) return cached

  if (useMock) {
    cached = createMockSupabase() as unknown as SupabaseClient
    return cached
  }

  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error(
      'useMock=false 모드에는 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 가 필요합니다',
    )
  }

  cached = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      // auth.md §3.5: PKCE 고정 (implicit 금지)
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // 토큰 storage 키 명시 (다른 supabase 인스턴스 격리)
      storageKey: 'mc.auth',
    },
  })
  return cached
}
