import { z } from 'zod'

/**
 * 빌드 시점 환경변수 검증 (frontend.md §8.2).
 *
 * debug 모드: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 없어도 가능
 * (mock 어댑터로 우회). real 모드에서 누락이면 `getSupabase()` 진입 시 throw.
 *
 * `.env*` 의 빈 문자열은 `import.meta.env` 에 `""` 로 노출되어 `optional()` 만으론
 * undefined 를 강제할 수 없다. 빈 문자열도 "미설정" 으로 정규화해서 옵셔널 검증을
 *통과시킨다 (Sentry/Supabase URL 같이 .env.example 에 키만 남기는 경우 대비).
 */
const optionalUrl = z
  .union([z.string().url(), z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined))

const optionalNonEmpty = z
  .union([z.string().min(1), z.literal('')])
  .optional()
  .transform((v) => (v ? v : undefined))

const EnvSchema = z.object({
  VITE_APP_MODE: z.enum(['debug', 'real']).default('debug'),
  VITE_SUPABASE_URL: optionalUrl,
  VITE_SUPABASE_ANON_KEY: optionalNonEmpty,
  VITE_SENTRY_DSN: optionalUrl,
})

export const env = EnvSchema.parse(import.meta.env)

export const isDebug = env.VITE_APP_MODE === 'debug'
export const isReal = env.VITE_APP_MODE === 'real'

export type AppMode = z.infer<typeof EnvSchema>['VITE_APP_MODE']
