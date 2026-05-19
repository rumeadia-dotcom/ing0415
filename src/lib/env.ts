import { z } from 'zod'

/**
 * 빌드 시점 환경변수 검증 (frontend.md §8.2).
 *
 * debug 모드: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 없어도 가능
 * (mock 어댑터로 우회). real 모드에서 누락이면 `getSupabase()` 진입 시 throw.
 */
const EnvSchema = z.object({
  VITE_APP_MODE: z.enum(['debug', 'real']).default('debug'),
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_SENTRY_DSN: z.string().url().optional(),
})

export const env = EnvSchema.parse(import.meta.env)

export const isDebug = env.VITE_APP_MODE === 'debug'
export const isReal = env.VITE_APP_MODE === 'real'

export type AppMode = z.infer<typeof EnvSchema>['VITE_APP_MODE']
