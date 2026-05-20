import { useState } from 'react'
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
import {
  ForgotPasswordFormSchema,
  type ForgotPasswordForm,
} from '@/lib/schemas/auth'
import { ko } from '@/locales/ko'
import { logger } from '@/lib/logger'
import { useAuth } from '../context/AuthContext'
import { mapAuthError, type MappedAuthError } from '../lib/auth-error-map'
import { trackAuthEvent } from '../api/auth-event-log'

/**
 * ForgotPasswordPage — auth.md §3.4 / §6.4 / user_flow s1 (n6)
 *
 * - resetPasswordForEmail 호출 후 **결과와 무관하게 동일 안내 화면** 노출
 *   (enumeration 방지 — auth.md §4.4)
 * - 네트워크/5xx 같은 시스템성 에러만 별도 ErrorMessage 로 노출
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{ko.auth.forgot.successTitle}</CardTitle>
          <CardDescription>{ko.auth.forgot.successBody}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link
            to="/login"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            {ko.auth.forgot.backToLogin}
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{ko.auth.forgot.title}</CardTitle>
        <CardDescription>{ko.auth.forgot.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
          aria-label={ko.auth.forgot.title}
        >
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">{ko.auth.login.email}</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder={ko.auth.login.emailPlaceholder}
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'forgot-email-error' : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <p
                id="forgot-email-error"
                role="alert"
                className="text-xs text-danger"
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
            className="w-full"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? ko.auth.forgot.submitting : ko.auth.forgot.submit}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link
            to="/login"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            {ko.auth.forgot.backToLogin}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default ForgotPasswordPage
