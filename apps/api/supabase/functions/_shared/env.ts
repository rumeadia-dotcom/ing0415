/**
 * Edge Function 환경변수 (Deno).
 *
 * 마스터:
 *   - docs/architecture/v1/platform.md §5
 *   - docs/architecture/v1/security.md §5 (시크릿 분류)
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §5 (MASTER_KEY)
 *
 * 강제:
 *   - 모든 환경변수는 zod 로 런타임 검증 후 사용 (`any`/`unknown` 잔존 금지).
 *   - `APP_MODE` 분기는 debug / real 양쪽 모두 동일 보안 경로 (Auth/RLS/암호화)
 *     를 통과해야 한다 — security.md §9 동등성.
 *   - 마스터 키(`MASTER_KEY_<kid>`) 는 Edge Function env 에만 존재. 클라이언트
 *     번들로 빠져나가지 않도록 ESLint + grep:secrets 가 PR 차단.
 *
 * 본 모듈은 부팅 시 1회 검증한다. 누락 / 형식 오류 시 즉시 throw → 함수가 기동 안 됨.
 */

import { z } from 'npm:zod@3.23.8'

const EnvSchema = z.object({
  // Supabase 코어 (debug / real 별도 프로젝트)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // 빌드 / 운영 모드
  APP_MODE: z.enum(['debug', 'real']).default('debug'),

  // Sentry (선택). 누락 시 initSentry() 가 no-op.
  SENTRY_DSN: z.string().url().optional(),

  // pgcrypto 마스터 키 (credential-vault.md §5)
  //   - 키 식별자: `mk_<year>_<quarter>` 권장
  //   - 신·구 키 양립 기간 동안 두 개 변수 모두 존재할 수 있다.
  MASTER_KEY_CURRENT_KID: z.string().min(1),
  // 실제 키 값은 `MASTER_KEY_<KID>` 동적 환경변수에서 읽는다 (resolveMasterKey()).

  // OAuth 콜백 redirect_uri 베이스 (security.md §7.3 화이트리스트)
  PUBLIC_APP_ORIGIN: z.string().url(),

  // IP / UA 해시용 일일 회전 salt (auth.md §4.3, kpi.md §3.3).
  //   - 운영자가 매일 회전. 같은 IP 라도 다음날에는 다른 hash → fingerprint 추적 불가.
  //   - 32 자 이상의 고엔트로피 문자열 강제. 누락 시 함수 부팅 실패 → 평문 IP 적재 사고 차단.
  DAILY_SALT: z.string().min(32),

  // 마켓별 OAuth client 자격증명 (real 모드만 필수, debug 는 mock 어댑터 사용)
  NAVER_CLIENT_ID: z.string().min(1).optional(),
  NAVER_CLIENT_SECRET: z.string().min(1).optional(),
  COUPANG_VENDOR_ID: z.string().min(1).optional(),
  COUPANG_ACCESS_KEY: z.string().min(1).optional(),
  COUPANG_SECRET_KEY: z.string().min(1).optional(),
})

export type Env = z.infer<typeof EnvSchema>

function loadEnv(): Env {
  const raw = Deno.env.toObject()
  const parsed = EnvSchema.safeParse(raw)
  if (!parsed.success) {
    // 토큰·시크릿 평문 노출 방지 — flatten 결과의 키만 출력.
    const fieldErrors = parsed.error.flatten().fieldErrors
    const fields = Object.keys(fieldErrors).join(', ')
    throw new Error(`[env] invalid environment: ${fields}`)
  }
  // real 모드면서 마켓 자격증명이 비어 있으면 경고 로깅 (어댑터 호출 시 throw).
  if (parsed.data.APP_MODE === 'real') {
    const missing: string[] = []
    if (!parsed.data.NAVER_CLIENT_ID || !parsed.data.NAVER_CLIENT_SECRET) {
      missing.push('naver')
    }
    if (
      !parsed.data.COUPANG_VENDOR_ID ||
      !parsed.data.COUPANG_ACCESS_KEY ||
      !parsed.data.COUPANG_SECRET_KEY
    ) {
      missing.push('coupang')
    }
    if (missing.length > 0) {
      // console.warn 사용 금지 — 구조화 로거가 아직 init 전 단계라 console 1회만 허용.
      // 실제 운영은 logger.warn 으로 대체 권장 (logger.ts 에서 호출).
      console.warn(
        JSON.stringify({
          level: 'warn',
          msg: '[env] real mode: market credentials missing',
          missing,
        }),
      )
    }
  }
  return parsed.data
}

export const env: Env = loadEnv()
export const isDebug = env.APP_MODE === 'debug'
export const isReal = env.APP_MODE === 'real'

/**
 * KID 로 라우팅된 마스터 키를 반환.
 * - 환경변수명 규약: `MASTER_KEY_<KID>` (예: MASTER_KEY_mk_2026_q2)
 * - 키 회전 중에는 신·구 키가 모두 존재할 수 있다.
 * - 누락 시 throw — 호출측은 잡 실패로 처리하고 §9 사고 대응 검토.
 */
export function resolveMasterKey(kid: string): string {
  const varName = `MASTER_KEY_${kid}`
  const value = Deno.env.get(varName)
  if (!value || value.length < 32) {
    throw new Error(`[env] master key not found or too short for kid=${kid}`)
  }
  return value
}

export function currentKid(): string {
  return env.MASTER_KEY_CURRENT_KID
}
