import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
  Skeleton,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import {
  LogenSenderInfoSchema,
  type LogenSenderInfo,
} from '@/lib/schemas/logen'
import { useLogenSenderInfoUpdate } from '../hooks/useLogenSenderInfo'
import { useLogenCredentialsStatus } from '../hooks/useLogenCredentialsStatus'
import { LogenApiInvocationError } from '../api/shipping-settings-api'

/**
 * SettingsShippingSenderPage — n60 (/settings/shipping/sender).
 *
 * 마스터: docs/spec/user_flow-v2-shipping.md s9 n60
 *         docs/spec/PRD-v2-shipping.md §4 (logen_credentials)
 *
 * 책임:
 *  - 발송인명 / 발송지 주소 / 연락처 / fareTy / dlvFare 입력
 *  - RHF + LogenSenderInfoSchema
 *  - 저장 → set_logen_credentials RPC (senderInfo 단독 갱신)
 *
 * 4상태:
 *  - loading: 초기 fetch (status hook) — 스켈레톤
 *  - error: ErrorMessage
 *  - data: 폼 + 기존 값 prefill
 *  - empty: hasSenderInfo === false → 빈 폼
 */
export function SettingsShippingSenderPage(): JSX.Element {
  const navigate = useNavigate()
  const status = useLogenCredentialsStatus()
  const update = useLogenSenderInfoUpdate()

  const [serverError, setServerError] = useState<{
    message: string
    correlationId: string | null
  } | null>(null)

  const form = useForm<LogenSenderInfo>({
    resolver: zodResolver(LogenSenderInfoSchema) as Resolver<LogenSenderInfo>,
    defaultValues: {
      senderName: '',
      senderAddress: '',
      senderPhone: '',
      fareTy: 'C',
      dlvFare: 0,
    },
  })

  // 기존 발송인 정보 로딩 시 폼에 prefill
  useEffect(() => {
    if (status.data?.senderInfo) {
      form.reset(status.data.senderInfo)
    }
  }, [status.data?.senderInfo, form])

  const t = ko.settings.shipping.senderPage

  function onSubmit(values: LogenSenderInfo): void {
    setServerError(null)
    update.mutate(values, {
      onSuccess: () => {
        toast.success(t.savedToast)
        navigate('/settings/shipping', { replace: true })
      },
      onError: (err) => {
        if (err instanceof LogenApiInvocationError) {
          const errors = ko.settings.shipping.errors
          const msg =
            err.code in errors
              ? (errors as Record<string, string>)[err.code]
              : err.message
          setServerError({
            message: msg ?? ko.settings.shipping.errors.internal,
            correlationId: err.correlationId,
          })
        } else {
          setServerError({
            message:
              err instanceof Error
                ? err.message
                : ko.settings.shipping.errors.internal,
            correlationId: null,
          })
        }
      },
    })
  }

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      {status.isPending && (
        <div role="status" aria-live="polite" aria-label="발송인 정보 불러오는 중">
          <Skeleton className="h-[480px] w-full" />
        </div>
      )}

      {status.isError && (
        <ErrorMessage
          message={ko.settings.shipping.errors.internal}
          {...(status.error instanceof Error
            ? { details: status.error.message }
            : {})}
        />
      )}

      {status.isSuccess && (
        <Card>
          <CardHeader>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
            >
              <Field
                id="sender-name"
                label={t.senderNameLabel}
                placeholder={t.senderNamePlaceholder}
                register={form.register('senderName')}
                error={form.formState.errors.senderName?.message}
              />
              <Field
                id="sender-address"
                label={t.senderAddressLabel}
                placeholder={t.senderAddressPlaceholder}
                register={form.register('senderAddress')}
                error={form.formState.errors.senderAddress?.message}
              />
              <Field
                id="sender-phone"
                label={t.senderPhoneLabel}
                placeholder={t.senderPhonePlaceholder}
                register={form.register('senderPhone')}
                error={form.formState.errors.senderPhone?.message}
                inputMode="tel"
              />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sender-fareTy">{t.fareTyLabel}</Label>
                <select
                  id="sender-fareTy"
                  className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  aria-invalid={form.formState.errors.fareTy ? true : undefined}
                  {...form.register('fareTy')}
                >
                  <option value="C">C — 선불 (계약)</option>
                  <option value="S">S — 착불</option>
                  <option value="R">R — 신용</option>
                </select>
                <p className="text-xs text-text-tertiary">{t.fareTyHelp}</p>
                {form.formState.errors.fareTy && (
                  <p role="alert" className="text-xs text-danger-on-soft">
                    {form.formState.errors.fareTy.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sender-dlvFare">{t.dlvFareLabel}</Label>
                <Input
                  id="sender-dlvFare"
                  type="number"
                  inputMode="numeric"
                  placeholder={t.dlvFarePlaceholder}
                  aria-invalid={form.formState.errors.dlvFare ? true : undefined}
                  {...form.register('dlvFare', { valueAsNumber: true })}
                />
                <p className="text-xs text-text-tertiary">{t.dlvFareHelp}</p>
                {form.formState.errors.dlvFare && (
                  <p role="alert" className="text-xs text-danger-on-soft">
                    {form.formState.errors.dlvFare.message}
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

              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild variant="ghost" type="button">
                  <Link to="/settings/shipping">{t.backLink}</Link>
                </Button>
                <Button type="submit" variant="primary" disabled={update.isPending}>
                  {update.isPending ? t.saving : t.save}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Field — register / error 매핑 묶음
// ─────────────────────────────────────────────

interface FieldProps {
  id: string
  label: string
  placeholder?: string
  inputMode?: 'text' | 'tel' | 'numeric'
  register: ReturnType<ReturnType<typeof useForm>['register']>
  error: string | undefined
}

function Field({
  id,
  label,
  placeholder,
  inputMode,
  register,
  error,
}: FieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        {...(placeholder ? { placeholder } : {})}
        {...(inputMode ? { inputMode } : {})}
        aria-invalid={error ? true : undefined}
        {...register}
      />
      {error && (
        <p role="alert" className="text-xs text-danger-on-soft">
          {error}
        </p>
      )}
    </div>
  )
}

export default SettingsShippingSenderPage
