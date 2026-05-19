import { z } from 'zod'

/**
 * 인증 도메인 zod 스키마.
 * 마스터: docs/architecture/v1/features/auth.md §5
 *
 * 비밀번호 정책 = security.md §2.3 (10~72자 / 3종 이상 혼합).
 */

// ─────────────────────────────────────────────
// 공통 필드
// ─────────────────────────────────────────────
const passwordPolicy = z
  .string()
  .min(10, '비밀번호는 10자 이상이어야 합니다')
  .max(72, '비밀번호는 72자 이하여야 합니다')
  .refine(
    (v) => {
      const kinds = [
        /[a-z]/.test(v),
        /[A-Z]/.test(v),
        /[0-9]/.test(v),
        /[^A-Za-z0-9]/.test(v),
      ].filter(Boolean).length
      return kinds >= 3
    },
    { message: '영문 대소문자 / 숫자 / 특수문자 중 3종 이상을 혼합해주세요' },
  )

const emailField = z
  .string()
  .min(1, '이메일을 입력해주세요')
  .email('올바른 이메일 형식이 아닙니다')
  .max(255)

const displayNameField = z
  .string()
  .trim()
  .min(1, '표시 이름을 입력해주세요')
  .max(60, '표시 이름은 60자 이하여야 합니다')

// ─────────────────────────────────────────────
// 폼 스키마
// ─────────────────────────────────────────────
export const SignUpFormSchema = z
  .object({
    email: emailField,
    password: passwordPolicy,
    passwordConfirm: z.string(),
    displayName: displayNameField,
    marketingConsent: z.boolean().default(false),
    termsAgreed: z.literal(true, {
      errorMap: () => ({ message: '이용약관 동의가 필요합니다' }),
    }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다',
  })
export type SignUpForm = z.infer<typeof SignUpFormSchema>

export const SignInFormSchema = z.object({
  email: emailField,
  password: z.string().min(1, '비밀번호를 입력해주세요'),
})
export type SignInForm = z.infer<typeof SignInFormSchema>

export const ForgotPasswordFormSchema = z.object({
  email: emailField,
})
export type ForgotPasswordForm = z.infer<typeof ForgotPasswordFormSchema>

export const ResetPasswordFormSchema = z
  .object({
    password: passwordPolicy,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다',
  })
export type ResetPasswordForm = z.infer<typeof ResetPasswordFormSchema>

// ─────────────────────────────────────────────
// 도메인 객체
// ─────────────────────────────────────────────
export const SellerSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(60),
  businessType: z.enum([
    'individual',
    'sole_proprietor',
    'corporation',
    'undecided',
  ]),
  marketingConsent: z.boolean(),
  marketingConsentAt: z.string().datetime().nullable(),
  lastActiveAt: z.string().datetime(),
  signupProvider: z.enum(['email', 'google', 'kakao', 'naver']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Seller = z.infer<typeof SellerSchema>

export const SessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
  tokenType: z.literal('bearer'),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
    emailConfirmedAt: z.string().datetime().nullable(),
    appMetadata: z.object({
      provider: z.string().optional(),
      providers: z.array(z.string()).optional(),
    }),
  }),
})
export type Session = z.infer<typeof SessionSchema>

// ─────────────────────────────────────────────
// URL search params 검증
// ─────────────────────────────────────────────
export const ResetPasswordUrlSchema = z.object({
  type: z.literal('recovery'),
  access_token: z.string().min(1).optional(),
})

export const AuthCallbackQuerySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('signup'), token_hash: z.string().min(1) }),
  z.object({ type: z.literal('oauth'), code: z.string().min(1) }),
  z.object({ type: z.literal('recovery') }),
])
