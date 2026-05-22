import { useEffect } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useForm, type Resolver, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Check, Lightbulb } from 'lucide-react'
import {
  Button,
  ErrorMessage,
  Input,
  Label,
  RichTextEditor,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'
import { Step1Schema } from '@/lib/schemas/registration'
import type { z } from 'zod'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import { useDuplicateProductCheck } from '../hooks/useDuplicateProductCheck'
import { useShippingPolicies } from '../hooks/useShippingPolicies'
import { useUpsertProductDraft } from '../hooks/useProductDraft'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

/**
 * StepInfoPage — n16 상품 정보 입력 (1/5). Studio 룩 — 2-column 폼 + 우측 완료조건 사이드바.
 * 마스터: docs/architecture/v1/features/registration.md §10.3 · docs/design-renewal/s3-register.md
 *
 * - RHF + zodResolver(Step1Schema) — 단일 ground truth (lib/schemas/registration.ts).
 * - 상품명 디바운스 500ms 중복 확인.
 * - 배송정책 = useShippingPolicies 의 select. 0개면 안내.
 * - blockingReasons: 필수 누락 / 가격 잘못 / 중복 라벨 / 진행 중 mutation → tooltip 노출.
 */
type Step1Form = z.infer<typeof Step1Schema>

export function StepInfoPage(): JSX.Element {
  const navigate = useNavigate()
  const setStep1 = useRegisterFormStore((s) => s.setStep1)
  const setProductId = useRegisterFormStore((s) => s.setProductId)
  const initialStep1 = useRegisterFormStore((s) => s.step1)
  const productId = useRegisterFormStore((s) => s.productId)
  const { data: policies, isLoading: policiesLoading, isError: policiesError } = useShippingPolicies()
  const upsert = useUpsertProductDraft()

  const form = useForm<Step1Form>({
    resolver: zodResolver(Step1Schema) as Resolver<Step1Form>,
    mode: 'onChange',
    defaultValues: initialStep1 ?? {
      name: '',
      price: 0,
      originalPrice: null,
      brand: null,
      manufacturer: null,
      descriptionHtml: null,
      baseCategoryId: '',
      shippingPolicyId: '',
    },
  })

  const watchedName = form.watch('name')
  const watchedBrand = form.watch('brand')
  const dup = useDuplicateProductCheck(watchedName, productId)

  // 빈 폼 진입 시점에 검증 1회 트리거 — blockingReasons 가 즉시 채워짐.
  useEffect(() => {
    void form.trigger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = (values: Step1Form): void => {
    setStep1(values)
    upsert.mutate(
      { productId, draft: values },
      {
        onSuccess: (data) => {
          setProductId(data.productId)
          navigate('/register/images')
        },
        onError: (err) => {
          toast.error('상품 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
          logger.warn({ err: String(err) }, 'upsert product draft failed')
        },
      },
    )
  }

  const blockingReasons: string[] = []
  if (Object.keys(form.formState.errors).length > 0) blockingReasons.push('필수 항목을 모두 입력하세요')
  if (dup.data?.duplicate) blockingReasons.push('동일 상품명의 미완료 상품이 있습니다')
  if (form.formState.isSubmitting || upsert.isPending) blockingReasons.push('처리 중…')

  const hasCore =
    !form.formState.errors.name &&
    !form.formState.errors.price &&
    !form.formState.errors.baseCategoryId &&
    !form.formState.errors.shippingPolicyId
  const hasBrand = watchedBrand !== null && String(watchedBrand).trim().length > 0

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* 본문 — 기본 정보 */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <header className="mb-5">
            <h2 className="text-[15px] font-bold text-text">기본 정보</h2>
            <p className="mt-1 text-[12.5px] text-text-tertiary">
              여기서 입력한 정보는 모든 마켓에 공통으로 사용돼요.
            </p>
          </header>

          <div className="space-y-4">
            <Field
              id="info-name"
              label="상품명"
              required
              hint="100자 이내"
              error={form.formState.errors.name?.message}
            >
              <Input id="info-name" type="text" autoComplete="off" {...form.register('name')} />
              {watchedName.length >= 2 && dup.data?.duplicate && (
                <p role="alert" className="text-xs font-medium text-warning-on-soft">
                  동일 상품명의 미완료 상품이 이미 있습니다. 이력에서 확인하세요.
                </p>
              )}
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                id="info-price"
                label="판매가"
                required
                hint="원"
                error={form.formState.errors.price?.message}
              >
                <Input
                  id="info-price"
                  type="number"
                  inputMode="numeric"
                  min={100}
                  className="font-mono"
                  {...form.register('price', { valueAsNumber: true })}
                />
              </Field>
              <Field
                id="info-original"
                label="정상가 (선택)"
                hint="할인 표시용"
                error={form.formState.errors.originalPrice?.message}
              >
                <Input
                  id="info-original"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="font-mono"
                  {...form.register('originalPrice', {
                    setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                  })}
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                id="info-brand"
                label="브랜드"
                hint="일부 카테고리 필수"
                error={form.formState.errors.brand?.message}
              >
                <Input
                  id="info-brand"
                  type="text"
                  placeholder="예) konai"
                  {...form.register('brand', { setValueAs: (v) => (v === '' ? null : v) })}
                />
              </Field>
              <Field
                id="info-manufacturer"
                label="제조사 (선택)"
                error={form.formState.errors.manufacturer?.message}
              >
                <Input
                  id="info-manufacturer"
                  type="text"
                  placeholder="예) konai 코리아"
                  {...form.register('manufacturer', { setValueAs: (v) => (v === '' ? null : v) })}
                />
              </Field>
            </div>

            <Field
              id="info-base-category"
              label="내부 카테고리"
              required
              hint='예: "패션 > 의류"'
              error={form.formState.errors.baseCategoryId?.message}
            >
              <Input
                id="info-base-category"
                type="text"
                placeholder='예) "가전 > 주방가전"'
                {...form.register('baseCategoryId')}
              />
              <p className="text-xs text-text-tertiary">
                마켓별 카테고리는 3단계에서 매핑합니다. 여기서는 내부 분류 키만 입력하세요.
              </p>
            </Field>

            <Field
              id="info-shipping"
              label="배송 정책"
              required
              error={form.formState.errors.shippingPolicyId?.message}
            >
              {policiesLoading && <Skeleton className="h-10 w-full" />}
              {policiesError && (
                <ErrorMessage message="배송 정책을 불러오지 못했습니다. 새로고침해 주세요." />
              )}
              {!policiesLoading && !policiesError && (
                <>
                  <select
                    id="info-shipping"
                    className="flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-1 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...form.register('shippingPolicyId')}
                    defaultValue={initialStep1?.shippingPolicyId ?? ''}
                  >
                    <option value="">배송 정책을 선택하세요</option>
                    {(policies ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.fee.toLocaleString()}원 · {p.etaDays}일
                      </option>
                    ))}
                  </select>
                  {(policies?.length ?? 0) === 0 && (
                    <p className="text-xs font-medium text-warning-on-soft">
                      등록된 배송 정책이 없습니다.{' '}
                      <RouterLink
                        to="/settings/policies"
                        className="underline underline-offset-2 hover:text-text"
                      >
                        배송 정책 관리에서 1건 이상 추가하세요
                      </RouterLink>
                      .
                    </p>
                  )}
                </>
              )}
            </Field>

            <Field
              id="info-description"
              label="상품 설명 (선택)"
              hint="50,000자 이내"
              error={form.formState.errors.descriptionHtml?.message}
            >
              <Controller
                control={form.control}
                name="descriptionHtml"
                render={({ field }) => (
                  <RichTextEditor
                    id="info-description"
                    value={field.value ?? ''}
                    onChange={(html) => field.onChange(html === '' ? null : html)}
                    placeholder="상품 설명을 입력하세요. 굵게/목록/링크/이미지 사용 가능."
                  />
                )}
              />
              <p className="text-xs text-text-tertiary">
                저장 시 XSS 위험 태그·이벤트 속성은 자동으로 제거됩니다.
              </p>
            </Field>
          </div>
        </section>

        {/* 우측 사이드 — 완료조건 + 중복검사 + 템플릿 안내 */}
        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning-on-soft" aria-hidden />
              <p className="text-[13px] font-bold text-text">완료 조건</p>
            </div>
            <ul className="space-y-1.5 text-[12.5px] text-text">
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    hasCore ? 'bg-success text-white' : 'bg-border text-text-tertiary',
                  )}
                >
                  {hasCore ? '✓' : '·'}
                </span>
                상품명·가격·카테고리·배송정책 입력
              </li>
              <li className="flex items-start gap-2">
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    hasBrand ? 'bg-success text-white' : 'bg-danger text-white',
                  )}
                >
                  {hasBrand ? '✓' : '!'}
                </span>
                {hasBrand ? '브랜드 입력 완료' : '브랜드 미입력 — 일부 마켓에서 등록 불가'}
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="mb-1 text-[13px] font-bold text-text">중복 상품명 검사</p>
            <p className="mb-3 text-[12px] text-text-tertiary">
              이름이 같은 미완료 상품이 있는지 자동으로 확인해요.
            </p>
            <div
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-2',
                dup.data?.duplicate
                  ? 'bg-danger-soft text-danger-on-soft'
                  : 'bg-success-soft text-success-on-soft',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-full text-white',
                  dup.data?.duplicate ? 'bg-danger' : 'bg-success',
                )}
              >
                {dup.data?.duplicate ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" strokeWidth={3} />
                )}
              </span>
              <span className="text-[12.5px] font-medium">
                {dup.data?.duplicate ? '동일 상품명 미완료 상품 있음' : '중복 없음 · 500ms 디바운스'}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border-strong bg-surface-subtle p-4">
            <div className="mb-1 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-text-secondary" aria-hidden />
              <p className="text-[13px] font-bold text-text-secondary">템플릿 불러오기 (v2)</p>
            </div>
            <p className="text-[11.5px] text-text-tertiary">
              자주 쓰는 상품 정보를 저장해 두면 5초 만에 등록할 수 있어요.
            </p>
          </div>
        </aside>
      </div>

      {/* Action bar */}
      <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-3 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="border border-border"
        >
          ← 취소
        </Button>
        <div className="flex-1 text-[12.5px] text-text-tertiary">
          {blockingReasons.length > 0 ? blockingReasons[0] : '입력이 완료되었어요. 다음 단계로 진행하세요.'}
        </div>
        {blockingReasons.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button type="submit" variant="primary" disabled aria-disabled>
                  다음: 이미지 →
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <ul className="space-y-0.5 text-xs">
                {blockingReasons.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button type="submit" variant="primary">
            다음: 이미지 →
          </Button>
        )}
      </div>
    </form>
  )
}

interface FieldProps {
  id: string
  label: string
  hint?: string
  required?: boolean
  error?: string | undefined
  children: React.ReactNode
}

function Field({ id, label, hint, required, error, children }: FieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-[12.5px] font-semibold text-text-secondary">
          {label}
        </Label>
        {required && <span className="text-[11px] font-bold text-danger">*</span>}
        {hint && <span className="ml-auto text-[11px] text-text-tertiary">{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger-on-soft">
          {error}
        </p>
      )}
    </div>
  )
}

export default StepInfoPage
