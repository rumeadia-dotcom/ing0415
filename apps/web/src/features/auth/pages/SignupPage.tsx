import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Card,
  ErrorMessage,
  Input,
  Label,
} from '@/components/ui'
import { SignUpFormSchema, type SignUpForm } from '@/lib/schemas/auth'
import { ko } from '@/locales/ko'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'
import { mapAuthError, type MappedAuthError } from '../lib/auth-error-map'
import { evaluatePasswordStrength } from '../lib/password-strength'
import { trackAuthEvent } from '../api/auth-event-log'
import { studioClass } from '../lib/studio-tokens'

/**
 * SignupPage — auth.md §6.3 / user_flow s1 (n5)
 *
 * - RHF + zod (SignUpFormSchema) + Supabase Auth signUp
 * - 비밀번호 강도 5단계 인디케이터 (자체 계산, zxcvbn 미사용)
 * - 약관 필수 / 마케팅 선택 체크박스
 * - 가입 성공 시 "이메일 인증 안내" 상태로 전환
 * - user_already_exists 도 동일 화면으로 응답 (enumeration 방지 — auth.md §4.4)
 *
 * 디자인: docs/design-renewal/designFile/concepts/studio-domains.jsx (s1)
 */
export function SignupPage(): JSX.Element {
  const { signUp } = useAuth()
  const [submitError, setSubmitError] = useState<MappedAuthError | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SignUpForm>({
    resolver: zodResolver(SignUpFormSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      displayName: '',
      marketingConsent: false,
      // zod literal(true) 와 호환되도록 캐스팅 — 사용자가 체크해야만 통과
      termsAgreed: false as unknown as true,
    },
    mode: 'onSubmit',
  })

  const passwordValue = watch('password') ?? ''
  const strength = useMemo(
    () => evaluatePasswordStrength(passwordValue),
    [passwordValue],
  )

  async function onSubmit(values: SignUpForm): Promise<void> {
    setSubmitError(null)
    const result = await signUp({
      email: values.email,
      password: values.password,
      displayName: values.displayName,
      marketingConsent: values.marketingConsent,
    })
    if (!result.ok) {
      const mapped = mapAuthError(result.error)
      if (mapped.code === 'user_already_exists') {
        setSubmittedEmail(values.email)
        logger.warn(
          { code: 'signup_attempted_existing_email' },
          'signup attempted with existing email',
        )
        void trackAuthEvent({
          event: 'auth.signup_attempted_existing_email',
        })
        return
      }
      setSubmitError(mapped)
      if (mapped.shouldReport) {
        logger.error({ code: mapped.code }, 'signup failed')
      }
      reset({ ...values, password: '', passwordConfirm: '' })
      return
    }
    setSubmittedEmail(values.email)
  }

  if (submittedEmail) {
    return <SignupSuccess email={submittedEmail} />
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h1 className={studioClass.h1}>{ko.auth.signup.title}</h1>
        <p className={cn(studioClass.sub, 'mt-2')}>{ko.auth.signup.subtitle}</p>
      </div>

      <Card className={studioClass.card}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
          aria-label={ko.auth.signup.title}
        >
          <FieldRow
            id="signup-name"
            label={ko.auth.signup.displayName}
            error={errors.displayName?.message}
          >
            <Input
              id="signup-name"
              autoComplete="name"
              placeholder={ko.auth.signup.displayNamePlaceholder}
              aria-invalid={errors.displayName ? 'true' : 'false'}
              className={studioClass.input}
              {...register('displayName')}
            />
          </FieldRow>

          <FieldRow
            id="signup-email"
            label={ko.auth.login.email}
            error={errors.email?.message}
          >
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder={ko.auth.login.emailPlaceholder}
              aria-invalid={errors.email ? 'true' : 'false'}
              className={studioClass.input}
              {...register('email')}
            />
          </FieldRow>

          <FieldRow
            id="signup-password"
            label={ko.auth.login.password}
            error={errors.password?.message}
            hint={ko.auth.signup.passwordHint}
          >
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              className={studioClass.input}
              {...register('password')}
            />
            {passwordValue.length > 0 ? <StrengthMeter info={strength} /> : null}
          </FieldRow>

          <FieldRow
            id="signup-password-confirm"
            label={ko.auth.signup.passwordConfirm}
            error={errors.passwordConfirm?.message}
          >
            <Input
              id="signup-password-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.passwordConfirm ? 'true' : 'false'}
              className={studioClass.input}
              {...register('passwordConfirm')}
            />
          </FieldRow>

          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2 text-[13px] text-dim">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border-strong accent-ink"
                aria-invalid={errors.termsAgreed ? 'true' : 'false'}
                {...register('termsAgreed')}
              />
              <span>{ko.auth.signup.termsRequired}</span>
            </label>
            {errors.termsAgreed ? (
              <p role="alert" className={studioClass.helperError}>
                {errors.termsAgreed.message}
              </p>
            ) : null}

            <label className="flex items-start gap-2 text-[13px] text-dim">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border-strong accent-ink"
                {...register('marketingConsent')}
              />
              <span>{ko.auth.signup.marketingOptional}</span>
            </label>
          </div>

          {submitError ? (
            <ErrorMessage
              message={submitError.message}
              {...(submitError.details ? { details: submitError.details } : {})}
            />
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className={studioClass.ctaPrimary}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? ko.auth.signup.submitting : ko.auth.signup.submit}
          </Button>
        </form>

        <p className={cn('mt-6 text-center', studioClass.bodyFaint)}>
          {ko.auth.common.hasAccount}{' '}
          <Link to="/login" className={studioClass.linkStrong}>
            {ko.auth.login.submit}
          </Link>
        </p>
      </Card>
    </div>
  )
}

function FieldRow({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string | undefined
  hint?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div>
      <Label htmlFor={id} className={studioClass.label}>
        {label}
      </Label>
      {children}
      {hint ? <p className={studioClass.helperHint}>{hint}</p> : null}
      {error ? (
        <p role="alert" className={studioClass.helperError}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function StrengthMeter({
  info,
}: {
  info: ReturnType<typeof evaluatePasswordStrength>
}): JSX.Element {
  return (
    <div className="mt-2 space-y-1" aria-live="polite">
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded',
              i <= info.score
                ? info.toneClass
                : 'bg-border',
            )}
          />
        ))}
        <span className="ml-2 text-[11.5px] text-dim">
          {info.label}
        </span>
      </div>
      {info.warnings.length > 0 ? (
        <ul className="list-disc pl-5 text-[11.5px] text-faint">
          {info.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function SignupSuccess({ email }: { email: string }): JSX.Element {
  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h1 className={studioClass.h1}>{ko.auth.signup.successTitle}</h1>
      </div>
      <Card className={cn(studioClass.card, 'text-center')}>
        {/* 이메일 발송 아이콘 — 봉투 형태의 둥근 ok-circle */}
        <div className="relative mx-auto mb-5 h-[88px] w-[88px]">
          <div className="absolute inset-0 rounded-full bg-success-soft" />
          <div className="absolute inset-[14px] flex items-center justify-center rounded-full bg-success text-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
              aria-hidden="true"
            >
              <path d="M4 6h16v12H4z" />
              <path d="m4 6 8 7 8-7" />
            </svg>
          </div>
        </div>

        <p className={cn(studioClass.sub, 'leading-relaxed')}>
          {ko.auth.signup.successBody.replace('{email}', email)}
        </p>

        <div className="mt-6">
          <Link to="/login" className={studioClass.linkAccent}>
            {ko.auth.signup.backToLogin}
          </Link>
        </div>
      </Card>
    </div>
  )
}

export default SignupPage
