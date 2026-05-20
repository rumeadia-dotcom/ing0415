import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
  ResetPasswordFormSchema,
  type ResetPasswordForm,
} from '@/lib/schemas/auth'
import { ko } from '@/locales/ko'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'
import { mapAuthError, type MappedAuthError } from '../lib/auth-error-map'
import { trackAuthEvent } from '../api/auth-event-log'
import { evaluatePasswordStrength } from '../lib/password-strength'

/**
 * ResetPasswordPage — auth.md §3.4 / §6.5 / user_flow s1
 *
 * - 진입 조건: Supabase recovery 세션이 URL fragment 로 자동 수립된 상태.
 *   `detectSessionInUrl: true` 가 supabase.ts 에 켜져 있어 자동 처리.
 * - 세션이 없으면 만료/유효하지 않은 링크로 간주 — invalidSession 메시지.
 * - 성공 시 signOut(global) 으로 모든 기존 세션 무효화 후 /login + 토스트.
 */
export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate()
  const { session, status, updatePassword, signOut } = useAuth()
  const [submitError, setSubmitError] = useState<MappedAuthError | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: { password: '', passwordConfirm: '' },
    mode: 'onSubmit',
  })

  const passwordValue = watch('password') ?? ''
  const strength = useMemo(
    () => evaluatePasswordStrength(passwordValue),
    [passwordValue],
  )

  // 진입 시 세션 유무 디버그 로그 (PII 미포함)
  useEffect(() => {
    if (status !== 'loading') {
      logger.debug({ hasSession: status === 'authed' }, 'reset-password mount')
    }
  }, [status])

  async function onSubmit(values: ResetPasswordForm): Promise<void> {
    setSubmitError(null)
    const result = await updatePassword(values.password)
    if (!result.ok) {
      const mapped = mapAuthError(result.error)
      setSubmitError(mapped)
      if (mapped.shouldReport) {
        logger.error({ code: mapped.code }, 'password update failed')
      }
      reset({ password: '', passwordConfirm: '' })
      return
    }
    void trackAuthEvent({ event: 'auth.password_reset_completed' })
    // auth.md §3.4: 재설정 후 모든 기존 세션 무효화
    void trackAuthEvent({ event: 'auth.session_revoked_global' })
    await signOut()
    toast.success(ko.auth.reset.successToast)
    navigate('/login', { replace: true })
  }

  // 로딩 중에는 단순 안내 (Skeleton 은 RequireAuth 외 진입이라 가벼운 텍스트로)
  if (status === 'loading') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{ko.auth.reset.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            role="status"
            aria-live="polite"
            className="text-center text-sm text-text-secondary"
          >
            세션을 확인하는 중…
          </p>
        </CardContent>
      </Card>
    )
  }

  // recovery 세션이 수립되지 않은 진입 — 만료/유효하지 않은 링크
  if (!session) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{ko.auth.reset.title}</CardTitle>
          <CardDescription>{ko.auth.reset.invalidSession}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            {ko.auth.reset.requestAgain}
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{ko.auth.reset.title}</CardTitle>
        <CardDescription>{ko.auth.reset.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
          aria-label={ko.auth.reset.title}
        >
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">{ko.auth.reset.newPassword}</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              {...register('password')}
            />
            {passwordValue.length > 0 ? (
              <div className="space-y-1" aria-live="polite">
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded',
                        i <= strength.score ? strength.toneClass : 'bg-surface-muted',
                      )}
                    />
                  ))}
                  <span className="ml-2 text-xs text-text-secondary">
                    {strength.label}
                  </span>
                </div>
              </div>
            ) : null}
            {errors.password ? (
              <p role="alert" className="text-xs text-danger">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reset-password-confirm">
              {ko.auth.reset.passwordConfirm}
            </Label>
            <Input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.passwordConfirm ? 'true' : 'false'}
              {...register('passwordConfirm')}
            />
            {errors.passwordConfirm ? (
              <p role="alert" className="text-xs text-danger">
                {errors.passwordConfirm.message}
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
            {isSubmitting ? ko.auth.reset.submitting : ko.auth.reset.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default ResetPasswordPage
