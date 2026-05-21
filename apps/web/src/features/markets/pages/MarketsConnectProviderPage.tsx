import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  ErrorMessage,
  Input,
  Label,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'
import { useOAuthStart } from '../hooks/useOAuthStart'
import { useConnectMarket } from '../hooks/useConnectMarket'
import { MarketApiInvocationError } from '../api/markets-api'
import { formatMarketError } from '../utils/market-error-messages'
import { MARKET_CATALOG, MARKET_IDS, type MarketId } from '../types'
import {
  HmacConnectFormSchema,
  EsmJwtConnectFormSchema,
  type HmacConnectForm,
  type EsmJwtConnectForm,
} from '@/lib/schemas/markets-feature'
import { ProviderConnectShell } from '../components/ProviderConnectShell'
import { ProviderGuideCard, ProviderSecurityNote } from '../components/ProviderGuideCard'
import { MarketIdentity } from '../components/MarketIdentity'

/**
 * MarketsConnectProviderPage — n37 4분기 본 동작 (Phase 2 — Studio 룩).
 * 마스터: docs/architecture/v1/features/markets.md §7.3
 * Studio s5 reference: studio-extras.jsx StudioMarketConnect (좌 form / 우 가이드 aside).
 *
 *  - naver   → OAuth 안내 + useOAuthStart → window.location.assign(authorizeUrl)
 *  - coupang → HMAC 폼 (Vendor / Access / Secret + Reveal toggle) + 발급가이드 aside
 *  - gmarket → ESM JWT 폼 (Master / Secret / Seller) + ESM 가이드 aside (site=G)
 *  - auction → ESM JWT 폼 (Master / Secret / Seller) + ESM 가이드 aside (site=A)
 *  - 11st    → disabled 안내 (가이드 aside 없음)
 */
function isMarketId(value: string | undefined): value is MarketId {
  return typeof value === 'string' && (MARKET_IDS as readonly string[]).includes(value)
}

export function MarketsConnectProviderPage(): JSX.Element {
  const { provider } = useParams<{ provider: string }>()
  if (!isMarketId(provider)) {
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <PageHeader title="알 수 없는 마켓" subtitle="유효하지 않은 provider 입니다." />
        <Card>
          <CardContent>
            <Button asChild variant="ghost">
              <Link to="/markets/connect">{ko.markets.connect.backToSelect}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const entry = MARKET_CATALOG[provider]

  if (entry.authMode === 'disabled') {
    return <DisabledScreen marketId={provider} />
  }

  if (entry.authMode === 'oauth') {
    return (
      <ProviderConnectShell
        marketId={provider}
        authMode="oauth"
        form={<OAuthForm marketId={provider} />}
      />
    )
  }

  if (entry.authMode === 'hmac') {
    return (
      <ProviderConnectShell
        marketId={provider}
        authMode="hmac"
        form={<HmacForm marketId={provider} />}
        aside={
          <>
            <ProviderGuideCard
              title={ko.markets.form.hmac.guideTitle}
              steps={ko.markets.form.hmac.guideSteps}
            />
            <ProviderSecurityNote />
          </>
        }
      />
    )
  }

  // esm_jwt
  return (
    <ProviderConnectShell
      marketId={provider}
      authMode="esm_jwt"
      form={<EsmJwtForm marketId={provider} site={provider === 'gmarket' ? 'G' : 'A'} />}
      aside={
        <>
          <ProviderGuideCard
            title={ko.markets.form.esm.guideTitle}
            steps={ko.markets.form.esm.guideSteps}
          />
          <ProviderSecurityNote />
        </>
      }
    />
  )
}

// ─────────────────────────────────────────────
// OAuth (네이버)
// ─────────────────────────────────────────────

const OAuthLabelFormSchema = z.object({
  accountLabel: z.string().min(1, '라벨을 입력하세요').max(40, '40자 이내로 입력하세요'),
})
type OAuthLabelForm = z.infer<typeof OAuthLabelFormSchema>

function OAuthForm({ marketId }: { marketId: MarketId }): JSX.Element {
  const oauthStart = useOAuthStart()
  const [serverError, setServerError] = useState<{
    message: string
    correlationId: string | null
  } | null>(null)
  const label = MARKET_CATALOG[marketId].label
  const t = ko.markets.form

  const form = useForm<OAuthLabelForm>({
    resolver: zodResolver(OAuthLabelFormSchema) as Resolver<OAuthLabelForm>,
    defaultValues: { accountLabel: '' },
  })

  const onSubmit = (values: OAuthLabelForm): void => {
    setServerError(null)
    oauthStart.mutate(
      {
        market: 'naver',
        accountLabel: values.accountLabel,
        redirectTo: '/markets',
      },
      {
        onSuccess: (data) => {
          window.location.assign(data.authorizeUrl)
        },
        onError: (err) => {
          if (err instanceof MarketApiInvocationError) {
            const f = formatMarketError(err.toApiError())
            setServerError({ message: f.message, correlationId: f.correlationId })
          } else {
            setServerError({ message: formatMarketError(null).message, correlationId: null })
          }
        },
      },
    )
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <FieldShell
        id="oauth-accountLabel"
        label={t.labelOptional}
        hint={t.labelHint}
        error={form.formState.errors.accountLabel?.message}
      >
        <Input
          id="oauth-accountLabel"
          type="text"
          autoComplete="off"
          placeholder={t.labelPlaceholder}
          aria-invalid={form.formState.errors.accountLabel ? true : undefined}
          {...form.register('accountLabel')}
        />
      </FieldShell>

      <p className="rounded-lg border border-border bg-surface-subtle px-4 py-3 text-[12.5px] leading-relaxed text-text-secondary">
        버튼을 누르면 {label} 인증 화면으로 이동합니다. 마켓 로그인 정보는 MarketCast 에 전달되지
        않으며, 발급된 토큰은 암호화 저장됩니다.
      </p>

      {serverError && (
        <ErrorMessage
          message={serverError.message}
          {...(serverError.correlationId
            ? { details: `요청 ID: ${serverError.correlationId}` }
            : {})}
        />
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button asChild variant="ghost" type="button">
          <Link to="/markets/connect">{ko.markets.connect.cancel}</Link>
        </Button>
        <Button type="submit" variant="primary" disabled={oauthStart.isPending}>
          {oauthStart.isPending ? t.submit.oauthPending : t.submit.oauth(label)}
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// HMAC (쿠팡)
// ─────────────────────────────────────────────

function HmacForm({ marketId }: { marketId: MarketId }): JSX.Element {
  const navigate = useNavigate()
  const connect = useConnectMarket()
  const [serverError, setServerError] = useState<{
    message: string
    correlationId: string | null
  } | null>(null)
  const label = MARKET_CATALOG[marketId].label
  const t = ko.markets.form

  const form = useForm<HmacConnectForm>({
    resolver: zodResolver(HmacConnectFormSchema) as Resolver<HmacConnectForm>,
    defaultValues: {
      market: 'coupang',
      accountLabel: '',
      accessKey: '',
      secretKey: '',
      vendorId: '',
    },
  })

  const onSubmit = (values: HmacConnectForm): void => {
    setServerError(null)
    connect.mutate(values, {
      onSuccess: () => {
        toast.success(`${label} 연결이 완료되었습니다.`)
        navigate('/markets')
      },
      onError: (err) => {
        if (err instanceof MarketApiInvocationError) {
          const f = formatMarketError(err.toApiError())
          setServerError({ message: f.message, correlationId: f.correlationId })
        } else {
          setServerError({ message: formatMarketError(null).message, correlationId: null })
        }
      },
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldShell
        id="hmac-accountLabel"
        label={t.labelOptional}
        hint={t.labelHint}
        error={form.formState.errors.accountLabel?.message}
      >
        <Input
          id="hmac-accountLabel"
          type="text"
          autoComplete="off"
          placeholder={t.labelPlaceholder}
          aria-invalid={form.formState.errors.accountLabel ? true : undefined}
          {...form.register('accountLabel')}
        />
      </FieldShell>

      <FieldShell
        id="hmac-vendorId"
        label={`Vendor ID — ${t.hmac.vendorId}`}
        hint={t.hmac.vendorIdHint}
        required
        error={form.formState.errors.vendorId?.message}
      >
        <Input
          id="hmac-vendorId"
          type="text"
          autoComplete="off"
          placeholder={t.hmac.vendorIdPlaceholder}
          aria-invalid={form.formState.errors.vendorId ? true : undefined}
          className="font-mono tracking-wide"
          {...form.register('vendorId')}
        />
      </FieldShell>

      <FieldShell
        id="hmac-accessKey"
        label={`Access Key — ${t.hmac.accessKey}`}
        required
        error={form.formState.errors.accessKey?.message}
      >
        <Input
          id="hmac-accessKey"
          type="text"
          autoComplete="off"
          placeholder={t.hmac.accessKeyPlaceholder}
          aria-invalid={form.formState.errors.accessKey ? true : undefined}
          className="font-mono tracking-wide"
          {...form.register('accessKey')}
        />
      </FieldShell>

      <SecretField
        id="hmac-secretKey"
        label={`Secret Key — ${t.hmac.secretKey}`}
        placeholder={t.hmac.secretKeyPlaceholder}
        register={form.register('secretKey')}
        error={form.formState.errors.secretKey?.message}
      />

      <SecurityHintLine />

      {serverError && (
        <ErrorMessage
          message={serverError.message}
          {...(serverError.correlationId
            ? { details: `요청 ID: ${serverError.correlationId}` }
            : {})}
        />
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button asChild variant="ghost" type="button">
          <Link to="/markets/connect">{ko.markets.connect.cancel}</Link>
        </Button>
        <Button type="submit" variant="primary" disabled={connect.isPending}>
          {connect.isPending ? t.submit.savePending : t.submit.save}
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// ESM JWT (G마켓 / 옥션)
// ─────────────────────────────────────────────

function EsmJwtForm({
  marketId,
  site,
}: {
  marketId: MarketId
  site: 'G' | 'A'
}): JSX.Element {
  const navigate = useNavigate()
  const connect = useConnectMarket()
  const [serverError, setServerError] = useState<{
    message: string
    correlationId: string | null
  } | null>(null)
  const label = MARKET_CATALOG[marketId].label
  const t = ko.markets.form

  const form = useForm<EsmJwtConnectForm>({
    resolver: zodResolver(EsmJwtConnectFormSchema) as Resolver<EsmJwtConnectForm>,
    defaultValues: {
      market: marketId === 'gmarket' ? 'gmarket' : 'auction',
      accountLabel: '',
      masterId: '',
      secretKey: '',
      sellerId: '',
    },
  })

  const onSubmit = (values: EsmJwtConnectForm): void => {
    setServerError(null)
    connect.mutate(values, {
      onSuccess: () => {
        toast.success(`${label} 연결이 완료되었습니다.`)
        navigate('/markets')
      },
      onError: (err) => {
        if (err instanceof MarketApiInvocationError) {
          const f = formatMarketError(err.toApiError())
          setServerError({ message: f.message, correlationId: f.correlationId })
        } else {
          setServerError({ message: formatMarketError(null).message, correlationId: null })
        }
      },
    })
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldShell
        id="esm-accountLabel"
        label={t.labelOptional}
        hint={t.labelHint}
        error={form.formState.errors.accountLabel?.message}
      >
        <Input
          id="esm-accountLabel"
          type="text"
          autoComplete="off"
          placeholder={t.labelPlaceholder}
          aria-invalid={form.formState.errors.accountLabel ? true : undefined}
          {...form.register('accountLabel')}
        />
      </FieldShell>

      <FieldShell
        id="esm-masterId"
        label={t.esm.masterId}
        required
        error={form.formState.errors.masterId?.message}
      >
        <Input
          id="esm-masterId"
          type="text"
          autoComplete="off"
          placeholder={t.esm.masterIdPlaceholder}
          aria-invalid={form.formState.errors.masterId ? true : undefined}
          className="font-mono tracking-wide"
          {...form.register('masterId')}
        />
      </FieldShell>

      <SecretField
        id="esm-secretKey"
        label={t.esm.secretKey}
        placeholder={t.esm.secretKeyPlaceholder}
        register={form.register('secretKey')}
        error={form.formState.errors.secretKey?.message}
      />

      <FieldShell
        id="esm-sellerId"
        label={t.esm.sellerId}
        required
        error={form.formState.errors.sellerId?.message}
      >
        <Input
          id="esm-sellerId"
          type="text"
          autoComplete="off"
          placeholder={t.esm.sellerIdPlaceholder(label)}
          aria-invalid={form.formState.errors.sellerId ? true : undefined}
          className="font-mono tracking-wide"
          {...form.register('sellerId')}
        />
      </FieldShell>

      <p className="rounded-lg border border-border bg-surface-subtle px-4 py-2.5 text-[12px] text-text-secondary">
        {t.esm.siteNote(site, label)}
      </p>

      <SecurityHintLine />

      {serverError && (
        <ErrorMessage
          message={serverError.message}
          {...(serverError.correlationId
            ? { details: `요청 ID: ${serverError.correlationId}` }
            : {})}
        />
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button asChild variant="ghost" type="button">
          <Link to="/markets/connect">{ko.markets.connect.cancel}</Link>
        </Button>
        <Button type="submit" variant="primary" disabled={connect.isPending}>
          {connect.isPending ? t.submit.savePending : t.submit.save}
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// Disabled (11번가)
// ─────────────────────────────────────────────

function DisabledScreen({ marketId }: { marketId: MarketId }): JSX.Element {
  const label = MARKET_CATALOG[marketId].label
  const t = ko.markets.form

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <Card>
        <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
          <MarketIdentity marketId={marketId} size="lg" className="h-14 w-14 text-lg opacity-60" />
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-text">{t.disabled.title(label)}</h2>
            <p className="text-sm leading-relaxed text-text-secondary">{t.disabled.body}</p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/markets/connect">{ko.markets.connect.backToSelect}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
// 공통 폼 헬퍼
// ─────────────────────────────────────────────

interface FieldShellProps {
  id: string
  label: string
  hint?: string
  required?: boolean
  error?: string | undefined
  children: React.ReactNode
}

function FieldShell({ id, label, hint, required, error, children }: FieldShellProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[12.5px] font-semibold text-text-secondary">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[11.5px] text-text-tertiary">{hint}</p>}
      {error && (
        <p role="alert" className="text-[11.5px] font-medium text-danger-on-soft">
          {error}
        </p>
      )}
    </div>
  )
}

interface SecretFieldProps {
  id: string
  label: string
  placeholder?: string
  register: ReturnType<ReturnType<typeof useForm>['register']>
  error?: string | undefined
}

function SecretField({ id, label, placeholder, register, error }: SecretFieldProps): JSX.Element {
  const [reveal, setReveal] = useState(false)
  const t = ko.markets.form
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[12.5px] font-semibold text-text-secondary">
        {label}
        <span className="ml-1 text-danger">*</span>
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={reveal ? 'text' : 'password'}
          autoComplete="off"
          {...(placeholder ? { placeholder } : {})}
          aria-invalid={error ? true : undefined}
          className={cn('font-mono pr-16 tracking-wide')}
          {...register}
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="absolute right-2 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1 rounded-md px-2 text-[11.5px] font-semibold text-text-tertiary hover:bg-surface-subtle hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={reveal ? t.reveal.hide : t.reveal.show}
          aria-pressed={reveal}
        >
          {reveal ? <EyeOff aria-hidden className="h-3.5 w-3.5" /> : <Eye aria-hidden className="h-3.5 w-3.5" />}
          <span>{reveal ? t.reveal.hide : t.reveal.show}</span>
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-[11.5px] font-medium text-danger-on-soft">
          {error}
        </p>
      ) : (
        <p className="text-[11.5px] text-text-tertiary">{t.securityNote}</p>
      )}
    </div>
  )
}

function SecurityHintLine(): JSX.Element {
  return (
    <p className="text-[11.5px] leading-relaxed text-text-tertiary">
      {ko.markets.form.securityNote}
    </p>
  )
}

export default MarketsConnectProviderPage
