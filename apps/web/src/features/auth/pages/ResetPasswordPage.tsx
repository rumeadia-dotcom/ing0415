import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/lib/use-document-title'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Button,
  Card,
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
import { studioClass } from '../lib/studio-tokens'

/**
 * ResetPasswordPage — auth.md §3.4 / §6.5 / user_flow s1
 *
 * - 진입 조건: Supabase recovery 세션이 URL fragment 로 자동 수립된 상태.
 *   `detectSessionInUrl: true` 가 supabase.ts 에 켜져 있어 자동 처리.
 * - 세션이 없으면 만료/유효하지 않은 링크로 간주 — invalidSession 메시지.
 * - 성공 시 signOut(global) 으로 모든 기존 세션 무효화 후 /login + 토스트.
 *
 * 디자인: docs/design-renewal/designFile/concepts/studio-domains.jsx (s1)
 */
export function ResetPasswordPage(): JSX.Element {
  useDocumentTitle('비밀번호 재설정')
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

  // 로딩 중에는 단순 안내
  if (status === 'loading') {
    return (
      <div className="w-full">
        <div className="mb-6 text-center">
          <h1 className={studioClass.h1}>{ko.auth.reset.title}</h1>
        </div>
        <Card className={cn(studioClass.card, 'text-center')}>
          <p
            role="status"
            aria-live="polite"
            className={studioClass.sub}
          >
            {ko.auth.reset.checkingSession}
          </p>
        </Card>
      </div>
    )
  }

  // recovery 세션이 수립되지 않은 진입 — 만료/유효하지 않은 링크
  if (!session) {
    return (
      <div className="w-full">
        <div className="mb-6 text-center">
          <h1 className={studioClass.h1}>{ko.auth.reset.title}</h1>
          <p className={cn(studioClass.sub, 'mt-2')}>
            {ko.auth.reset.invalidSession}
          </p>
        </div>
        <Card className={cn(studioClass.card, 'text-center')}>
          <Link to="/forgot-password" className={studioClass.linkAccent}>
            {ko.auth.reset.requestAgain}
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h1 className={studioClass.h1}>{ko.auth.reset.title}</h1>
        <p className={cn(studioClass.sub, 'mt-2')}>{ko.auth.reset.subtitle}</p>
      </div>

      <Card className={studioClass.card}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
          aria-label={ko.auth.reset.title}
        >
          <div>
            <Label htmlFor="reset-password" className={studioClass.label}>
              {ko.auth.reset.newPassword}
            </Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              className={studioClass.input}
              {...register('password')}
            />
            {passwordValue.length > 0 ? (
              <div className="mt-2 space-y-1" aria-live="polite">
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded',
                        i <= strength.score
                          ? strength.toneClass
                          : 'bg-border',
                      )}
                    />
                  ))}
                  <span className="ml-2 text-[11.5px] text-dim">
                    {strength.label}
                  </span>
                </div>
              </div>
            ) : null}
            {errors.password ? (
              <p role="alert" className={studioClass.helperError}>
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div>
            <Label
              htmlFor="reset-password-confirm"
              className={studioClass.label}
            >
              {ko.auth.reset.passwordConfirm}
            </Label>
            <Input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.passwordConfirm ? 'true' : 'false'}
              className={studioClass.input}
              {...register('passwordConfirm')}
            />
            {errors.passwordConfirm ? (
              <p role="alert" className={studioClass.helperError}>
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
            size="lg"
            className={studioClass.ctaPrimary}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? ko.auth.reset.submitting : ko.auth.reset.submit}
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default ResetPasswordPage
