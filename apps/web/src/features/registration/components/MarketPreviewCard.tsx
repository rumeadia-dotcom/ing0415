import { Check, AlertCircle, AlertTriangle } from 'lucide-react'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import { formatValidationIssue } from '../utils/registration-error-messages'
import { cn } from '@/lib/utils'

const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

interface PreviewIssue {
  code: string
  field: string
  message: string
  hint?: string | undefined
}

interface MarketPreviewCardProps {
  marketId: MarketId
  estimatedFee: number | null
  issues: PreviewIssue[]
  hasPayload: boolean
  /** 표시 가격 (Step 1 의 판매가). null 이면 미표시. */
  displayPrice?: number | null
  /** 카테고리 경로 (`A › B › C`). 없으면 미표시. */
  categoryPath?: string | null
}

/**
 * Step 4 마켓별 페이로드 미리보기 카드 (Studio 룩).
 * 마스터: docs/architecture/v1/features/registration.md §10.6
 *
 * - error: registration-validate 가 issue 로 보고 (등록 막음)
 * - warning: payload 는 있으나 hint 표시 (등록 가능)
 * - ok: payload 정상 + 표시가격 + 예상 수수료 + 예상 정산
 */
export function MarketPreviewCard({
  marketId,
  estimatedFee,
  issues,
  hasPayload,
  displayPrice,
  categoryPath,
}: MarketPreviewCardProps): JSX.Element {
  const label = MARKET_CATALOG[marketId].label
  const status: 'ok' | 'warning' | 'error' = !hasPayload
    ? 'error'
    : issues.length > 0
      ? 'warning'
      : 'ok'

  const netRevenue =
    displayPrice != null && estimatedFee != null ? displayPrice - estimatedFee : null

  return (
    <article
      className={cn(
        'rounded-xl border bg-surface p-5 shadow-sm',
        status === 'error'
          ? 'border-danger/35'
          : status === 'warning'
            ? 'border-warning/35'
            : 'border-border',
      )}
    >
      <header className="mb-3 flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: BRAND_COLOR[marketId] }}
        >
          {label.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-text">{label}</p>
          {categoryPath && (
            <p className="mt-0.5 truncate text-[11.5px] text-text-tertiary">{categoryPath}</p>
          )}
        </div>
        <StatusPill status={status} />
      </header>

      <dl className="flex flex-wrap gap-6 border-t border-border pt-3">
        {displayPrice != null && (
          <Stat label="표시가격" value={`₩${displayPrice.toLocaleString()}`} />
        )}
        {estimatedFee != null && (
          <Stat label="예상 수수료" value={`₩${estimatedFee.toLocaleString()}`} />
        )}
        {netRevenue != null && (
          <Stat
            label="예상 정산"
            value={`₩${netRevenue.toLocaleString()}`}
            tone="success"
          />
        )}
        {displayPrice == null && estimatedFee == null && (
          <p className="text-[12px] text-text-tertiary">상품 정보를 불러오는 중…</p>
        )}
      </dl>

      {issues.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {issues.map((issue, idx) => (
            <li
              key={`${issue.code}-${idx}`}
              className={cn(
                'flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px]',
                hasPayload
                  ? 'border-warning/30 bg-warning-soft text-warning-on-soft'
                  : 'border-danger/30 bg-danger-soft text-danger-on-soft',
              )}
            >
              <span className="mt-0.5 shrink-0">
                {hasPayload ? (
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text">{formatValidationIssue(issue.code)}</p>
                {issue.hint && <p className="mt-0.5 text-[11.5px] opacity-80">{issue.hint}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {status === 'ok' && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2.5 py-1.5 text-[12px] font-semibold text-success-on-soft">
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          검증 통과 · 등록 준비 완료
        </p>
      )}
    </article>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'success'
}): JSX.Element {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-text-tertiary">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 font-mono text-[14px] font-semibold',
          tone === 'success' ? 'text-success-on-soft' : 'text-text',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function StatusPill({ status }: { status: 'ok' | 'warning' | 'error' }): JSX.Element {
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-1 text-[11.5px] font-semibold text-danger-on-soft">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
        등록 불가
      </span>
    )
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-[11.5px] font-semibold text-warning-on-soft">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
        확인 필요
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11.5px] font-semibold text-success-on-soft">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
      준비됨
    </span>
  )
}
