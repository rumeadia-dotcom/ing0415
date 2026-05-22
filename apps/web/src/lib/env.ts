import { z } from 'zod'

/**
 * 빌드 시점 환경변수 검증 (frontend.md §8.2).
 *
 * 플래그 2개로 분리 (2026-05-22):
 *   - VITE_APP_MODE = 'dev' | 'real'    → DB / Edge Function 타겟 + Sentry 환경 라벨
 *   - VITE_USE_MOCK = 'true' | 'false'  → 마켓 어댑터 (+ 일부 데이터) 소스
 *
 * 유효 조합:
 *   - dev + useMock=true   : dev-supabase + mock 마켓 어댑터  (빠른 UI 작업)
 *   - dev + useMock=false  : dev-supabase + real 마켓 어댑터  (통합 검증)
 *   - real + useMock=false : real-supabase + real 어댑터      (운영/스테이징)
 *   - real + useMock=true  : ✗ 부트스트랩 시 throw
 *
 * Supabase URL/anon key 는 dev/real 모드 모두 필수 (mock 모드여도 Auth 등이 클라이언트를
 * 사용함). 누락 시 첫 호출 시점에 throw.
 */
const optionalUrl = z
  .union([z.string().url(), z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined))

const optionalNonEmpty = z
  .union([z.string().min(1), z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined))

const booleanString = z
  .union([z.literal('true'), z.literal('false')])
  .transform((v) => v === 'true')

const EnvSchema = z
  .object({
    VITE_APP_MODE: z.enum(['dev', 'real']).default('dev'),
    VITE_USE_MOCK: booleanString.optional(),
    VITE_SUPABASE_URL: optionalUrl,
    VITE_SUPABASE_ANON_KEY: optionalNonEmpty,
    VITE_SENTRY_DSN: optionalUrl,
  })
  .transform((v) => ({
    ...v,
    VITE_USE_MOCK: v.VITE_USE_MOCK ?? (v.VITE_APP_MODE === 'dev'),
  }))
  .refine((v) => !(v.VITE_APP_MODE === 'real' && v.VITE_USE_MOCK === true), {
    message: 'real 모드에서는 VITE_USE_MOCK=true 를 사용할 수 없습니다',
    path: ['VITE_USE_MOCK'],
  })

export const env = EnvSchema.parse(import.meta.env)

export const isDev = env.VITE_APP_MODE === 'dev'
export const isReal = env.VITE_APP_MODE === 'real'
export const useMock = env.VITE_USE_MOCK

export type AppMode = 'dev' | 'real'
