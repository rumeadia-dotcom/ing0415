import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
 * StepPreviewPage — n20 등록 미리보기 (4/5).
 * 마스터: docs/architecture/v1/features/registration.md §10.6
 *
 * - 진입 시 1회 registration-validate invoke → 마켓별 카드 표시.
 * - error 1개 이상이면 등록 시작 disabled.
 * - warning 만이면 등록 가능 (사용자 인지 후 진행).
 * - 등록 시작 → registration-start → /register/result/<jobId> replace navigate.
 */
export function StepPreviewPage(): JSX.Element {
  const navigate = useNavigate()
  const productId = useRegisterFormStore((s) => s.productId)
  const selections = useRegisterFormStore((s) => s.selections)
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
    ? validationData.issues.length > 0 && validationData.issues.some((i) => isErrorCode(i.code)) || selections.some((s) => !validationData.previews.find((p) => p.marketId === s.marketId))
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
            toast.error(f.message, { description: f.correlationId ? `요청 ID: ${f.correlationId}` : undefined })
          } else {
            toast.error('등록을 시작할 수 없습니다.')
          }
        },
      },
    )
  }

  const blockingReasons: string[] = []
  if (validate.isPending) blockingReasons.push('마켓별 검증 중')
  if (hasErrors) blockingReasons.push('일부 마켓에 등록 불가 항목이 있습니다. 이전 단계에서 수정하세요')
  if (start.isPending) blockingReasons.push('등록 시작 중')

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>4단계 — 미리보기</CardTitle>
          <CardDescription>
            각 마켓에서 어떻게 등록될지 미리 확인하고 일괄 등록을 실행합니다. ({selections.length}개 마켓)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {validate.isPending && <Skeleton className="h-32 w-full" />}
          {validate.isError && (
            <ErrorMessage
              message={
                validate.error instanceof RegistrationApiError
                  ? formatRegistrationError(validate.error).message
                  : '검증 요청에 실패했습니다.'
              }
            />
          )}
          {validationData && (
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
                  />
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate('/register/markets')}>
          ← 이전
        </Button>
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
