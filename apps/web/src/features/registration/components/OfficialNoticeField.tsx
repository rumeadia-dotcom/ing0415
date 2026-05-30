import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import {
  ESM_OFFICIAL_NOTICE_GROUP_BY_NO,
  EsmOfficialNoticeNoSchema,
  getEsmOfficialNoticeOptions,
  type EsmOfficialNoticeNo,
} from '@/lib/markets/real/esm/official-notice-groups'
import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'
import type { EsmOfficialNotice, EsmOfficialNoticeDetail } from '@/lib/schemas'

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-[12.5px] text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

/** free-form 군 직접입력을 나타내는 select 의 가상 옵션 값 (실 군 코드와 충돌하지 않는 sentinel). */
const FREEFORM_VALUE = '__freeform__'

/**
 * 상품정보고시 마스터 설정 — 마켓별로 주입한다(컴포넌트 마켓 하드코딩 금지).
 *  - options: 상품군 select 옵션 [{ value(=officialNoticeNo/type), label }].
 *  - staticItemCodes(no): 군 선택 시 잠금 seed 할 정적 필수항목 코드(없으면 []).
 *  - allowFreeform: 마스터에 없는 상품군을 셀러가 직접 입력(type 직접 입력)할 수 있는지.
 *      11번가는 41군 중 1군(891011)만 확보(C4) → true. ESM 은 41군 select → false.
 */
export interface OfficialNoticeConfig {
  options: readonly { value: string; label: string }[]
  staticItemCodes: (no: string) => readonly string[]
  allowFreeform: boolean
}

/** ESM(41 상품군) 기본 설정 — 기존 호출부(ESM) 하위호환 (prop 미주입 시 이 설정 사용). */
const ESM_NOTICE_CONFIG: OfficialNoticeConfig = {
  options: getEsmOfficialNoticeOptions(),
  staticItemCodes: (no) =>
    EsmOfficialNoticeNoSchema.safeParse(no).success
      ? ESM_OFFICIAL_NOTICE_GROUP_BY_NO[no as EsmOfficialNoticeNo].requiredItemCodes
      : [],
  allowFreeform: false,
}

interface OfficialNoticeFieldProps {
  fieldId: string
  fieldLabel: string
  /** marketOptions.officialNotice 현재값. 미선택이면 undefined. */
  value: EsmOfficialNotice | undefined
  onChange: (value: EsmOfficialNotice | undefined) => void
  /**
   * 마켓별 상품군 마스터 설정. 미주입(undefined) 시 ESM(41군) 기본값 — 기존 ESM 호출부 하위호환.
   * 11번가 호출부(MarketOptionsCard)는 ELEVEN_ST 설정(1군 + free-form)을 주입한다.
   */
  config?: OfficialNoticeConfig | undefined
}

/**
 * 상품정보고시 입력 — 상품군 select + 군별 필수 고시 항목 동적 폼 (s3 3단계).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.4 / §5(ESM), 11st.md §4.1 / §4.6 / §7 PR-4(11번가).
 *
 * 공용 프레임 (마켓 하드코딩 0):
 *  - 상품군 select 옵션 / 정적 필수항목 / free-form 허용 여부는 `config` 로 주입(ESM·11번가 공유).
 *  - 값 형태는 generic `EsmOfficialNotice`({ officialNoticeNo, details:[{code,value}] }) 단일 — 마켓
 *    변환(11번가 {type,item})은 transformProduct(map.ts normalizeElevenStOfficialNotice)가 담당.
 *
 * 동작:
 *  1. 상품군 select — config.options. allowFreeform 이면 "직접 입력" 옵션 추가.
 *  2. 군 선택 시 그 군의 정적 필수항목(config.staticItemCodes)을 잠금 항목으로 seed.
 *  3. free-form 선택 시 셀러가 상품군 유형코드(officialNoticeNo)를 직접 입력 + 항목 자유 입력.
 *  4. 입력값을 EsmOfficialNotice 로 모아 marketOptions.officialNotice 에 적재.
 *
 * required 완성도 검증·다음버튼 차단은 상위 makeStep3Schema + isMarketOptionValuePresent(공용).
 */
export function OfficialNoticeField({
  fieldId,
  fieldLabel,
  value,
  onChange,
  config = ESM_NOTICE_CONFIG,
}: OfficialNoticeFieldProps): JSX.Element {
  const t = ko.markets.registrationFields.officialNoticeField
  const options = config.options
  const knownValues = useMemo(
    () => new Set(options.map((o) => o.value)),
    [options],
  )

  const selectedNo = value?.officialNoticeNo
  const details = value?.details ?? []

  // select 표시값: 미선택='' / 마스터 군=그 값 / 마스터 밖(직접입력)=FREEFORM sentinel.
  const isFreeform =
    config.allowFreeform &&
    selectedNo !== undefined &&
    !knownValues.has(selectedNo)
  const selectValue = selectedNo === undefined ? '' : isFreeform ? FREEFORM_VALUE : selectedNo

  const handleGroupChange = (next: string): void => {
    if (next === '') {
      onChange(undefined)
      return
    }
    if (next === FREEFORM_VALUE) {
      // free-form 진입 — type 빈 값으로 시작(셀러가 직접 입력칸에 채운다), 항목 1행 seed.
      onChange({ officialNoticeNo: '', details: [{ code: '', value: '' }] })
      return
    }
    // 마스터 군 — 정적 필수항목 코드를 빈 value 로 seed(잠금 행).
    const seeded: EsmOfficialNoticeDetail[] = config
      .staticItemCodes(next)
      .map((code) => ({ code, value: '' }))
    onChange({ officialNoticeNo: next, details: seeded })
  }

  const handleFreeformTypeChange = (nextType: string): void => {
    onChange({ officialNoticeNo: nextType, details })
  }

  const updateDetail = (index: number, patch: Partial<EsmOfficialNoticeDetail>): void => {
    if (selectedNo === undefined) return
    const nextDetails = details.map((d, i) => (i === index ? { ...d, ...patch } : d))
    onChange({ officialNoticeNo: selectedNo, details: nextDetails })
  }

  const addDetail = (): void => {
    if (selectedNo === undefined) return
    onChange({
      officialNoticeNo: selectedNo,
      details: [...details, { code: '', value: '' }],
    })
  }

  const removeDetail = (index: number): void => {
    if (selectedNo === undefined) return
    onChange({
      officialNoticeNo: selectedNo,
      details: details.filter((_, i) => i !== index),
    })
  }

  // 정적 필수항목(군별 잠금 코드) 개수 — free-form 은 0(전부 셀러 편집 가능).
  const staticCount = isFreeform ? 0 : config.staticItemCodes(selectedNo ?? '').length
  const hasSelection = selectedNo !== undefined

  return (
    <div className="flex flex-col gap-2.5">
      <select
        id={fieldId}
        aria-label={fieldLabel}
        className={SELECT_CLASS}
        value={selectValue}
        onChange={(e) => handleGroupChange(e.target.value)}
      >
        <option value="">{t.groupPlaceholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {config.allowFreeform && (
          <option value={FREEFORM_VALUE}>{t.freeformOption}</option>
        )}
      </select>

      {isFreeform && (
        <Input
          type="text"
          aria-label={t.freeformTypeAria}
          placeholder={t.freeformTypePlaceholder}
          value={selectedNo ?? ''}
          onChange={(e) => handleFreeformTypeChange(e.target.value)}
        />
      )}

      {hasSelection && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-subtle p-3">
          <p className="text-[11.5px] font-semibold text-text-secondary">
            {t.itemsTitle}
          </p>
          {details.length === 0 ? (
            <p className="text-[11px] text-text-tertiary">{t.itemsEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {details.map((d, i) => {
                const isLocked = i < staticCount
                return (
                  <li
                    key={`${d.code}-${i}`}
                    className="grid items-center gap-2 md:grid-cols-[160px_1fr_auto]"
                  >
                    <Input
                      type="text"
                      aria-label={t.itemCodeAria(i + 1)}
                      placeholder={t.itemCodePlaceholder}
                      value={d.code}
                      readOnly={isLocked}
                      className={cn(isLocked && 'bg-surface-muted text-text-tertiary')}
                      onChange={(e) =>
                        isLocked ? undefined : updateDetail(i, { code: e.target.value })
                      }
                    />
                    <Input
                      type="text"
                      aria-label={t.itemValueAria(i + 1)}
                      placeholder={t.itemValuePlaceholder}
                      value={d.value}
                      onChange={(e) => updateDetail(i, { value: e.target.value })}
                    />
                    {!isLocked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={t.itemRemoveAria(i + 1)}
                        className="border border-border"
                        onClick={() => removeDetail(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start border border-border"
            onClick={addDetail}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {t.itemAdd}
          </Button>
        </div>
      )}
    </div>
  )
}
