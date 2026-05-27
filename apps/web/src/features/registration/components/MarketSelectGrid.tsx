import { Check } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import type { MarketAccount } from '@/lib/schemas/markets-feature'
import type { MarketSelection } from '@/lib/schemas/registration'
import { cn } from '@/lib/utils'

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
 * Step 3 — 5 마켓 카드 그리드 (naver / coupang / gmarket / auction / 11st 전부 v1 활성). Studio 룩.
 * 마스터: docs/architecture/v1/features/registration.md §10.5
 *
 * - 연결되지 않은 (account 없음) 마켓 = disabled + tooltip 안내.
 * - 5마켓 모두 status='ready' — 계정만 연결되면 선택 가능.
 * - 선택된 카드는 ink ring + accent-soft 배경.
 */
export function MarketSelectGrid({ accounts, selections, onChange }: MarketSelectGridProps): JSX.Element {
  const accountByMarket = new Map<string, MarketAccount>(
    accounts.filter((a) => a.status === 'active').map((a) => [a.marketId, a]),
  )

  const isSelected = (marketId: MarketId) => selections.some((s) => s.marketId === marketId)

  const toggle = (marketId: MarketId): void => {
    const account = accountByMarket.get(marketId)
    if (!account) return
    if (isSelected(marketId)) {
      onChange(selections.filter((s) => s.marketId !== marketId))
    } else {
      onChange([...selections, { marketId, marketAccountId: account.id }])
    }
  }

  const selectedCount = selections.length

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-text">등록할 마켓 선택</h2>
          <p className="mt-1 text-[12.5px] text-text-tertiary">
            {selectedCount}개 마켓 선택됨 · 비활성 마켓은 사유 표시
          </p>
        </div>
      </header>
      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(MARKET_CATALOG) as MarketId[]).map((id) => {
          const entry = MARKET_CATALOG[id]
          const account = accountByMarket.get(id)
          const isComingSoon = (entry.status as string) !== 'ready'
          const isDisabled = isComingSoon || !account
          const checked = isSelected(id)
          const disabledReason = isComingSoon
            ? '오픈 준비중'
            : '계정 연결 필요 — 마켓 화면에서 먼저 연결하세요'

          const card = (
            <label
              className={cn(
                'flex h-full cursor-pointer flex-col rounded-xl border p-3.5 transition-colors',
                checked
                  ? 'border-[1.5px] border-ink bg-accent-soft/40'
                  : 'border-border bg-surface hover:bg-surface-subtle',
                isDisabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: BRAND_COLOR[id] }}
                />
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
                  {id === '11st' ? '11ST' : id.toUpperCase()}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'ml-auto flex h-[18px] w-[18px] items-center justify-center rounded-sm border-[1.5px]',
                    checked ? 'border-ink bg-ink text-white' : 'border-border-strong bg-surface',
                  )}
                >
                  {checked && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={isDisabled}
                  onChange={() => toggle(id)}
                  aria-label={`${entry.label} 선택`}
                />
              </div>
              <span className="text-[13px] font-bold text-text">{entry.label}</span>
              <span
                className={cn(
                  'mt-0.5 text-[10.5px]',
                  isComingSoon
                    ? 'font-semibold text-warning-on-soft'
                    : !account
                      ? 'text-text-tertiary'
                      : 'text-text-tertiary',
                )}
              >
                {isComingSoon ? '준비 중 · v2' : !account ? '연결 필요' : '연결됨'}
              </span>
            </label>
          )

          return isDisabled ? (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <span>{card}</span>
              </TooltipTrigger>
              <TooltipContent>{disabledReason}</TooltipContent>
            </Tooltip>
          ) : (
            <div key={id}>{card}</div>
          )
        })}
      </div>
    </section>
  )
}
