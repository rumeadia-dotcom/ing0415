/**
 * Supabase service_role 클라이언트 싱글톤.
 *
 * 마스터: docs/architecture/v1/security.md §3.3, §5
 *
 * 강제:
 *   - service_role 키는 Edge Function env 에서만 읽는다. 클라이언트 번들 노출 금지.
 *   - 본 클라이언트는 RLS bypass 권한이므로 모든 쿼리에 `seller_id = ?` 를 명시
 *     적용할 책임은 호출측에 있다 — `registration-job-state.md` §3.4 의 service_role
 *     경로 주의.
 *   - 세션 유지 / 토큰 자동 갱신 비활성 (Edge Function 은 stateless).
 */

import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.45.4'
import { env } from './env.ts'

let cached: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (cached) return cached
  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-edge-function': 'service_role',
      },
    },
  })
  return cached
}

/**
 * 호출 셀러 식별을 위한 anon 키 + Authorization 헤더 기반 클라이언트.
 * - 본인 RLS 가 그대로 적용되며, 셀러 본인 데이터 SELECT 시 사용.
 * - service_role 우회가 의도되지 않은 경로 (예: 셀러 본인 product SELECT) 에 한정.
 */
export function getUserClient(jwt: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  })
}
