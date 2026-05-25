import { useState } from 'react'
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
import {
  ForgotPasswordFormSchema,
  type ForgotPasswordForm,
} from '@/lib/schemas/auth'
import { ko } from '@/locales/ko'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'
import { mapAuthError, type MappedAuthError } from '../lib/auth-error-map'
import { trackAuthEvent } from '../api/auth-event-log'
import { studioClass } from '../lib/studio-tokens'

/**
 * ForgotPasswordPage — auth.md §3.4 / §6.4 / user_flow s1 (n6)
 *
 * - resetPasswordForEmail 호출 후 **결과와 무관하게 동일 안내 화면** 노출
 *   (enumeration 방지 — auth.md §4.4)
 * - 네트워크/5xx 같은 시스템성 에러만 별도 ErrorMessage 로 노출
 *
 * 디자인: docs/design-renewal/designFile/concepts/studio-domains.jsx (s1)
 */
export function ForgotPasswordPage(): JSX.Element {
  const { sendPasswordResetEmail } = useAuth()
  const [submitError, setSubmitError] = useState<MappedAuthError | null>(null)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(ForgotPasswordFormSchema),
    defaultValues: { email: '' },
    mode: 'onSubmit',
  })

  async function onSubmit(values: ForgotPasswordForm): Promise<void> {
    setSubmitError(null)
    const result = await sendPasswordResetEmail(values.email)
    if (!result.ok) {
      const mapped = mapAuthError(result.error)
      // network / 5xx / rate_limit 등 시스템성 에러만 사용자에게 노출.
      // 그 외는 enumeration 방지 위해 성공 화면과 동일 응답.
      if (
        mapped.code === 'network' ||
        mapped.code === 'server' ||
        mapped.code === 'over_rate_limit' ||
        mapped.code === 'unknown'
      ) {
        setSubmitError(mapped)
        if (mapped.shouldReport) {
          logger.error({ code: mapped.code }, 'reset email send failed')
        }
        return
      }
    }
    void trackAuthEvent({ event: 'auth.password_reset_requested' })
    setDone(true)
  }

  if (done) {
    return (
      <div className="w-full">
        <div className="mb-6 text-center">
          <h1 className={studioClass.h1}>{ko.auth.forgot.successTitle}</h1>
        </div>
        <Card className={cn(studioClass.card, 'text-center')}>
          <div className="relative mx-auto mb-5 h-[88px] w-[88px]">
            <div className="absolute inset-0 rounded-full bg-success-soft" />
            <div className="absolute inset-[14px] flex items-center justify-center rounded-full bg-success text-white">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <path d="M4 6h16v12H4z" />
                <path d="m4 6 8 7 8-7" />
              </svg>
            </div>
          </div>
          <p className={cn(studioClass.sub, 'leading-relaxed')}>
            {ko.auth.forgot.successBody}
          </p>
          <div className="mt-6">
            <Link to="/login" className={studioClass.linkAccent}>
              {ko.auth.forgot.backToLogin}
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h1 className={studioClass.h1}>{ko.auth.forgot.title}</h1>
        <p className={cn(studioClass.sub, 'mt-2')}>{ko.auth.forgot.subtitle}</p>
      </div>

      <Card className={studioClass.card}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
          aria-label={ko.auth.forgot.title}
        >
          <div>
            <Label htmlFor="forgot-email" className={studioClass.label}>
              {ko.auth.login.email}
            </Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder={ko.auth.login.emailPlaceholder}
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'forgot-email-error' : undefined}
              className={studioClass.input}
              {...register('email')}
            />
            {errors.email ? (
              <p
                id="forgot-email-error"
                role="alert"
                className={studioClass.helperError}
              >
                {errors.email.message}
              </p>
            ) : null}
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
            {isSubmitting ? ko.auth.forgot.submitting : ko.auth.forgot.submit}
          </Button>
        </form>

        <p className={cn('mt-6 text-center', studioClass.bodyFaint)}>
          <Link to="/login" className={studioClass.linkStrong}>
            {ko.auth.forgot.backToLogin}
          </Link>
        </p>
      </Card>
    </div>
  )
}

export default ForgotPasswordPage
