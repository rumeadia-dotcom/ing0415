import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorMessage,
  Input,
  Label,
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

/**
 * StepInfoPage — n16 상품 정보 입력 (1/5).
 * 마스터: docs/architecture/v1/features/registration.md §10.3
 *
 * - RHF + zodResolver(Step1Schema).
 * - 상품명 디바운스 500ms 중복 확인 (useDuplicateProductCheck).
 * - 배송정책 = useShippingPolicies 의 select. 0개면 안내 + 빠른 생성 링크 (v2 별도 페이지).
 * - blockingReasons: 필수 누락 / 가격 잘못 / 중복 라벨 / 진행 중 mutation.
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>1단계 — 상품 정보</CardTitle>
          <CardDescription>상품명·가격·설명·브랜드 등 핵심 정보를 입력합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="상품명" htmlFor="info-name" error={form.formState.errors.name?.message}>
            <Input id="info-name" type="text" autoComplete="off" {...form.register('name')} />
            {watchedName.length >= 2 && dup.data?.duplicate && (
              <p role="alert" className="text-xs text-warning-on-soft">
                동일 상품명의 미완료 상품이 이미 있습니다. 이력에서 확인하세요.
              </p>
            )}
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="판매가 (원)" htmlFor="info-price" error={form.formState.errors.price?.message}>
              <Input
                id="info-price"
                type="number"
                inputMode="numeric"
                min={100}
                {...form.register('price', { valueAsNumber: true })}
              />
            </Field>
            <Field label="정상가 (원, 선택)" htmlFor="info-original" error={form.formState.errors.originalPrice?.message}>
              <Input
                id="info-original"
                type="number"
                inputMode="numeric"
                min={0}
                {...form.register('originalPrice', {
                  setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                })}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="브랜드 (선택)" htmlFor="info-brand" error={form.formState.errors.brand?.message}>
              <Input
                id="info-brand"
                type="text"
                {...form.register('brand', { setValueAs: (v) => (v === '' ? null : v) })}
              />
            </Field>
            <Field label="제조사 (선택)" htmlFor="info-manufacturer" error={form.formState.errors.manufacturer?.message}>
              <Input
                id="info-manufacturer"
                type="text"
                {...form.register('manufacturer', { setValueAs: (v) => (v === '' ? null : v) })}
              />
            </Field>
          </div>

          <Field label="내부 카테고리" htmlFor="info-base-category" error={form.formState.errors.baseCategoryId?.message}>
            <Input
              id="info-base-category"
              type="text"
              placeholder='예: "가전 > 주방가전"'
              {...form.register('baseCategoryId')}
            />
            <p className="text-xs text-text-tertiary">
              마켓별 카테고리는 3단계에서 매핑합니다. 여기서는 내부 분류 키만 입력하세요.
            </p>
          </Field>

          <Field
            label="배송 정책"
            htmlFor="info-shipping"
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
                  className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-button shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  <p className="text-xs text-warning-on-soft">
                    등록된 배송 정책이 없습니다. 별도 화면에서 1건 이상 생성해 주세요 (v2 별도 페이지).
                  </p>
                )}
              </>
            )}
          </Field>

          <Field
            label="상품 설명 (선택)"
            htmlFor="info-description"
            error={form.formState.errors.descriptionHtml?.message}
          >
            <textarea
              id="info-description"
              rows={6}
              className="flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...form.register('descriptionHtml', { setValueAs: (v) => (v === '' ? null : v) })}
            />
            <p className="text-xs text-text-tertiary">
              WYSIWYG 에디터는 v2 에 제공됩니다. 현재는 plain text 또는 HTML 문자열만 가능.
            </p>
          </Field>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-2">
        {blockingReasons.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button type="submit" variant="primary" disabled aria-disabled>
                  다음: 이미지
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
            다음: 이미지
          </Button>
        )}
      </div>
    </form>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  error?: string | undefined
  children: React.ReactNode
}

function Field({ label, htmlFor, error, children }: FieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-danger-on-soft">
          {error}
        </p>
      )}
    </div>
  )
}

export default StepInfoPage
