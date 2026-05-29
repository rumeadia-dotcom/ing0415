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

interface OfficialNoticeFieldProps {
  fieldId: string
  fieldLabel: string
  /** marketOptions.officialNotice 현재값. 미선택이면 undefined. */
  value: EsmOfficialNotice | undefined
  onChange: (value: EsmOfficialNotice | undefined) => void
}

/**
 * 상품정보고시 입력 — 상품군 select(41) + 군별 필수 고시 항목 동적 폼 (s3 3단계, PR-5).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.4 / §5, esm-api/product/161.md.
 *
 * 동작:
 *  1. 상품군 select — ESM_OFFICIAL_NOTICE_GROUPS(41개 법정 표준 상품군) 옵션.
 *  2. 군 선택 시 그 군의 정적 requiredItemCodes(문서 확인분)를 잠금 항목으로 seed.
 *     - 항목코드는 잠금(읽기전용), value 만 입력 → details[{code,value}] 로 수집.
 *     - 군의 항목 마스터가 라이브 API 대상(hasStaticItems=false)이라 정적 코드가 없으면,
 *       셀러가 직접 항목(code+value)을 추가할 수 있는 free-form 행 입력을 제공한다
 *       (코드 날조 금지 — esm.md "근거 없는 결정 금지").
 *  3. 입력값을 EsmOfficialNotice({officialNoticeNo, details[{code,value}]}) 형태로 모아
 *     marketOptions.officialNotice 에 적재. 오케스트레이터가 mapping.extra.officialNotice 로
 *     흘려 PR-4 transformProduct 가 페이로드에 넣는다.
 *
 * required 완성도(미선택/항목 value 누락) 검증·다음버튼 차단은 상위 makeStep3Schema +
 * blockingReasons (isOfficialNoticeComplete 단일 소스 재사용).
 */
export function OfficialNoticeField({
  fieldId,
  fieldLabel,
  value,
  onChange,
}: OfficialNoticeFieldProps): JSX.Element {
  const t = ko.markets.registrationFields.officialNoticeField
  const options = useMemo(() => getEsmOfficialNoticeOptions(), [])

  const selectedNo = value?.officialNoticeNo
  const details = value?.details ?? []

  const group =
    selectedNo && EsmOfficialNoticeNoSchema.safeParse(selectedNo).success
      ? ESM_OFFICIAL_NOTICE_GROUP_BY_NO[selectedNo as EsmOfficialNoticeNo]
      : undefined

  const handleGroupChange = (next: string): void => {
    if (next === '') {
      onChange(undefined)
      return
    }
    const parsed = EsmOfficialNoticeNoSchema.safeParse(next)
    if (!parsed.success) return
    const nextGroup = ESM_OFFICIAL_NOTICE_GROUP_BY_NO[parsed.data]
    // 군 변경 시 details 초기화 — 정적 필수항목 코드를 빈 value 로 seed.
    const seeded: EsmOfficialNoticeDetail[] = nextGroup.requiredItemCodes.map(
      (code) => ({ code, value: '' }),
    )
    onChange({ officialNoticeNo: parsed.data, details: seeded })
  }

  const updateDetail = (index: number, patch: Partial<EsmOfficialNoticeDetail>): void => {
    if (!selectedNo) return
    const nextDetails = details.map((d, i) => (i === index ? { ...d, ...patch } : d))
    onChange({ officialNoticeNo: selectedNo, details: nextDetails })
  }

  const addDetail = (): void => {
    if (!selectedNo) return
    onChange({
      officialNoticeNo: selectedNo,
      details: [...details, { code: '', value: '' }],
    })
  }

  const removeDetail = (index: number): void => {
    if (!selectedNo) return
    onChange({
      officialNoticeNo: selectedNo,
      details: details.filter((_, i) => i !== index),
    })
  }

  // 정적 필수항목(군별 잠금 코드) 개수 — 그 위 행은 코드 잠금, 그 이하는 셀러 추가행.
  const staticCount = group?.requiredItemCodes.length ?? 0

  return (
    <div className="flex flex-col gap-2.5">
      <select
        id={fieldId}
        aria-label={fieldLabel}
        className={SELECT_CLASS}
        value={selectedNo ?? ''}
        onChange={(e) => handleGroupChange(e.target.value)}
      >
        <option value="">{t.groupPlaceholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {selectedNo && (
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
