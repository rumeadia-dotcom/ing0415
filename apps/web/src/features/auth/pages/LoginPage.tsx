import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Card,
  ErrorMessage,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { SignInFormSchema, type SignInForm } from '@/lib/schemas/auth'
import { ko } from '@/locales/ko'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'
import { mapAuthError, type MappedAuthError } from '../lib/auth-error-map'
import { trackAuthEvent } from '../api/auth-event-log'
import { studioClass } from '../lib/studio-tokens'

/**
 * LoginPage — auth.md §6.2 / user_flow s1 (n2~n4)
 *
 * - RHF + zod (SignInFormSchema) + Supabase Auth signInWithPassword
 * - 에러는 mapAuthError 로 한국어 매핑 + ErrorMessage 노출
 * - 성공 시 location.state.from 또는 /dashboard 로 이동
 * - 소셜 로그인 탭은 v1 placeholder (Supabase provider 설정 후 활성)
 *
 * 디자인: docs/design-renewal/designFile/concepts/studio-domains.jsx (s1)
 */
export function LoginPage(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { signInWithPassword } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState<MappedAuthError | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SignInForm>({
    resolver: zodResolver(SignInFormSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  })

  async function onSubmit(values: SignInForm): Promise<void> {
    setSubmitError(null)
    const result = await signInWithPassword(values.email, values.password)
    if (!result.ok) {
      const mapped = mapAuthError(result.error)
      setSubmitError(mapped)
      if (mapped.shouldReport) {
        logger.error({ code: mapped.code }, 'login failed')
      } else {
        logger.warn({ code: mapped.code }, 'login rejected')
      }
      void trackAuthEvent({
        event: 'auth.login_failure',
        meta: { provider: 'email', code: mapped.code },
      })
      // auth.md §4.1: submit 직후 password 폼 state 비움
      reset({ email: values.email, password: '' })
      return
    }
    void trackAuthEvent({
      event: 'auth.login_success',
      meta: { provider: 'email' },
    })
    const from =
      typeof location.state === 'object' &&
      location.state !== null &&
      'from' in location.state &&
      typeof (location.state as { from: unknown }).from === 'string'
        ? (location.state as { from: string }).from
        : '/dashboard'
    navigate(from, { replace: true })
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h1 className={studioClass.h1}>{ko.auth.login.title}</h1>
        <p className={cn(studioClass.sub, 'mt-2')}>
          {ko.auth.login.subtitle}
        </p>
      </div>

      <Card className={studioClass.card}>
        <Tabs defaultValue="email" className="w-full">
          <TabsList
            className={cn(
              studioClass.card2,
              'grid h-auto w-full grid-cols-2 gap-0 p-1',
            )}
          >
            <TabsTrigger
              value="email"
              className={cn(
                studioClass.tabInactive,
                'data-[state=active]:!bg-white data-[state=active]:!text-[oklch(0.15_0.015_60)] data-[state=active]:!font-semibold data-[state=active]:!shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
              )}
            >
              {ko.auth.login.tabEmail}
            </TabsTrigger>
            <TabsTrigger
              value="social"
              className={cn(
                studioClass.tabInactive,
                'data-[state=active]:!bg-white data-[state=active]:!text-[oklch(0.15_0.015_60)] data-[state=active]:!font-semibold data-[state=active]:!shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
              )}
            >
              {ko.auth.login.tabSocial}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-5">
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-4"
              aria-label={ko.auth.login.title}
            >
              <div>
                <Label htmlFor="login-email" className={studioClass.label}>
                  {ko.auth.login.email}
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder={ko.auth.login.emailPlaceholder}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  className={studioClass.input}
                  {...register('email')}
                />
                {errors.email ? (
                  <p
                    id="login-email-error"
                    role="alert"
                    className={studioClass.helperError}
                  >
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="login-password"
                    className={cn(studioClass.label, 'mb-0')}
                  >
                    {ko.auth.login.password}
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-[11.5px] font-semibold text-[oklch(0.62_0.14_55)] hover:underline underline-offset-2"
                  >
                    {ko.auth.login.forgot}
                  </Link>
                </div>
                <div className="relative mt-1.5">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={ko.auth.login.passwordPlaceholder}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    aria-describedby={
                      errors.password ? 'login-password-error' : undefined
                    }
                    className={cn(studioClass.input, 'pr-14')}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                    aria-label={
                      showPassword
                        ? ko.auth.login.passwordHide
                        : ko.auth.login.passwordShow
                    }
                    className={studioClass.passwordToggle}
                  >
                    {showPassword ? '숨김' : '표시'}
                  </button>
                </div>
                {errors.password ? (
                  <p
                    id="login-password-error"
                    role="alert"
                    className={studioClass.helperError}
                  >
                    {errors.password.message}
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
                {isSubmitting ? ko.auth.login.submitting : ko.auth.login.submit}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="social" className="mt-5">
            <div
              className={cn(
                studioClass.card2,
                'px-4 py-7 text-center text-[13px] text-[oklch(0.48_0.012_60)]',
              )}
              role="note"
            >
              {ko.auth.login.socialNotice}
            </div>
          </TabsContent>
        </Tabs>

        <div className={cn('mt-6 text-center', studioClass.bodyFaint)}>
          {ko.auth.common.noAccount}{' '}
          <Link to="/signup" className={studioClass.linkStrong}>
            {ko.auth.login.signup}
          </Link>
        </div>
      </Card>
    </div>
  )
}

export default LoginPage
