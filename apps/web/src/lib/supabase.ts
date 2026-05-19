import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isReal } from './env'

/**
 * Supabase 클라이언트 단일 인스턴스 (frontend.md §3.1 / platform.md).
 *
 * - real 모드: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 필수.
 *   누락 시 첫 호출 시점에 throw — 부트스트랩 시점에 즉시 실패.
 * - debug 모드: URL/KEY 없어도 fallback 으로 클라이언트는 생성. 실제 네트워크는
 *   `if (mode === 'debug')` 분기로 mock 어댑터가 우회하므로 호출되지 않음.
 *
 * Auth listener / Realtime / RPC 가 동일 인스턴스를 공유.
 */
let cached: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (cached) return cached

  if (isReal) {
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
      throw new Error(
        'real 모드에는 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 가 필요합니다',
      )
    }
  }

  cached = createClient(
    env.VITE_SUPABASE_URL ?? 'https://debug.local.invalid',
    env.VITE_SUPABASE_ANON_KEY ?? 'debug-anon-key',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  )
  return cached
}
