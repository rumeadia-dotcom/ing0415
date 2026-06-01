import { useId } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import type { FieldValues, UseFormRegisterReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ErrorMessage } from '@/components/ui/error-message'
import { describeTiers } from '@/lib/shipping/expand-box'
import type { ShippingFeeType } from '@/lib/schemas/shipping-config'
import { ko } from '@/locales/ko'

/**
 * ShippingConfigSection — 인라인 배송 설정 폼 섹션 (controlled RHF, `name` prop).
 *
 * 마스터: docs/superpowers/specs/2026-06-01-quantity-tiered-shipping-design.md §5.
 * 근거: PRD §1.1.4 기본 배송 정보 + 수량 구간(박스) 배송비 (C9).
 *
 * - 단일 객체 필드(`ShippingConfig`) 를 편집. shape 단일 소스는
 *   `@/lib/schemas/shipping-config` 의 `ShippingConfigSchema`.
 * - `useFormContext()` + `useWatch()` 로 feeType / box 값을 구독해 조건부 렌더.
 * - 모든 숫자 입력은 `register(..., { valueAsNumber: true })` — 스키마가 number 기대.
 * - StepInfoPage / SettingsPoliciesPage 양쪽에서 재사용 가능하도록 `name` prop 로 경로 주입.
 *
 * shadcn 미존재 컴포넌트:
 *  - radio-group / select → 네이티브 `<input type="radio">` / `<select>` (코드베이스 기존 패턴).
 *  - 라벨-컨트롤 연결은 모두 `htmlFor` + `id` 로 명시 (jsx-a11y 준수).
 */

const t = ko.register.shipping

export interface ShippingConfigSectionProps {
  /** RHF 필드 경로. 기본 'shippingConfig'. */
  name?: string
}

/** StepInfoPage 와 동일한 styled native `<select>` className. */
const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-1 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const FEE_TYPES: readonly ShippingFeeType[] = [
  'free',
  'conditional_free',
  'paid',
  'quantity_tiered',
  'charge_on_delivery',
]

/** 박스 스키마 mins (qtyPerBox ≥ 2 / feePerBox ≥ 0) — 프리뷰 가드. */
const BOX_MIN_QTY = 2
const BOX_MIN_FEE = 0

export function ShippingConfigSection({
  name = 'shippingConfig',
}: ShippingConfigSectionProps): JSX.Element {
  const { register, control } = useFormContext<FieldValues>()
  const baseId = useId()

  const feeType = useWatch({ control, name: `${name}.feeType` }) as
    | ShippingFeeType
    | undefined
  const qtyPerBox = useWatch({ control, name: `${name}.box.qtyPerBox` }) as
    | number
    | undefined
  const feePerBox = useWatch({ control, name: `${name}.box.feePerBox` }) as
    | number
    | undefined

  const previewValid =
    typeof qtyPerBox === 'number' &&
    Number.isInteger(qtyPerBox) &&
    qtyPerBox >= BOX_MIN_QTY &&
    typeof feePerBox === 'number' &&
    Number.isInteger(feePerBox) &&
    feePerBox >= BOX_MIN_FEE
  const previewText = previewValid
    ? describeTiers({ qtyPerBox, feePerBox })
    : ''

  const id = (suffix: string): string => `${baseId}-${suffix}`

  return (
    <section className="flex flex-col gap-5" aria-label={t.sectionTitle}>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-text">{t.sectionTitle}</h3>
        <p className="text-xs text-text-tertiary">{t.sectionDescription}</p>
      </div>

      {/* 1) 배송방식 + 예상 배송일수 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Row>
          <Label htmlFor={id('method')}>{t.method.label}</Label>
          <select
            id={id('method')}
            className={SELECT_CLASS}
            {...register(`${name}.method`)}
          >
            <option value="parcel">{t.method.parcel}</option>
            <option value="direct">{t.method.direct}</option>
            <option value="quick">{t.method.quick}</option>
            <option value="visit_pickup">{t.method.visit_pickup}</option>
          </select>
        </Row>

        <Row>
          <div className="flex items-center gap-1.5">
            <Label htmlFor={id('etaDays')}>{t.etaDays.label}</Label>
            <span className="ml-auto text-[11px] text-text-tertiary">
              {t.etaDays.hint}
            </span>
          </div>
          <Input
            id={id('etaDays')}
            type="number"
            min={0}
            max={30}
            {...register(`${name}.etaDays`, { valueAsNumber: true })}
          />
        </Row>
      </div>

      {/* 2) 배송비 유형 (radiogroup) */}
      <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
        <legend className="text-[12px] font-semibold text-dim">
          {t.feeType.legend}
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {FEE_TYPES.map((value) => (
            <div key={value} className="flex items-center gap-1.5">
              <input
                id={id(`feeType-${value}`)}
                type="radio"
                value={value}
                className="h-4 w-4 cursor-pointer accent-accent"
                {...register(`${name}.feeType`)}
              />
              <Label
                htmlFor={id(`feeType-${value}`)}
                className="cursor-pointer text-[13px] font-medium text-text"
              >
                {t.feeType[value]}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      {/* 3) 조건부 필드 */}
      {feeType === 'paid' && (
        <NumberField
          id={id('baseFee')}
          label={t.baseFee.label}
          unit={t.baseFee.unit}
          min={0}
          register={register(`${name}.baseFee`, { valueAsNumber: true })}
        />
      )}

      {feeType === 'conditional_free' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            id={id('baseFee')}
            label={t.baseFee.label}
            unit={t.baseFee.unit}
            min={0}
            register={register(`${name}.baseFee`, { valueAsNumber: true })}
          />
          <NumberField
            id={id('freeThreshold')}
            label={t.freeThreshold.label}
            hint={t.freeThreshold.hint}
            unit={t.freeThreshold.unit}
            min={0}
            register={register(`${name}.freeThreshold`, {
              valueAsNumber: true,
            })}
          />
        </div>
      )}

      {feeType === 'quantity_tiered' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              id={id('qtyPerBox')}
              label={t.box.qtyPerBox.label}
              hint={t.box.qtyPerBox.hint}
              unit={t.box.qtyPerBox.unit}
              min={2}
              register={register(`${name}.box.qtyPerBox`, {
                valueAsNumber: true,
              })}
            />
            <NumberField
              id={id('feePerBox')}
              label={t.box.feePerBox.label}
              unit={t.box.feePerBox.unit}
              min={0}
              register={register(`${name}.box.feePerBox`, {
                valueAsNumber: true,
              })}
            />
          </div>

          {previewText !== '' && (
            <p className="rounded-md bg-surface-subtle px-3 py-2 text-[13px] text-text">
              <span className="mr-1.5 font-semibold text-text-secondary">
                {t.box.previewLabel}
              </span>
              <span>{previewText}</span>
            </p>
          )}

          <ErrorMessage tone="warning" message={t.coupangWarning} />
        </div>
      )}

      {/* 4) 결제방법 + 묶음배송 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Row>
          <Label htmlFor={id('payType')}>{t.payType.label}</Label>
          <select
            id={id('payType')}
            className={SELECT_CLASS}
            {...register(`${name}.payType`)}
          >
            <option value="prepaid">{t.payType.prepaid}</option>
            <option value="collect">{t.payType.collect}</option>
            <option value="both">{t.payType.both}</option>
          </select>
        </Row>

        <Row>
          <Label htmlFor={id('bundleAllowed')}>{t.bundleAllowed.label}</Label>
          <div className="flex items-center gap-2.5">
            <Controller
              control={control}
              name={`${name}.bundleAllowed`}
              render={({ field }) => (
                <Switch
                  id={id('bundleAllowed')}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  aria-label={t.bundleAllowed.label}
                />
              )}
            />
            <span className="text-xs text-text-tertiary">
              {t.bundleAllowed.description}
            </span>
          </div>
        </Row>
      </div>

      {/* 5) 접힘 섹션 — 반품/교환/도서산간 */}
      <details className="rounded-md border border-border bg-surface">
        <summary className="cursor-pointer select-none px-3 py-2.5 text-[13px] font-medium text-text-secondary">
          {t.advanced.summary}
        </summary>
        <div className="grid grid-cols-1 gap-4 px-3 pb-3 pt-1 sm:grid-cols-2">
          <NumberField
            id={id('returnFee')}
            label={t.advanced.returnFee.label}
            unit={t.advanced.returnFee.unit}
            min={0}
            register={register(`${name}.returnFee`, { valueAsNumber: true })}
          />
          <NumberField
            id={id('exchangeFee')}
            label={t.advanced.exchangeFee.label}
            unit={t.advanced.exchangeFee.unit}
            min={0}
            register={register(`${name}.exchangeFee`, { valueAsNumber: true })}
          />
          <NumberField
            id={id('jeju')}
            label={t.advanced.areaSurcharge.jeju.label}
            unit={t.advanced.areaSurcharge.jeju.unit}
            min={0}
            register={register(`${name}.areaSurcharge.jeju`, {
              valueAsNumber: true,
            })}
          />
          <NumberField
            id={id('island')}
            label={t.advanced.areaSurcharge.island.label}
            unit={t.advanced.areaSurcharge.island.unit}
            min={0}
            register={register(`${name}.areaSurcharge.island`, {
              valueAsNumber: true,
            })}
          />
        </div>
      </details>
    </section>
  )
}

/** 라벨 + 컨트롤 세로 스택. */
function Row({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="flex flex-col gap-1.5">{children}</div>
}

/**
 * 숫자 입력 1필드 — `<Label htmlFor={id}>` + `<Input id={id} type="number">` 쌍.
 * 단위는 라벨 텍스트에 합쳐 접근성 이름을 "기본배송비 (원)" 형태로 만든다
 * (`getByLabelText` 매칭 가능 + 시각·스크린리더 동시 전달).
 */
function NumberField({
  id,
  label,
  hint,
  unit,
  min,
  register,
}: {
  id: string
  label: string
  hint?: string
  unit?: string
  min?: number
  register: UseFormRegisterReturn
}): JSX.Element {
  const labelText = unit ? `${label} (${unit})` : label
  return (
    <Row>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{labelText}</Label>
        {hint && (
          <span className="ml-auto text-[11px] text-text-tertiary">{hint}</span>
        )}
      </div>
      <Input id={id} type="number" min={min} {...register} />
    </Row>
  )
}

export default ShippingConfigSection
