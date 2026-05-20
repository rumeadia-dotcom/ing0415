import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { SignInFormSchema, type SignInForm } from '@/lib/schemas/auth'
import { ko } from '@/locales/ko'
import { logger } from '@/lib/logger'
import { useAuth } from '../context/AuthContext'
import { mapAuthError, type MappedAuthError } from '../lib/auth-error-map'
import { trackAuthEvent } from '../api/auth-event-log'

/**
 * LoginPage — auth.md §6.2 / user_flow s1 (n2~n4)
 *
 * - RHF + zod (SignInFormSchema) + Supabase Auth signInWithPassword
 * - 에러는 mapAuthError 로 한국어 매핑 + ErrorMessage 노출
 * - 성공 시 location.state.from 또는 /dashboard 로 이동
 * - 소셜 로그인 탭은 v1 placeholder (Supabase provider 설정 후 활성)
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
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{ko.auth.login.title}</CardTitle>
        <CardDescription>{ko.auth.login.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">{ko.auth.login.tabEmail}</TabsTrigger>
            <TabsTrigger value="social">{ko.auth.login.tabSocial}</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-4">
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-4"
              aria-label={ko.auth.login.title}
            >
              <div className="space-y-1.5">
                <Label htmlFor="login-email">{ko.auth.login.email}</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder={ko.auth.login.emailPlaceholder}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  {...register('email')}
                />
                {errors.email ? (
                  <p
                    id="login-email-error"
                    role="alert"
                    className="text-xs text-danger"
                  >
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password">{ko.auth.login.password}</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={ko.auth.login.passwordPlaceholder}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    aria-describedby={
                      errors.password ? 'login-password-error' : undefined
                    }
                    className="pr-10"
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
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-xs text-text-secondary hover:text-text focus-visible:outline-none focus-visible:underline"
                  >
                    {showPassword ? '숨김' : '표시'}
                  </button>
                </div>
                {errors.password ? (
                  <p
                    id="login-password-error"
                    role="alert"
                    className="text-xs text-danger"
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
                className="w-full"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? ko.auth.login.submitting : ko.auth.login.submit}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="social" className="mt-4">
            <div
              className="rounded-md border border-border bg-surface-muted px-3 py-6 text-center text-sm text-text-secondary"
              role="note"
            >
              {ko.auth.login.socialNotice}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link
            to="/forgot-password"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            {ko.auth.login.forgot}
          </Link>
          <span className="text-text-secondary">
            {ko.auth.common.noAccount}{' '}
            <Link
              to="/signup"
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              {ko.auth.login.signup}
            </Link>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export default LoginPage
