import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

/**
 * SignupPage — auth.md §6.3 / user_flow s1 (n5)
 *
 * - RHF + zod (SignUpFormSchema) + Supabase Auth signUp
 * - 비밀번호 강도 5단계 인디케이터 (자체 계산, zxcvbn 미사용)
 * - 약관 필수 / 마케팅 선택 체크박스
 * - 가입 성공 시 "이메일 인증 안내" 상태로 전환
 * - user_already_exists 도 동일 화면으로 응답 (enumeration 방지 — auth.md §4.4)
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
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{ko.auth.signup.title}</CardTitle>
        <CardDescription>{ko.auth.signup.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
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
              {...register('passwordConfirm')}
            />
          </FieldRow>

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border-strong"
                aria-invalid={errors.termsAgreed ? 'true' : 'false'}
                {...register('termsAgreed')}
              />
              <span>{ko.auth.signup.termsRequired}</span>
            </label>
            {errors.termsAgreed ? (
              <p role="alert" className="text-xs text-danger">
                {errors.termsAgreed.message}
              </p>
            ) : null}

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border-strong"
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
            className="w-full"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? ko.auth.signup.submitting : ko.auth.signup.submit}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          {ko.auth.common.hasAccount}{' '}
          <Link
            to="/login"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            {ko.auth.login.submit}
          </Link>
        </p>
      </CardContent>
    </Card>
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
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-text-tertiary">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
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
    <div className="space-y-1" aria-live="polite">
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded',
              i <= info.score ? info.toneClass : 'bg-surface-muted',
            )}
          />
        ))}
        <span className="ml-2 text-xs text-text-secondary">{info.label}</span>
      </div>
      {info.warnings.length > 0 ? (
        <ul className="list-disc pl-5 text-xs text-text-tertiary">
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
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{ko.auth.signup.successTitle}</CardTitle>
        <CardDescription>
          {ko.auth.signup.successBody.replace('{email}', email)}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link
          to="/login"
          className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
        >
          {ko.auth.signup.backToLogin}
        </Link>
      </CardContent>
    </Card>
  )
}

export default SignupPage
