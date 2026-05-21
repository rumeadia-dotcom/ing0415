import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
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
import { ko } from '@/locales/ko'
import {
  LogenCredentialsInputSchema,
  type LogenCredentialsInput,
} from '@/lib/schemas/logen'
import { useLogenCredentialsUpsert } from '../hooks/useLogenSenderInfo'
import { useLogenVerifyCredential } from '../hooks/useLogenVerifyCredential'
import { LogenApiInvocationError } from '../api/shipping-settings-api'
import { useLogenCredentialsStatus } from '../hooks/useLogenCredentialsStatus'

/**
 * SettingsShippingLogenPage — n59 (/settings/shipping/logen).
 *
 * 마스터: docs/spec/user_flow-v2-shipping.md s9 n59
 *         docs/spec/PRD-v2-shipping.md §4
 *
 * 책임:
 *  - userId / custCd 입력 (RHF + LogenCredentialsInputSchema)
 *  - 저장 → set_logen_credentials RPC (Edge 가 pgcrypto 암호화)
 *  - [연결 테스트] → logen-verify-credential Edge Function invoke
 *  - 성공 시 활성 표시 + n58 으로 리다이렉트
 *  - 실패 시 ErrorMessage (잘못된 코드 / 계약 미완료 분기)
 *
 * 4상태:
 *  - loading: 자격증명 상태 fetch + mutation pending
 *  - error: ErrorMessage with formatted code
 *  - data: 폼 (저장 + 검증)
 *  - empty: status.hasCredentials === false → 동일 폼, 자격증명 신규 입력
 */
export function SettingsShippingLogenPage(): JSX.Element {
  const navigate = useNavigate()
  const status = useLogenCredentialsStatus()
  const upsert = useLogenCredentialsUpsert()
  const verify = useLogenVerifyCredential()

  const [verifySuccess, setVerifySuccess] = useState<string | null>(null)
  const [serverError, setServerError] = useState<{
    message: string
    correlationId: string | null
    code: string | null
  } | null>(null)

  const form = useForm<LogenCredentialsInput>({
    resolver: zodResolver(LogenCredentialsInputSchema) as Resolver<LogenCredentialsInput>,
    defaultValues: { userId: '', custCd: '' },
  })

  const t = ko.settings.shipping.logenPage
  const isSubmitting = upsert.isPending || verify.isPending

  function handleError(err: unknown): void {
    if (err instanceof LogenApiInvocationError) {
      const errors = ko.settings.shipping.errors
      const msg =
        err.code in errors
          ? (errors as Record<string, string>)[err.code]
          : err.message
      setServerError({
        message: msg ?? ko.settings.shipping.errors.internal,
        correlationId: err.correlationId,
        code: err.code,
      })
      return
    }
    setServerError({
      message:
        err instanceof Error ? err.message : ko.settings.shipping.errors.internal,
      correlationId: null,
      code: null,
    })
  }

  function onSaveAndVerify(values: LogenCredentialsInput): void {
    setServerError(null)
    setVerifySuccess(null)
    upsert.mutate(
      { userId: values.userId, custCd: values.custCd },
      {
        onSuccess: () => {
          verify.mutate(
            { source: 'inline', credentials: values },
            {
              onSuccess: () => {
                setVerifySuccess(t.verifySuccess)
                toast.success(t.verifySuccess)
                // 짧은 지연 후 n58 로 이동 (사용자가 결과를 볼 수 있도록)
                window.setTimeout(() => {
                  navigate('/settings/shipping', { replace: true })
                }, 800)
              },
              onError: handleError,
            },
          )
        },
        onError: handleError,
      },
    )
  }

  function onVerifyStored(): void {
    setServerError(null)
    setVerifySuccess(null)
    verify.mutate(
      { source: 'stored' },
      {
        onSuccess: () => {
          setVerifySuccess(t.verifySuccess)
          toast.success(t.verifySuccess)
        },
        onError: handleError,
      },
    )
  }

  const hasStoredCreds = status.data?.hasCredentials === true

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.helperContract}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(onSaveAndVerify)}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="logen-userId">{t.userIdLabel}</Label>
              <Input
                id="logen-userId"
                type="text"
                autoComplete="off"
                placeholder={t.userIdPlaceholder}
                aria-invalid={form.formState.errors.userId ? true : undefined}
                {...form.register('userId')}
              />
              {form.formState.errors.userId && (
                <p role="alert" className="text-xs text-danger-on-soft">
                  {form.formState.errors.userId.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="logen-custCd">{t.custCdLabel}</Label>
              <Input
                id="logen-custCd"
                type="text"
                autoComplete="off"
                placeholder={t.custCdPlaceholder}
                aria-invalid={form.formState.errors.custCd ? true : undefined}
                {...form.register('custCd')}
              />
              {form.formState.errors.custCd && (
                <p role="alert" className="text-xs text-danger-on-soft">
                  {form.formState.errors.custCd.message}
                </p>
              )}
            </div>

            {serverError && (
              <ErrorMessage
                message={serverError.message}
                {...(serverError.correlationId
                  ? { details: `요청 ID: ${serverError.correlationId}` }
                  : {})}
              />
            )}

            {verifySuccess && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success-on-soft"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {verifySuccess}
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild variant="ghost" type="button">
                <Link to="/settings/shipping">{t.backLink}</Link>
              </Button>
              {hasStoredCreds && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onVerifyStored}
                  disabled={isSubmitting}
                >
                  {verify.isPending ? t.verifying : t.verify}
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {upsert.isPending
                  ? t.saving
                  : verify.isPending
                    ? t.verifying
                    : t.saveAndVerify}
              </Button>
            </div>
            <p className="text-xs text-text-tertiary">{t.verifyDescription}</p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsShippingLogenPage
