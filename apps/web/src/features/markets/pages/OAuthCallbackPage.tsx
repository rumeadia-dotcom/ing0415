import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, Card, CardContent, ErrorMessage } from '@/components/ui'
import { ko } from '@/locales/ko'
import { useOAuthCallback } from '../hooks/useOAuthCallback'
import { MarketApiInvocationError } from '../api/markets-api'
import { formatMarketError } from '../utils/market-error-messages'
import { MARKET_CATALOG, MARKET_IDS, type MarketId } from '../types'
import { MarketIdentity } from '../components/MarketIdentity'

/**
 * OAuthCallbackPage — n39 OAuth 콜백 결과.
 * 마스터: docs/architecture/v1/features/markets.md §7.4
 * Studio s5 reference: studio-extras.jsx StudioOAuthCallback (큰 ✓ 카드 + 메타 그리드).
 *
 * 1) URL 의 code / state 파싱. 누락 시 즉시 실패 화면 (invalid_code / invalid_state).
 * 2) 마켓 측 error param 처리 (예: access_denied → oauth_denied).
 * 3) markets-oauth-callback invoke → 성공 시 navigate(redirectTo ?? /markets), 실패 시 실패 화면.
 *
 * 라우트: /markets/callback/:provider (v1 활성 = naver 만).
 */
function isOAuthProvider(value: string | undefined): value is 'naver' {
  return value === 'naver'
}

function isMarketId(value: string | undefined): value is MarketId {
  return typeof value === 'string' && (MARKET_IDS as readonly string[]).includes(value)
}

type CallbackState =
  | { kind: 'loading' }
  | { kind: 'failed'; code: string; message: string; correlationId: string | null }

export function OAuthCallbackPage(): JSX.Element {
  const { provider } = useParams<{ provider: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const callback = useOAuthCallback()
  const [state, setState] = useState<CallbackState>({ kind: 'loading' })
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    if (!isOAuthProvider(provider)) {
      setState({
        kind: 'failed',
        code: 'market_not_supported',
        message: formatMarketError({ code: 'market_not_supported', message: '', correlationId: '' }).message,
        correlationId: null,
      })
      return
    }

    const oauthError = searchParams.get('error')
    if (oauthError) {
      const code = oauthError === 'access_denied' ? 'oauth_denied' : 'invalid_code'
      const f = formatMarketError({ code, message: '', correlationId: '' })
      setState({ kind: 'failed', code, message: f.message, correlationId: null })
      return
    }

    const code = searchParams.get('code')
    const stateParam = searchParams.get('state')
    if (!code) {
      const f = formatMarketError({ code: 'invalid_code', message: '', correlationId: '' })
      setState({ kind: 'failed', code: 'invalid_code', message: f.message, correlationId: null })
      return
    }
    if (!stateParam || stateParam.length < 32) {
      const f = formatMarketError({ code: 'invalid_state', message: '', correlationId: '' })
      setState({ kind: 'failed', code: 'invalid_state', message: f.message, correlationId: null })
      return
    }

    callback.mutate(
      { market: provider, code, state: stateParam },
      {
        onSuccess: (data) => {
          toast.success(`${MARKET_CATALOG[provider].label} 연결이 완료되었습니다.`)
          navigate(data.redirectTo || '/markets', { replace: true })
        },
        onError: (err) => {
          if (err instanceof MarketApiInvocationError) {
            const f = formatMarketError(err.toApiError())
            setState({ kind: 'failed', code: err.code, message: f.message, correlationId: f.correlationId })
          } else {
            const f = formatMarketError(null)
            setState({ kind: 'failed', code: 'unknown', message: f.message, correlationId: null })
          }
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const providerLabel = isMarketId(provider) ? MARKET_CATALOG[provider].label : '마켓'
  const t = ko.markets.callback

  if (state.kind === 'loading') {
    return (
      <div className="mx-auto w-full max-w-[520px]">
        <Card>
          <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
            {isMarketId(provider) && <MarketIdentity marketId={provider} size="lg" />}
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-text">{t.loadingTitle}</h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                {t.loadingBody(providerLabel)}
              </p>
            </div>
            <div
              className="flex items-center gap-2 text-sm text-text-tertiary"
              aria-live="polite"
            >
              <span
                aria-hidden
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent"
              />
              {t.loadingProgress}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // failed
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <PageHeader title={t.failedTitle} subtitle={t.failedSubtitle(providerLabel)} />
      <Card>
        <CardContent className="space-y-4 px-6 py-6">
          {isMarketId(provider) && (
            <div className="flex items-center gap-3">
              <MarketIdentity marketId={provider} size="md" />
              <span className="text-sm font-semibold text-text">{providerLabel}</span>
            </div>
          )}
          <ErrorMessage
            message={state.message}
            {...(state.correlationId ? { details: `요청 ID: ${state.correlationId}` } : {})}
          />
          <div className="flex flex-wrap gap-2">
            {isMarketId(provider) && (
              <Button asChild variant="primary">
                <Link to={`/markets/connect/${provider}`}>{t.retry}</Link>
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link to="/markets">{t.backToList}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default OAuthCallbackPage
