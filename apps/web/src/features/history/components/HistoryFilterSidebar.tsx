import { useState, useEffect } from 'react'
import { Button, Input } from '@/components/ui'
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

// 마켓 brand color → Tailwind 토큰 클래스 (globals.css --market-*)
const MARKET_DOT_CLASS: Record<MarketId, string> = {
  naver: 'bg-market-naver',
  coupang: 'bg-market-coupang',
  '11st': 'bg-market-eleventh',
  gmarket: 'bg-market-gmarket',
  auction: 'bg-market-auction',
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
  { value: '7d', label: '지난 7일' },
  { value: '30d', label: '지난 30일' },
  { value: 'custom', label: '직접 선택' },
]

interface HistoryFilterSidebarProps {
  filter: HistoryFilter
  onChange: (next: HistoryFilter) => void
  onReset: () => void
}

/**
 * 좌측 필터 사이드바 — Studio 스타일.
 * - 카드 셸 (rounded-lg border bg-surface)
 * - 섹션 헤더: 11px uppercase letter-spaced tracking
 * - 라벨: 라디오/체크박스 + 우측 텍스트
 * - 마켓 옵션은 brand color dot 으로 식별 보강
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
    <div className="rounded-lg border border-border bg-surface p-5">
      <Fieldset legend="기간">
        <div className="flex flex-col gap-1.5">
          {PERIOD_OPTIONS.map((opt) => {
            const checked = draft.period === opt.value
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm text-text hover:bg-surface-muted"
              >
                <input
                  type="radio"
                  name="period"
                  value={opt.value}
                  checked={checked}
                  onChange={() =>
                    setDraft((d) => ({ ...d, period: opt.value }))
                  }
                  className="h-4 w-4 cursor-pointer border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className={checked ? 'font-semibold text-text' : ''}>
                  {opt.label}
                </span>
              </label>
            )
          })}
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

      <FieldsetDivider />

      <Fieldset legend="마켓">
        <div className="flex flex-col gap-1.5">
          {MARKET_IDS.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm text-text hover:bg-surface-muted"
            >
              <input
                type="checkbox"
                checked={(draft.markets ?? []).includes(id)}
                onChange={() => toggleMarket(id)}
                aria-label={`${MARKET_LABEL[id]} 필터`}
                className="h-4 w-4 cursor-pointer rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span
                aria-hidden
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${MARKET_DOT_CLASS[id]}`}
              />
              <span>{MARKET_LABEL[id]}</span>
            </label>
          ))}
        </div>
      </Fieldset>

      <FieldsetDivider />

      <Fieldset legend="상태">
        <div className="flex flex-col gap-1.5">
          {JOB_STATUSES.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-sm text-text hover:bg-surface-muted"
            >
              <input
                type="checkbox"
                checked={(draft.statuses ?? []).includes(s)}
                onChange={() => toggleStatus(s)}
                aria-label={`${STATUS_LABEL[s]} 필터`}
                className="h-4 w-4 cursor-pointer rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span>{STATUS_LABEL[s]}</span>
              {s === 'partial' ? (
                <span className="ml-auto text-[10.5px] text-text-tertiary">
                  재시도 대상
                </span>
              ) : null}
            </label>
          ))}
        </div>
      </Fieldset>

      <FieldsetDivider />

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

      <div className="mt-5 flex gap-2">
        <Button onClick={apply} className="flex-1" size="sm">
          적용
        </Button>
        <Button variant="ghost" onClick={onReset} size="sm">
          초기화
        </Button>
      </div>
    </div>
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
      <legend className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
        {legend}
      </legend>
      {children}
    </fieldset>
  )
}

function FieldsetDivider(): JSX.Element {
  return <div aria-hidden className="my-5 h-px bg-border" />
}
