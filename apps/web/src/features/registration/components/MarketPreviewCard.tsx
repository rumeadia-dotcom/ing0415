import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import { formatValidationIssue } from '../utils/registration-error-messages'

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
}

/**
 * Step 4 마켓별 페이로드 미리보기 카드.
 * 마스터: docs/architecture/v1/features/registration.md §10.6
 *
 * - error: registration-validate 가 issue 로 보고 (등록 막음)
 * - warning: payload 는 있으나 hint 표시 (등록 가능)
 * - ok: payload 정상 + 수수료 표시
 */
export function MarketPreviewCard({ marketId, estimatedFee, issues, hasPayload }: MarketPreviewCardProps): JSX.Element {
  const label = MARKET_CATALOG[marketId].label
  const status = !hasPayload ? 'error' : issues.length > 0 ? 'warning' : 'ok'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BRAND_COLOR[marketId] }} />
            {label}
          </span>
          {status === 'error' && <Badge variant="danger">등록 불가</Badge>}
          {status === 'warning' && <Badge variant="warning">경고</Badge>}
          {status === 'ok' && <Badge variant="success">준비됨</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {hasPayload && estimatedFee !== null && (
          <p className="text-text-secondary">예상 등록 수수료: {estimatedFee.toLocaleString()}원</p>
        )}
        {issues.length > 0 && (
          <ul className="space-y-1.5">
            {issues.map((issue, idx) => (
              <li key={`${issue.code}-${idx}`} className={`rounded-md border px-2.5 py-1.5 ${hasPayload ? 'border-warning/30 bg-warning-soft text-warning-on-soft' : 'border-danger/30 bg-danger-soft text-danger-on-soft'}`}>
                <div className="font-medium">{formatValidationIssue(issue.code)}</div>
                {issue.hint && <div className="text-xs opacity-80">{issue.hint}</div>}
              </li>
            ))}
          </ul>
        )}
        {status === 'ok' && <p className="text-text-secondary">모든 필드 통과. 등록 가능합니다.</p>}
      </CardContent>
    </Card>
  )
}
