import { useState, useEffect } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { MARKET_IDS, type MarketId } from '@/lib/schemas/common'
import { JOB_STATUSES, type JobStatus } from '@/lib/schemas/registration'
import {
  HistoryFilterSchema,
  type HistoryFilter,
  type PeriodPreset,
} from '@/lib/schemas/history-filter'

const MARKET_LABEL: Record<MarketId, string> = {
  naver: '네이버',
  coupang: '쿠팡',
  '11st': '11번가',
  gmarket: 'G마켓',
  auction: '옥션',
}

// markets.md §7.2 브랜드 컬러 (라이트/다크 공통)
const MARKET_BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  '11st': '#FF0038',
  gmarket: '#00B147',
  auction: '#E73936',
}

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: '대기',
  running: '진행 중',
  partial: '일부 성공',
  succeeded: '성공',
  failed: '실패',
  retrying: '재시도',
  cancelled: '취소',
}

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'custom', label: '직접 선택' },
]

interface HistoryFilterSidebarProps {
  filter: HistoryFilter
  onChange: (next: HistoryFilter) => void
  onReset: () => void
}

/**
 * 좌측 필터 사이드바.
 * URL ↔ filter 동기화는 useHistoryFilterState 가 담당.
 * 본 컴포넌트는 로컬 draft state 만 유지 — "필터 적용" 클릭 시 onChange 호출 (즉시 반영하지 않음 → URL 갱신/네트워크 폭주 방지).
 */
export function HistoryFilterSidebar({
  filter,
  onChange,
  onReset,
}: HistoryFilterSidebarProps): JSX.Element {
  const [draft, setDraft] = useState<HistoryFilter>(filter)

  useEffect(() => {
    setDraft(filter)
  }, [filter])

  function toggleMarket(id: MarketId): void {
    const cur = new Set(draft.markets ?? [])
    if (cur.has(id)) cur.delete(id)
    else cur.add(id)
    const next = Array.from(cur) as MarketId[]
    setDraft((d) => ({ ...d, markets: next.length > 0 ? next : undefined }))
  }

  function toggleStatus(s: JobStatus): void {
    const cur = new Set(draft.statuses ?? [])
    if (cur.has(s)) cur.delete(s)
    else cur.add(s)
    const next = Array.from(cur) as JobStatus[]
    setDraft((d) => ({ ...d, statuses: next.length > 0 ? next : undefined }))
  }

  function apply(): void {
    // cursor 류는 필터 변경 시 항상 리셋 (페이지네이션 처음부터)
    const parsed = HistoryFilterSchema.safeParse({
      ...draft,
      cursor: undefined,
      cursorId: undefined,
    })
    if (parsed.success) {
      onChange(parsed.data)
    }
  }

  const isCustom = draft.period === 'custom'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">필터</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Fieldset legend="기간">
          <div className="grid grid-cols-2 gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center justify-center rounded-md border p-2 text-sm ${
                  draft.period === opt.value
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-surface text-text-secondary hover:bg-surface-muted'
                }`}
              >
                <input
                  type="radio"
                  name="period"
                  value={opt.value}
                  checked={draft.period === opt.value}
                  onChange={() =>
                    setDraft((d) => ({ ...d, period: opt.value }))
                  }
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
          {isCustom ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Input
                type="date"
                aria-label="시작일"
                value={draft.from ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, from: e.target.value || undefined }))
                }
              />
              <Input
                type="date"
                aria-label="종료일"
                value={draft.to ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, to: e.target.value || undefined }))
                }
              />
            </div>
          ) : null}
        </Fieldset>

        <Fieldset legend="마켓">
          <div className="space-y-1.5">
            {MARKET_IDS.map((id) => (
              <label key={id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(draft.markets ?? []).includes(id)}
                  onChange={() => toggleMarket(id)}
                  aria-label={`${MARKET_LABEL[id]} 필터`}
                />
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: MARKET_BRAND_COLOR[id] }}
                />
                <span className="text-text">{MARKET_LABEL[id]}</span>
              </label>
            ))}
          </div>
        </Fieldset>

        <Fieldset legend="상태">
          <div className="space-y-1.5">
            {JOB_STATUSES.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(draft.statuses ?? []).includes(s)}
                  onChange={() => toggleStatus(s)}
                  aria-label={`${STATUS_LABEL[s]} 필터`}
                />
                <span className="text-text">{STATUS_LABEL[s]}</span>
              </label>
            ))}
          </div>
        </Fieldset>

        <Fieldset legend="검색">
          <Input
            type="search"
            aria-label="상품명 검색"
            placeholder="상품명"
            value={draft.q ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, q: e.target.value || undefined }))
            }
            maxLength={100}
          />
        </Fieldset>

        <div className="flex gap-2 pt-2">
          <Button onClick={apply} className="flex-1">
            적용
          </Button>
          <Button variant="ghost" onClick={onReset}>
            초기화
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Fieldset({
  legend,
  children,
}: {
  legend: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {legend}
      </legend>
      {children}
    </fieldset>
  )
}
