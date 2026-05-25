import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertCircle, Image as ImageIcon } from 'lucide-react'
import {
  Button,
  ErrorMessage,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import { useRegistrationValidate } from '../hooks/useRegistrationValidate'
import { useRegistrationStart } from '../hooks/useRegistrationStart'
import { MarketPreviewCard } from '../components/MarketPreviewCard'
import { RegistrationApiError } from '../api/registration-api'
import { formatRegistrationError } from '../utils/registration-error-messages'
import type { MarketId } from '@/features/markets/types'

/**
 * StepPreviewPage — n20 등록 미리보기 (4/5). Studio 룩.
 * 마스터: docs/architecture/v1/features/registration.md §10.6 · studio.jsx step4
 *
 * - 진입 시 1회 registration-validate invoke → 마켓별 카드 표시.
 * - error 1개 이상이면 등록 시작 disabled.
 * - warning 만이면 등록 가능 (사용자 인지 후 진행).
 * - 등록 시작 → registration-start → /register/result/<jobId> replace navigate.
 *
 * 화면 구성: hero (상품 요약 + 예상 수수료 합계) · 검증 배너(에러 시) · 마켓 카드 그리드 · 액션 바.
 */
export function StepPreviewPage(): JSX.Element {
  const navigate = useNavigate()
  const productId = useRegisterFormStore((s) => s.productId)
  const selections = useRegisterFormStore((s) => s.selections)
  const step1 = useRegisterFormStore((s) => s.step1)
  const images = useRegisterFormStore((s) => s.images)
  const validate = useRegistrationValidate()
  const start = useRegistrationStart()
  const startedRef = useRef(false)

  useEffect(() => {
    if (!productId || selections.length === 0) {
      navigate('/register/info', { replace: true })
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    validate.mutate({ productId, marketIds: selections.map((s) => s.marketId) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!productId || selections.length === 0) return <></>

  const validationData = validate.data

  const hasErrors = validationData
    ? (validationData.issues.length > 0 && validationData.issues.some((i) => isErrorCode(i.code))) ||
      selections.some((s) => !validationData.previews.find((p) => p.marketId === s.marketId))
    : false

  const handleStart = (): void => {
    if (!productId) return
    start.mutate(
      { productId, marketIds: selections.map((s) => s.marketId) },
      {
        onSuccess: (data) => {
          navigate(`/register/result/${data.jobId}`, { replace: true })
        },
        onError: (err) => {
          if (err instanceof RegistrationApiError) {
            const f = formatRegistrationError(err)
            toast.error(f.message, {
              description: f.correlationId ? `요청 ID: ${f.correlationId}` : undefined,
            })
          } else {
            toast.error('등록을 시작할 수 없습니다.')
          }
        },
      },
    )
  }

  const blockingReasons: string[] = []
  if (validate.isPending) blockingReasons.push('마켓별 검증 중')
  if (hasErrors)
    blockingReasons.push('일부 마켓에 등록 불가 항목이 있습니다. 이전 단계에서 수정하세요')
  if (start.isPending) blockingReasons.push('등록 시작 중')

  // hero stats
  const totalEstimatedFee =
    validationData?.previews.reduce((acc, p) => acc + (p.estimatedFee ?? 0), 0) ?? 0
  const successfulMarketCount =
    validationData?.previews.filter((p) => {
      const hasError = validationData.issues
        .filter((i) => i.marketId === p.marketId)
        .some((i) => isErrorCode(i.code))
      return !hasError
    }).length ?? 0

  return (
    <>
      {/* Hero summary */}
      <section className="mb-4 flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-text-tertiary">
          <ImageIcon className="h-7 w-7" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-text-tertiary">등록 요약</p>
          <h2 className="mt-0.5 truncate text-[20px] font-bold tracking-tight text-text">
            {step1?.name ?? '(상품명 없음)'}
          </h2>
          <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
            <PreviewStat label="판매가" value={`${(step1?.price ?? 0).toLocaleString()}원`} />
            {step1?.originalPrice != null && (
              <PreviewStat
                label="정상가"
                value={`${step1.originalPrice.toLocaleString()}원`}
              />
            )}
            <PreviewStat label="이미지" value={`${images.length}장`} />
            <PreviewStat label="마켓" value={`${selections.length}개`} />
          </dl>
        </div>
        <div className="border-t border-border pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0 md:text-right">
          <p className="text-[11.5px] font-semibold text-text-tertiary">예상 수수료 합계</p>
          <p className="mt-0.5 font-mono text-[24px] font-bold tracking-tight text-text">
            {totalEstimatedFee.toLocaleString()}원
          </p>
          <p className="mt-0.5 text-[11.5px] text-text-tertiary">
            {successfulMarketCount}/{selections.length}개 마켓 진행 가능
          </p>
        </div>
      </section>

      {/* Validation error banner */}
      {hasErrors && (
        <div className="mb-3.5 flex items-center gap-3.5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3.5">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger text-white"
          >
            <AlertCircle className="h-4 w-4" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-[13.5px] font-bold text-text">등록할 수 없는 마켓이 있어요</p>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              아래 카드에서 사유를 확인하고 이전 단계로 돌아가 수정하세요.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => navigate('/register/info')}
            className="bg-danger text-white hover:bg-danger/90"
          >
            1단계로
          </Button>
        </div>
      )}

      {/* 4-state */}
      {validate.isPending && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {validate.isError && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <ErrorMessage
            message={
              validate.error instanceof RegistrationApiError
                ? formatRegistrationError(validate.error).message
                : '검증 요청에 실패했습니다.'
            }
          />
        </div>
      )}
      {validationData && validationData.previews.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface-subtle p-8 text-center text-[13px] text-text-tertiary">
          미리보기할 마켓이 없습니다.
        </div>
      )}
      {validationData && validationData.previews.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {selections.map((sel) => {
            const preview = validationData.previews.find((p) => p.marketId === sel.marketId)
            const issues = validationData.issues
              .filter((i) => i.marketId === sel.marketId)
              .map((i) => ({
                code: i.code,
                field: i.field,
                message: i.message,
                hint: i.hint,
              }))
            return (
              <MarketPreviewCard
                key={sel.marketId}
                marketId={sel.marketId as MarketId}
                estimatedFee={preview?.estimatedFee ?? null}
                issues={issues}
                hasPayload={!!preview}
                displayPrice={step1?.price ?? null}
              />
            )
          })}
        </div>
      )}

      {/* Action bar */}
      <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-3 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate('/register/markets')}
          className="border border-border"
        >
          ← 마켓 · 카테고리
        </Button>
        <div className="flex-1 text-[12.5px] text-text-tertiary">
          {blockingReasons.length > 0
            ? blockingReasons[0]
            : `검증 통과 · ${selections.length}개 마켓에 동시 등록 가능`}
        </div>
        {blockingReasons.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="primary" disabled aria-disabled>
                  일괄 등록 실행
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
          <Button variant="primary" onClick={handleStart}>
            일괄 등록 실행 ({selections.length}개 마켓)
          </Button>
        )}
      </div>
    </>
  )
}

function PreviewStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-[11.5px] font-semibold text-text-tertiary">{label}</dt>
      <dd className="mt-0.5 font-mono text-[14px] font-semibold text-text">{value}</dd>
    </div>
  )
}

// validation issue code 중 등록 차단성인 것만. token_expired / token_revoked / mapping_not_found 도 차단.
function isErrorCode(code: string): boolean {
  const blockers = [
    'product_name_invalid',
    'product_price_invalid',
    'category_missing',
    'category_not_leaf',
    'brand_required',
    'manufacturer_required',
    'shipping_method_unsupported',
    'image_main_missing',
    'description_required',
    'market_options_missing',
    'token_expired',
    'token_revoked',
    'mapping_not_found',
  ]
  return blockers.includes(code)
}

export default StepPreviewPage
