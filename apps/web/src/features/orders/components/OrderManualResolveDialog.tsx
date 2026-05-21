import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorMessage,
  Input,
  Label,
} from '@/components/ui'
import {
  ManualResolveWaybillSchema,
  type ManualResolveWaybillInput,
  type OrderDetail,
} from '@/lib/schemas/orders'
import { ko } from '@/locales/ko'
import { useManualResolveWaybill } from '../hooks/useManualResolveWaybill'

interface OrderManualResolveDialogProps {
  order: OrderDetail['order']
}

/**
 * n50 — 운송장 수동 입력 다이얼로그.
 * 정책:
 *  - `logen_failed` 상태에서만 활성.
 *  - 그 외 상태에서는 trigger 가 disabled + 사유 tooltip 노출 (CLAUDE.md "실행류 버튼 비활성 사유 표시").
 *  - 폼: ManualResolveWaybillSchema (zod). RHF resolver 로 클라이언트 검증.
 *  - 성공: toast + 다이얼로그 닫힘. 실패: ErrorMessage.
 */
export function OrderManualResolveDialog({
  order,
}: OrderManualResolveDialogProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const mutate = useManualResolveWaybill()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const canTrigger = order.shippingStatus === 'logen_failed'
  const blockingReason = canTrigger ? null : ko.orders.manualResolve.onlyForFailed

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManualResolveWaybillInput>({
    resolver: zodResolver(ManualResolveWaybillSchema),
    defaultValues: { orderId: order.id, waybillNumber: '', note: '' },
    mode: 'onSubmit',
  })

  useEffect(() => {
    if (open) {
      reset({ orderId: order.id, waybillNumber: '', note: '' })
      setSubmitError(null)
    }
  }, [open, order.id, reset])

  async function onSubmit(values: ManualResolveWaybillInput): Promise<void> {
    setSubmitError(null)
    try {
      await mutate.mutateAsync({
        orderId: values.orderId,
        waybillNumber: values.waybillNumber,
        ...(values.note ? { note: values.note } : {}),
      })
      toast.success(ko.orders.manualResolve.success)
      setOpen(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : ko.orders.manualResolve.errorGeneric
      setSubmitError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!canTrigger}
        aria-disabled={!canTrigger}
        title={blockingReason ?? undefined}
        data-testid="order-manual-resolve-trigger"
      >
        {ko.orders.detail.manualResolveCta}
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ko.orders.manualResolve.title}</DialogTitle>
          <DialogDescription>{ko.orders.manualResolve.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <input type="hidden" {...register('orderId')} />
          <div className="grid gap-1.5">
            <Label htmlFor="manual-waybill">
              {ko.orders.manualResolve.waybillLabel}
            </Label>
            <Input
              id="manual-waybill"
              autoComplete="off"
              placeholder={ko.orders.manualResolve.waybillPlaceholder}
              aria-invalid={errors.waybillNumber ? true : undefined}
              {...register('waybillNumber')}
            />
            {errors.waybillNumber ? (
              <p className="text-xs text-danger" role="alert">
                {errors.waybillNumber.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="manual-note">{ko.orders.manualResolve.noteLabel}</Label>
            <Input
              id="manual-note"
              placeholder={ko.orders.manualResolve.notePlaceholder}
              {...register('note')}
            />
          </div>

          {submitError ? (
            <ErrorMessage message={ko.orders.manualResolve.errorGeneric} details={submitError} />
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              {ko.orders.manualResolve.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting
                ? ko.orders.manualResolve.submitting
                : ko.orders.manualResolve.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
