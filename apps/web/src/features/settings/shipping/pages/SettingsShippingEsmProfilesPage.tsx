import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, Truck, PackageOpen } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorMessage,
  Input,
  Label,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'
import {
  EsmShippingProfileCreateInputSchema,
  ESM_DISPATCH_TYPES,
  type EsmShippingProfile,
  type EsmShippingProfileCreateInput,
  type EsmProfileSite,
} from '@/lib/schemas/esm'
import type { MarketAccount } from '@/lib/schemas/markets-feature'
import { SettingsNav } from '../../components/SettingsNav'
import { useMarketAccounts } from '@/features/markets/hooks/useMarketAccounts'
import { useEsmShippingProfiles } from '../hooks/useEsmShippingProfiles'
import { useCreateEsmShippingProfile } from '../hooks/useCreateEsmShippingProfile'
import { EsmShippingProfileError } from '../api/esm-shipping-profile-api'

/**
 * SettingsShippingEsmProfilesPage — /settings/shipping/esm-profiles.
 *
 * 마스터: docs/architecture/v1/features/esm.md §3 / §5 / §7(PR-3)
 *         docs/spec/user_flow.md s9 n61 / docs/design-renewal/s5-markets.md
 *
 * 책임:
 *  - ESM(G마켓/옥션) 배송 프로필 목록 (마켓 계정별)
 *  - 생성 폼 (Dialog) → Edge Function `esm-shipping-profile` 4단계 생성 → 목록 갱신
 *  - 상품등록 3단계(PR-3.5)는 이 프로필을 select 만 — 본 화면이 유일한 생성 진입점.
 *
 * 4상태 (목록):
 *  - loading: 스켈레톤
 *  - error: ErrorMessage
 *  - data: 프로필 카드/테이블
 *  - empty: 프로필 0개 (안내 + CTA)
 *  - (별도) ESM 계정 미연결: 생성 자체 불가 → noEsmAccount 안내 + 마켓 연결 CTA
 */
export function SettingsShippingEsmProfilesPage(): JSX.Element {
  const t = ko.settings.shipping.esmProfiles
  const accountsQuery = useMarketAccounts()
  const profilesQuery = useEsmShippingProfiles()

  const [dialogOpen, setDialogOpen] = useState(false)

  // 연결된 ESM(G마켓/옥션) 계정만 — 생성 대상.
  const esmAccounts = useMemo<MarketAccount[]>(
    () =>
      (accountsQuery.data ?? []).filter(
        (a) =>
          (a.marketId === 'gmarket' || a.marketId === 'auction') &&
          a.status === 'active',
      ),
    [accountsQuery.data],
  )
  const accountLabelById = useMemo(() => {
    const m = new Map<string, MarketAccount>()
    for (const a of accountsQuery.data ?? []) m.set(a.id, a)
    return m
  }, [accountsQuery.data])

  const hasEsmAccount = esmAccounts.length > 0

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <div
        className={cn(
          'grid grid-cols-1 gap-6',
          'md:grid-cols-[220px_minmax(0,1fr)] md:gap-8',
        )}
      >
        <aside>
          <SettingsNav active="shipping" />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-4 w-4" aria-hidden="true" />
                    {t.listTitle}
                  </CardTitle>
                  <CardDescription>{t.listDescription}</CardDescription>
                </div>
                <AddProfileButton
                  hasEsmAccount={hasEsmAccount}
                  onClick={() => setDialogOpen(true)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* ESM 계정 미연결 — 생성 불가 안내 (목록 로딩과 독립) */}
              {accountsQuery.isSuccess && !hasEsmAccount ? (
                <NoEsmAccountNotice />
              ) : (
                <ProfilesBody
                  isPending={profilesQuery.isPending}
                  isError={profilesQuery.isError}
                  error={profilesQuery.error}
                  profiles={profilesQuery.data ?? []}
                  accountLabelById={accountLabelById}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {hasEsmAccount && (
        <CreateProfileDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          accounts={esmAccounts}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 생성 버튼 — blockingReasons tooltip (실행류)
// ─────────────────────────────────────────────

function AddProfileButton({
  hasEsmAccount,
  onClick,
}: {
  hasEsmAccount: boolean
  onClick: () => void
}): JSX.Element {
  const t = ko.settings.shipping.esmProfiles
  const blockingReasons = hasEsmAccount ? [] : [t.blocking.noAccount]
  const disabled = blockingReasons.length > 0

  const button = (
    <Button
      type="button"
      variant="primary"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
    >
      <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
      {t.addCta}
    </Button>
  )

  if (!disabled) return button

  return (
    <TooltipProvider>
      <Tooltip>
        {/* disabled 버튼은 pointer 이벤트가 없어 tooltip 이 안 뜨므로 span 래핑 */}
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            aria-disabled="true"
            aria-label={blockingReasons.join(' · ')}
            className="inline-flex"
          >
            {button}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <ul className="space-y-0.5">
            {blockingReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─────────────────────────────────────────────
// 목록 본문 — 4상태 (loading / error / empty / data)
// ─────────────────────────────────────────────

function ProfilesBody({
  isPending,
  isError,
  error,
  profiles,
  accountLabelById,
}: {
  isPending: boolean
  isError: boolean
  error: unknown
  profiles: EsmShippingProfile[]
  accountLabelById: Map<string, MarketAccount>
}): JSX.Element {
  const t = ko.settings.shipping.esmProfiles

  if (isPending) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="배송 프로필을 불러오는 중"
        className="space-y-3"
      >
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        message={t.errors.fetch}
        {...(error instanceof Error ? { details: error.message } : {})}
      />
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <PackageOpen
          className="h-8 w-8 text-text-tertiary"
          aria-hidden="true"
        />
        <p className="font-medium text-text">{t.empty.title}</p>
        <p className="max-w-md text-sm text-text-secondary">{t.empty.body}</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {profiles.map((p) => (
        <ProfileRow
          key={p.id}
          profile={p}
          accountLabel={
            accountLabelById.get(p.marketAccountId)?.accountLabel ?? null
          }
        />
      ))}
    </ul>
  )
}

function ProfileRow({
  profile,
  accountLabel,
}: {
  profile: EsmShippingProfile
  accountLabel: string | null
}): JSX.Element {
  const t = ko.settings.shipping.esmProfiles
  const feeText =
    profile.shippingFee > 0
      ? `${profile.shippingFee.toLocaleString('ko-KR')}${t.feeUnit}`
      : t.feeFree

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-text">
            {profile.profileLabel}
          </span>
          <Badge variant="secondary">{t.siteLabel[profile.site]}</Badge>
          <Badge variant={profile.status === 'active' ? 'success' : 'warning'}>
            {t.statusLabel[profile.status]}
          </Badge>
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-secondary">
          {accountLabel && (
            <div className="flex gap-1">
              <dt className="text-text-tertiary">{t.columns.site}</dt>
              <dd>{accountLabel}</dd>
            </div>
          )}
          <div className="flex gap-1">
            <dt className="text-text-tertiary">{t.columns.dispatchType}</dt>
            <dd>{t.dispatchTypeLabels[profile.dispatchType]}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-text-tertiary">{t.columns.fee}</dt>
            <dd>{feeText}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-text-tertiary">{t.columns.dispatchPolicyNo}</dt>
            <dd className="font-mono">{profile.dispatchPolicyNo}</dd>
          </div>
        </dl>
      </div>
    </li>
  )
}

// ─────────────────────────────────────────────
// ESM 계정 미연결 안내
// ─────────────────────────────────────────────

function NoEsmAccountNotice(): JSX.Element {
  const t = ko.settings.shipping.esmProfiles.noEsmAccount
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <PackageOpen className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
      <p className="font-medium text-text">{t.title}</p>
      <p className="max-w-md text-sm text-text-secondary">{t.body}</p>
      <Button asChild variant="outline" size="sm">
        <Link to="/markets/connect">{t.cta}</Link>
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────
// 생성 Dialog — RHF + EsmShippingProfileCreateInputSchema
// ─────────────────────────────────────────────

type CreateFormValues = EsmShippingProfileCreateInput

const SITE_BY_MARKET: Record<string, EsmProfileSite> = {
  gmarket: 'G',
  auction: 'A',
}

function CreateProfileDialog({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: MarketAccount[]
}): JSX.Element {
  const t = ko.settings.shipping.esmProfiles
  const create = useCreateEsmShippingProfile()
  const [serverError, setServerError] = useState<{
    message: string
    correlationId: string | null
  } | null>(null)

  const firstAccount = accounts[0]
  const defaultSite: EsmProfileSite = firstAccount
    ? (SITE_BY_MARKET[firstAccount.marketId] ?? 'G')
    : 'G'

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(
      EsmShippingProfileCreateInputSchema,
    ) as Resolver<CreateFormValues>,
    defaultValues: {
      marketAccountId: firstAccount?.id ?? '',
      site: defaultSite,
      profileLabel: '',
      dispatchType: 'B',
      shippingFee: 3000,
      feeType: 1,
      address: {
        zipCode: '',
        addressMain: '',
        addressDetail: '',
        contactName: '',
        contactPhone: '',
      },
    },
  })

  const errors = form.formState.errors

  // 계정 선택 변경 시 site 동기화 (site 는 폼 hidden 필드).
  function onAccountChange(accountId: string): void {
    form.setValue('marketAccountId', accountId, { shouldValidate: true })
    const acc = accounts.find((a) => a.id === accountId)
    if (acc) {
      form.setValue('site', SITE_BY_MARKET[acc.marketId] ?? 'G', {
        shouldValidate: true,
      })
    }
  }

  function onSubmit(values: CreateFormValues): void {
    setServerError(null)
    create.mutate(values, {
      onSuccess: () => {
        toast.success(t.toast.createSuccess)
        form.reset()
        onOpenChange(false)
      },
      onError: (err) => {
        const code = err instanceof EsmShippingProfileError ? err.code : null
        const correlationId =
          err instanceof EsmShippingProfileError ? err.correlationId : null
        const dict = t.errors as Record<string, string>
        const message =
          (code && code in dict ? dict[code] : undefined) ?? t.toast.createError
        setServerError({ message, correlationId })
        toast.error(t.toast.createError)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t.dialog.title}</DialogTitle>
          <DialogDescription>{t.dialog.description}</DialogDescription>
        </DialogHeader>

        <form
          id="esm-profile-create-form"
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          {/* 마켓 계정 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="esm-profile-account">{t.dialog.accountLabel}</Label>
            <select
              id="esm-profile-account"
              className={selectClass}
              aria-invalid={errors.marketAccountId ? 'true' : 'false'}
              value={form.watch('marketAccountId')}
              onChange={(e) => onAccountChange(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountLabel} ({t.siteLabel[SITE_BY_MARKET[a.marketId] ?? 'G']})
                </option>
              ))}
            </select>
            {errors.marketAccountId && (
              <FieldError id="esm-profile-account-error">
                {errors.marketAccountId.message}
              </FieldError>
            )}
          </div>

          {/* 프로필명 */}
          <FieldText
            id="esm-profile-label"
            label={t.dialog.profileLabelLabel}
            placeholder={t.dialog.profileLabelPlaceholder}
            register={form.register('profileLabel')}
            error={errors.profileLabel?.message}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 발송유형 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="esm-profile-dispatch">
                {t.dialog.dispatchTypeLabel}
              </Label>
              <select
                id="esm-profile-dispatch"
                className={selectClass}
                aria-invalid={errors.dispatchType ? 'true' : 'false'}
                {...form.register('dispatchType')}
              >
                {ESM_DISPATCH_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {t.dispatchTypeLabels[d]}
                  </option>
                ))}
              </select>
              {errors.dispatchType && (
                <FieldError id="esm-profile-dispatch-error">
                  {errors.dispatchType.message}
                </FieldError>
              )}
            </div>

            {/* 배송비 유형 */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="esm-profile-feetype">{t.dialog.feeTypeLabel}</Label>
              <select
                id="esm-profile-feetype"
                className={selectClass}
                aria-invalid={errors.feeType ? 'true' : 'false'}
                {...form.register('feeType', { valueAsNumber: true })}
              >
                <option value={1}>{t.feeTypeLabels['1']}</option>
                <option value={2}>{t.feeTypeLabels['2']}</option>
              </select>
              {errors.feeType && (
                <FieldError id="esm-profile-feetype-error">
                  {errors.feeType.message}
                </FieldError>
              )}
            </div>
          </div>

          {/* 배송비 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="esm-profile-fee">{t.dialog.shippingFeeLabel}</Label>
            <Input
              id="esm-profile-fee"
              type="number"
              inputMode="numeric"
              placeholder={t.dialog.shippingFeePlaceholder}
              aria-invalid={errors.shippingFee ? 'true' : 'false'}
              aria-describedby={
                errors.shippingFee ? 'esm-profile-fee-error' : undefined
              }
              {...form.register('shippingFee', { valueAsNumber: true })}
            />
            {errors.shippingFee && (
              <FieldError id="esm-profile-fee-error">
                {errors.shippingFee.message}
              </FieldError>
            )}
          </div>

          {/* 주소 섹션 (PII — ESM 에만 전달) */}
          <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium text-text-tertiary">
              {t.dialog.addressSectionLabel}
            </legend>
            <FieldText
              id="esm-profile-zip"
              label={t.dialog.zipCodeLabel}
              register={form.register('address.zipCode')}
              error={errors.address?.zipCode?.message}
              inputMode="numeric"
            />
            <FieldText
              id="esm-profile-addr-main"
              label={t.dialog.addressMainLabel}
              register={form.register('address.addressMain')}
              error={errors.address?.addressMain?.message}
            />
            <FieldText
              id="esm-profile-addr-detail"
              label={t.dialog.addressDetailLabel}
              register={form.register('address.addressDetail')}
              error={errors.address?.addressDetail?.message}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldText
                id="esm-profile-contact-name"
                label={t.dialog.contactNameLabel}
                register={form.register('address.contactName')}
                error={errors.address?.contactName?.message}
              />
              <FieldText
                id="esm-profile-contact-phone"
                label={t.dialog.contactPhoneLabel}
                register={form.register('address.contactPhone')}
                error={errors.address?.contactPhone?.message}
                inputMode="tel"
              />
            </div>
          </fieldset>

          {serverError && (
            <ErrorMessage
              message={serverError.message}
              {...(serverError.correlationId
                ? { details: `요청 ID: ${serverError.correlationId}` }
                : {})}
            />
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            {t.dialog.cancel}
          </Button>
          <Button
            type="submit"
            form="esm-profile-create-form"
            variant="primary"
            disabled={create.isPending}
          >
            {create.isPending ? t.dialog.submitting : t.dialog.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 폼 헬퍼
// ─────────────────────────────────────────────

const selectClass =
  'h-9 rounded-md border border-border bg-surface px-3 text-sm text-text ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

function FieldError({
  id,
  children,
}: {
  id: string
  children: ReactNode
}): JSX.Element {
  return (
    <p id={id} role="alert" className="text-xs text-danger-on-soft">
      {children}
    </p>
  )
}

interface FieldTextProps {
  id: string
  label: string
  placeholder?: string
  inputMode?: 'text' | 'tel' | 'numeric'
  register: ReturnType<ReturnType<typeof useForm>['register']>
  error: string | undefined
}

function FieldText({
  id,
  label,
  placeholder,
  inputMode,
  register,
  error,
}: FieldTextProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        {...(placeholder ? { placeholder } : {})}
        {...(inputMode ? { inputMode } : {})}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
        {...register}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

export default SettingsShippingEsmProfilesPage
