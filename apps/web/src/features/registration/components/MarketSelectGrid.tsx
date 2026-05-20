import { Card, CardContent, CardHeader, CardTitle, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import type { MarketAccount } from '@/lib/schemas/markets-feature'
import type { MarketSelection } from '@/lib/schemas/registration'

interface MarketSelectGridProps {
  accounts: MarketAccount[]
  selections: MarketSelection[]
  onChange: (next: MarketSelection[]) => void
}

const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

/**
 * Step 3 — 4마켓 (네이버·쿠팡·G마켓·옥션) 체크박스 그리드. 11번가 disabled.
 * 마스터: docs/architecture/v1/features/registration.md §10.5
 *
 * 연결되지 않은 (account 없음) 마켓은 disabled + tooltip 안내.
 */
export function MarketSelectGrid({ accounts, selections, onChange }: MarketSelectGridProps): JSX.Element {
  const accountByMarket = new Map<string, MarketAccount>(accounts.filter((a) => a.status === 'active').map((a) => [a.marketId, a]))

  const isSelected = (marketId: MarketId) => selections.some((s) => s.marketId === marketId)

  const toggle = (marketId: MarketId): void => {
    if (marketId === '11st') return
    const account = accountByMarket.get(marketId)
    if (!account) return
    if (isSelected(marketId)) {
      onChange(selections.filter((s) => s.marketId !== marketId))
    } else {
      onChange([...selections, { marketId, marketAccountId: account.id }])
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>마켓 선택</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(MARKET_CATALOG) as MarketId[]).map((id) => {
            const entry = MARKET_CATALOG[id]
            const account = accountByMarket.get(id)
            const isDisabled = entry.status === 'coming_soon' || !account
            const checked = isSelected(id)
            const disabledReason = entry.status === 'coming_soon' ? '오픈 준비중 (v2)' : '계정 연결 필요 — 마켓 화면에서 먼저 연결하세요'

            const item = (
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${
                  checked ? 'border-accent bg-accent-soft' : 'border-border bg-surface'
                } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isDisabled}
                  onChange={() => toggle(id)}
                  aria-label={`${entry.label} 선택`}
                />
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: BRAND_COLOR[id] }}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-text">{entry.label}</span>
                  {isDisabled && <span className="text-xs text-text-tertiary">{disabledReason}</span>}
                </div>
              </label>
            )

            return isDisabled ? (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <span>{item}</span>
                </TooltipTrigger>
                <TooltipContent>{disabledReason}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={id}>{item}</div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
