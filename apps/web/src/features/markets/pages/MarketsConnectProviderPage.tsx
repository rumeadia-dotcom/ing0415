import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
} from '@/components/ui'
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

/**
 * MarketsConnectProviderPage — n37 4분기 본 동작 (Phase 2).
 * 마스터: docs/architecture/v1/features/markets.md §7.3
 *
 *  - naver   → OAuth 안내 + useOAuthStart → window.location.assign(authorizeUrl)
 *  - coupang → HMAC 폼 + useConnectMarket
 *  - gmarket → ESM JWT 폼 + useConnectMarket
 *  - auction → ESM JWT 폼 + useConnectMarket
 *  - 11st    → disabled 안내
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
              <Link to="/markets/connect">마켓 선택으로</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const entry = MARKET_CATALOG[provider]
  const label = entry.label

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <PageHeader title={`${label} 연결`} subtitle={authSubtitle(entry.authMode)} />
      {entry.authMode === 'oauth' && <OAuthSection label={label} />}
      {entry.authMode === 'hmac' && <HmacSection label={label} />}
      {entry.authMode === 'esm_jwt' && (
        <EsmJwtSection label={label} market={provider === 'gmarket' ? 'gmarket' : 'auction'} />
      )}
      {entry.authMode === 'disabled' && <DisabledSection label={label} />}
    </div>
  )
}

function authSubtitle(mode: (typeof MARKET_CATALOG)[MarketId]['authMode']): string {
  switch (mode) {
    case 'oauth':
      return 'OAuth 2.0 인증으로 마켓 계정을 안전하게 연결합니다.'
    case 'hmac':
      return 'API 키(Access / Secret / Vendor ID) 를 입력해 연결합니다.'
    case 'esm_jwt':
      return 'ESM 인증 키(Master ID / Secret / Seller ID) 를 입력해 연결합니다.'
    case 'disabled':
      return '현재 오픈 준비중인 마켓입니다.'
  }
}

// ─────────────────────────────────────────────
// OAuth 섹션 — 네이버
// ─────────────────────────────────────────────

const OAuthLabelFormSchema = z.object({
  accountLabel: z.string().min(1, '라벨을 입력하세요').max(40, '40자 이내로 입력하세요'),
})
type OAuthLabelForm = z.infer<typeof OAuthLabelFormSchema>

function OAuthSection({ label }: { label: string }): JSX.Element {
  const oauthStart = useOAuthStart()
  const [serverError, setServerError] = useState<{ message: string; correlationId: string | null } | null>(null)

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
          // 외부 OAuth 페이지로 이동
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
    <Card>
      <CardHeader>
        <CardTitle>OAuth 인증</CardTitle>
        <CardDescription>
          버튼을 누르면 {label} 인증 화면으로 이동합니다. 마켓 로그인 정보는 MarketCast 에 전달되지
          않으며, 발급된 토큰은 암호화 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oauth-accountLabel">계정 라벨 (구분용)</Label>
            <Input
              id="oauth-accountLabel"
              type="text"
              autoComplete="off"
              placeholder="예: 메인 스토어"
              aria-invalid={form.formState.errors.accountLabel ? true : undefined}
              {...form.register('accountLabel')}
            />
            <p className="text-xs text-text-tertiary">1~40자. 동일 마켓에서 라벨 중복 불가.</p>
            {form.formState.errors.accountLabel && (
              <p role="alert" className="text-xs text-danger-on-soft">
                {form.formState.errors.accountLabel.message}
              </p>
            )}
          </div>

          {serverError && (
            <ErrorMessage
              message={serverError.message}
              {...(serverError.correlationId ? { details: `요청 ID: ${serverError.correlationId}` } : {})}
            />
          )}

          <div className="mt-2 flex gap-2">
            <Button asChild variant="ghost" type="button">
              <Link to="/markets/connect">취소</Link>
            </Button>
            <Button type="submit" variant="primary" disabled={oauthStart.isPending}>
              {oauthStart.isPending ? '이동 중…' : `${label} 로그인으로 이동 →`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// HMAC 섹션 — 쿠팡
// ─────────────────────────────────────────────

function HmacSection({ label }: { label: string }): JSX.Element {
  const navigate = useNavigate()
  const connect = useConnectMarket()
  const [serverError, setServerError] = useState<{ message: string; correlationId: string | null } | null>(null)

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
    <Card>
      <CardHeader>
        <CardTitle>{label} HMAC 키 입력</CardTitle>
        <CardDescription>
          쿠팡 윙(Wing) → 개발자 메뉴 → API Key 발급 화면에서 받은 3개 값을 입력하세요. 입력값은
          Edge Function 만 접근 가능한 영역에 암호화 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField
            id="hmac-accountLabel"
            label="계정 라벨"
            register={form.register('accountLabel')}
            error={form.formState.errors.accountLabel?.message}
            placeholder="예: 메인 스토어"
          />
          <FormField
            id="hmac-accessKey"
            label="Access Key"
            register={form.register('accessKey')}
            error={form.formState.errors.accessKey?.message}
            placeholder="예: aaaa-bbbb-cccc-dddd"
          />
          <FormField
            id="hmac-secretKey"
            label="Secret Key"
            type="password"
            register={form.register('secretKey')}
            error={form.formState.errors.secretKey?.message}
            placeholder="40자 이상의 영문 + 숫자"
          />
          <FormField
            id="hmac-vendorId"
            label="Vendor ID"
            register={form.register('vendorId')}
            error={form.formState.errors.vendorId?.message}
            placeholder="예: A00012345"
          />

          {serverError && (
            <ErrorMessage
              message={serverError.message}
              {...(serverError.correlationId ? { details: `요청 ID: ${serverError.correlationId}` } : {})}
            />
          )}

          <div className="mt-2 flex gap-2">
            <Button asChild variant="ghost" type="button">
              <Link to="/markets/connect">취소</Link>
            </Button>
            <Button type="submit" variant="primary" disabled={connect.isPending}>
              {connect.isPending ? '연결 중…' : '연결'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// ESM JWT 섹션 — G마켓 / 옥션
// ─────────────────────────────────────────────

function EsmJwtSection({ label, market }: { label: string; market: 'gmarket' | 'auction' }): JSX.Element {
  const navigate = useNavigate()
  const connect = useConnectMarket()
  const [serverError, setServerError] = useState<{ message: string; correlationId: string | null } | null>(null)

  const form = useForm<EsmJwtConnectForm>({
    resolver: zodResolver(EsmJwtConnectFormSchema) as Resolver<EsmJwtConnectForm>,
    defaultValues: {
      market,
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

  const site: 'G' | 'A' = market === 'gmarket' ? 'G' : 'A'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label} ESM 키 입력</CardTitle>
        <CardDescription>
          ESM Plus → 판매자 도구 → API 관리에서 받은 3개 값을 입력하세요. site 코드는 자동으로{' '}
          <code>{site}</code> 로 설정됩니다 ({label} 전용). 입력값은 암호화 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField
            id="esm-accountLabel"
            label="계정 라벨"
            register={form.register('accountLabel')}
            error={form.formState.errors.accountLabel?.message}
            placeholder="예: 메인 스토어"
          />
          <FormField
            id="esm-masterId"
            label="Master ID"
            register={form.register('masterId')}
            error={form.formState.errors.masterId?.message}
            placeholder="ESM 통합 마스터 ID"
          />
          <FormField
            id="esm-secretKey"
            label="Secret Key"
            type="password"
            register={form.register('secretKey')}
            error={form.formState.errors.secretKey?.message}
            placeholder="ESM 발급 시크릿"
          />
          <FormField
            id="esm-sellerId"
            label="Seller ID"
            register={form.register('sellerId')}
            error={form.formState.errors.sellerId?.message}
            placeholder={`${label} 셀러 ID`}
          />

          {serverError && (
            <ErrorMessage
              message={serverError.message}
              {...(serverError.correlationId ? { details: `요청 ID: ${serverError.correlationId}` } : {})}
            />
          )}

          <div className="mt-2 flex gap-2">
            <Button asChild variant="ghost" type="button">
              <Link to="/markets/connect">취소</Link>
            </Button>
            <Button type="submit" variant="primary" disabled={connect.isPending}>
              {connect.isPending ? '연결 중…' : '연결'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Disabled — 11번가
// ─────────────────────────────────────────────

function DisabledSection({ label }: { label: string }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label} — 오픈 준비중</CardTitle>
        <CardDescription>
          {label} 연동은 v2 에 제공될 예정입니다. 현재는 활성 4개 마켓 (네이버 · 쿠팡 · G마켓 ·
          옥션) 만 연결 가능합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="ghost">
          <Link to="/markets/connect">마켓 선택으로</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// FormField — register / error 매핑 묶음
// ─────────────────────────────────────────────

interface FormFieldProps {
  id: string
  label: string
  type?: string
  placeholder?: string
  register: ReturnType<ReturnType<typeof useForm>['register']>
  error: string | undefined
}

function FormField({ id, label, type = 'text', placeholder, register, error }: FormFieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete="off"
        {...(placeholder ? { placeholder } : {})}
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

export default MarketsConnectProviderPage
