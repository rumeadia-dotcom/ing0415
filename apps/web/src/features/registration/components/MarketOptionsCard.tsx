import { useNavigate } from 'react-router-dom'
import { Check, AlertCircle, ExternalLink } from 'lucide-react'
import { Button, Input, Skeleton } from '@/components/ui'
import { useMarketCategoryTree } from '../hooks/useMarketCategoryTree'
import { useEsmShippingProfiles } from '@/features/settings/shipping'
import { getRegistrationFieldsForMarket } from '@/lib/markets/registration-fields'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import { resolveKoPath } from '@/lib/i18n'
import { ko } from '@/locales/ko'
import type { CategoryNode } from '@/lib/schemas'
import type { CategoryMapping } from '@/lib/schemas/registration'
import type { RegistrationFieldMeta } from '@/lib/schemas'
import { cn } from '@/lib/utils'

interface MarketOptionsCardProps {
  marketId: MarketId
  /** 선택된 마켓 계정 — shippingProfile 필드의 옵션 출처(useEsmShippingProfiles)에 사용. */
  marketAccountId: string
  mapping: CategoryMapping | null
  onChange: (mapping: CategoryMapping) => void
}

const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-[12.5px] text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

/**
 * MarketOptionsCard — 마켓별 카테고리 매핑 + 어댑터가 선언한 동적 등록필드 렌더 (s3 3단계).
 * 마스터: docs/architecture/v1/features/esm.md §4.6 / §5, registration.md §10.5, market-adapter.md §9.8.
 *
 * CategoryMappingCard 의 일반화 버전:
 *  - 카테고리 매핑(기존 동작) + `getRegistrationFieldsForMarket(marketId)` 가 선언한 필드를 동적 렌더.
 *  - 컴포넌트 내 `if (marketId === 'gmarket')` 같은 하드코딩 분기 없음 — 어댑터 메타 kind 로만 분기.
 *  - ESM(gmarket/auction): 카테고리 + 배송 프로필 select. 그 외: 메타 빈 배열 → 카테고리만(회귀 없음).
 *
 * 동적 옵션값(shippingProfileId 등)은 mapping.marketOptions[fieldKey] 에 적재.
 * required 미입력 검증·다음버튼 차단은 상위 페이지(makeStep3Schema + blockingReasons).
 */
export function MarketOptionsCard({
  marketId,
  marketAccountId,
  mapping,
  onChange,
}: MarketOptionsCardProps): JSX.Element {
  const { data, isLoading, isError } = useMarketCategoryTree(marketId)
  const label = MARKET_CATALOG[marketId].label
  const flatOptions = data ? flatten(data, []) : []
  const isMapped = Boolean(mapping?.marketCategoryCode)

  const fields = getRegistrationFieldsForMarket(marketId)
  const marketOptions = mapping?.marketOptions ?? {}

  const selected = flatOptions.find((o) => o.code === mapping?.marketCategoryCode) ?? null
  const path = selected ? selected.path.join(' › ') : '— 카테고리 미선택'

  const emitMapping = (patch: Partial<CategoryMapping>): void => {
    onChange({
      marketId,
      marketCategoryCode: mapping?.marketCategoryCode ?? '',
      marketNameOverride: mapping?.marketNameOverride ?? null,
      marketPriceOverride: mapping?.marketPriceOverride ?? null,
      marketOptions: mapping?.marketOptions ?? {},
      ...patch,
    })
  }

  const setOption = (key: string, value: unknown): void => {
    emitMapping({ marketOptions: { ...marketOptions, [key]: value } })
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isMapped ? 'border-border bg-surface' : 'border-warning/30 bg-warning-soft/40',
      )}
    >
      {/* 카테고리 매핑 row (기존 CategoryMappingCard 레이아웃 유지) */}
      <div className="grid items-center gap-3 md:grid-cols-[auto_1fr_240px_auto]">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: BRAND_COLOR[marketId] }}
        >
          {label.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-text">{label}</p>
          <p
            className={cn(
              'mt-0.5 truncate text-[11.5px]',
              isMapped ? 'text-text-tertiary' : 'font-semibold text-warning-on-soft',
            )}
          >
            {path}
          </p>
        </div>
        {isLoading && <Skeleton className="h-9 w-full" />}
        {isError && (
          <p className="text-sm text-danger-on-soft">카테고리를 불러오지 못했습니다.</p>
        )}
        {!isLoading && !isError && (
          <select
            aria-label={`${label} 카테고리 선택`}
            className={SELECT_CLASS}
            value={mapping?.marketCategoryCode ?? ''}
            onChange={(e) => emitMapping({ marketCategoryCode: e.target.value })}
          >
            <option value="">— 카테고리 선택 —</option>
            {flatOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.path.join(' > ')}
              </option>
            ))}
          </select>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
            isMapped
              ? 'bg-success-soft text-success-on-soft'
              : 'bg-warning-soft text-warning-on-soft',
          )}
        >
          {isMapped ? (
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          ) : (
            <AlertCircle className="h-3 w-3" aria-hidden />
          )}
          {isMapped ? '매핑 완료' : '선택 필요'}
        </span>
      </div>

      {/* 동적 등록필드 — 어댑터 메타 기반 (ESM=배송 프로필 등). 메타 0개면 렌더 없음(회귀). */}
      {fields.length > 0 && (
        <div className="mt-3.5 flex flex-col gap-3 border-t border-border pt-3.5">
          {fields.map((field) => (
            <MarketOptionField
              key={field.key}
              field={field}
              marketAccountId={marketAccountId}
              value={marketOptions[field.key]}
              onChange={(value) => setOption(field.key, value)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface MarketOptionFieldProps {
  field: RegistrationFieldMeta
  marketAccountId: string
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * 단일 동적 필드 렌더 — kind 별 분기. marketId 하드코딩 없이 메타로만 결정.
 * 확장 대비: select/text/number 기본 렌더 지원, shippingProfile 특수 렌더.
 */
function MarketOptionField({
  field,
  marketAccountId,
  value,
  onChange,
}: MarketOptionFieldProps): JSX.Element {
  const fieldLabel = resolveKoPath(field.label)
  const helpText = field.helpText ? resolveKoPath(field.helpText) : null

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[12px] font-semibold text-text-secondary"
        htmlFor={`mof-${field.key}`}
      >
        {fieldLabel}
        {field.required && (
          <span className="ml-1 text-danger-on-soft" aria-hidden>
            *
          </span>
        )}
      </label>
      {field.kind === 'shippingProfile' ? (
        <ShippingProfileSelect
          fieldId={`mof-${field.key}`}
          fieldLabel={fieldLabel}
          marketAccountId={marketAccountId}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      ) : field.kind === 'number' ? (
        <Input
          id={`mof-${field.key}`}
          type="number"
          aria-label={fieldLabel}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : Number(e.target.value))
          }
        />
      ) : (
        // 'text' / 'select' / 'officialNotice'(PR-5 전 placeholder) — 기본 text 입력.
        // 'select' 의 동적 옵션 출처는 후속 PR 에서 optionsSource 별 분기 추가.
        <Input
          id={`mof-${field.key}`}
          type="text"
          aria-label={fieldLabel}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {helpText && <p className="text-[11px] text-text-tertiary">{helpText}</p>}
    </div>
  )
}

interface ShippingProfileSelectProps {
  fieldId: string
  fieldLabel: string
  marketAccountId: string
  value: string
  onChange: (value: string) => void
}

/**
 * 배송 프로필 select — useEsmShippingProfiles(marketAccountId) 로 옵션 로드.
 * 4상태: loading / error / data(active 프로필 select) / empty("만들러 가기" deep link).
 */
function ShippingProfileSelect({
  fieldId,
  fieldLabel,
  marketAccountId,
  value,
  onChange,
}: ShippingProfileSelectProps): JSX.Element {
  const navigate = useNavigate()
  const t = ko.markets.registrationFields.shippingProfileField
  const { data, isLoading, isError } = useEsmShippingProfiles(marketAccountId)

  if (isLoading) {
    return <Skeleton className="h-9 w-full" aria-label={t.loading} />
  }
  if (isError) {
    return <p className="text-[12px] text-danger-on-soft">{t.error}</p>
  }

  // 사용 가능 프로필 = status='active' 만 (생성 중 오류 row 는 선택 불가).
  const usable = (data ?? []).filter((p) => p.status === 'active')

  if (usable.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border-strong bg-surface-subtle p-3">
        <p className="text-[12px] font-semibold text-text-secondary">{t.emptyTitle}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="border border-border"
          onClick={() => navigate('/settings/shipping/esm-profiles')}
        >
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {t.emptyCta}
        </Button>
      </div>
    )
  }

  return (
    <select
      id={fieldId}
      aria-label={fieldLabel}
      className={SELECT_CLASS}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{t.placeholder}</option>
      {usable.map((p) => (
        <option key={p.id} value={p.id}>
          {p.profileLabel}
        </option>
      ))}
    </select>
  )
}

interface FlatOption {
  code: string
  path: string[]
}

function flatten(nodes: CategoryNode[], parentPath: string[]): FlatOption[] {
  const acc: FlatOption[] = []
  for (const n of nodes) {
    const path = [...parentPath, n.name]
    if (n.leaf || !n.children || n.children.length === 0) {
      acc.push({ code: n.id, path })
    } else {
      acc.push(...flatten(n.children, path))
    }
  }
  return acc
}
