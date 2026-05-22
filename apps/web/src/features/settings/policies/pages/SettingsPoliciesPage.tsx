import { useEffect, useState } from 'react'
import { useForm, type Resolver, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorMessage,
  Input,
  Label,
  Skeleton,
  Switch,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'
import {
  ShippingPolicyFormSchema,
  type ShippingPolicyForm,
  type ShippingPolicyMethod,
} from '@/lib/schemas/shipping-policy'
import { SettingsNav } from '../../components/SettingsNav'
import {
  useCreateShippingPolicy,
  useDeleteShippingPolicy,
  useShippingPolicies,
  useUpdateShippingPolicy,
  type ShippingPolicy,
} from '@/features/registration/hooks/useShippingPolicies'

/**
 * SettingsPoliciesPage — /settings/policies.
 *
 * 마스터:
 *  - docs/architecture/v1/features/registration.md §3.2 shipping_policies
 *  - PRD §1.1.4 기본 배송 정보 입력
 *  - user_flow.md s9 (settings 도메인 — v1 정규 항목으로 편입)
 *
 * 책임:
 *  - 셀러 배송 정책 목록 + 신규/수정/삭제 + 기본값 토글
 *  - StepInfoPage 가 "배송 정책 관리에서 1건 이상 추가하세요" 안내 시 진입점
 *
 * 4상태:
 *  - loading: Skeleton 카드
 *  - error: ErrorMessage
 *  - empty: 빈 상태 안내 + [새 정책 추가] CTA
 *  - data: 정책 row 리스트 + 헤더 [새 정책 추가]
 *
 * 기본값(isDefault) 규약:
 *  - 한 셀러당 1개. true 로 지정하면 다른 row 들은 자동으로 false 가 된다 (hook 에서 처리).
 *  - 기본값 row 삭제 시 추가 경고 + 진행 허용 (등록 화면이 빈 상태를 별도 처리).
 */
export function SettingsPoliciesPage(): JSX.Element {
  const t = ko.settings.policies
  const list = useShippingPolicies()
  const createMut = useCreateShippingPolicy()
  const updateMut = useUpdateShippingPolicy()
  const deleteMut = useDeleteShippingPolicy()

  const [dialogState, setDialogState] = useState<DialogState>({ kind: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<ShippingPolicy | null>(null)

  const openCreate = (): void => setDialogState({ kind: 'create' })
  const openEdit = (policy: ShippingPolicy): void =>
    setDialogState({ kind: 'edit', policy })
  const closeDialog = (): void => setDialogState({ kind: 'closed' })

  const handleSetDefault = (policy: ShippingPolicy): void => {
    if (policy.isDefault) return
    updateMut.mutate(
      {
        id: policy.id,
        name: policy.name,
        fee: policy.fee,
        method: policy.method,
        etaDays: policy.etaDays,
        isDefault: true,
      },
      {
        onSuccess: () => toast.success(t.toast.setDefaultSuccess),
        onError: () => toast.error(t.toast.setDefaultError),
      },
    )
  }

  const handleDeleteConfirm = (): void => {
    if (!deleteTarget) return
    deleteMut.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast.success(t.toast.deleteSuccess)
          setDeleteTarget(null)
        },
        onError: () => toast.error(t.toast.deleteError),
      },
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <div
        className={cn(
          'grid grid-cols-1 gap-6',
          'md:grid-cols-[220px_minmax(0,1fr)] md:gap-8',
        )}
      >
        <aside>
          <SettingsNav active="policies" />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-4 w-4" aria-hidden="true" />
                    {t.listTitle}
                  </CardTitle>
                  <CardDescription>{t.listDescription}</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={openCreate}
                >
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t.addCta}
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {list.isPending && <PoliciesSkeleton />}

              {list.isError && (
                <ErrorMessage
                  message={t.errors.fetch}
                  {...(list.error instanceof Error
                    ? { details: list.error.message }
                    : {})}
                />
              )}

              {list.isSuccess && list.data.length === 0 && (
                <EmptyState onAdd={openCreate} />
              )}

              {list.isSuccess && list.data.length > 0 && (
                <PoliciesList
                  policies={list.data}
                  onEdit={openEdit}
                  onDelete={(p) => setDeleteTarget(p)}
                  onSetDefault={handleSetDefault}
                  setDefaultPending={updateMut.isPending}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 신규/수정 다이얼로그 */}
      <PolicyFormDialog
        state={dialogState}
        onClose={closeDialog}
        submitting={createMut.isPending || updateMut.isPending}
        onSubmitCreate={(values) =>
          createMut.mutate(values, {
            onSuccess: () => {
              toast.success(t.toast.createSuccess)
              closeDialog()
            },
            onError: () => toast.error(t.toast.createError),
          })
        }
        onSubmitEdit={(id, values) =>
          updateMut.mutate(
            { id, ...values },
            {
              onSuccess: () => {
                toast.success(t.toast.updateSuccess)
                closeDialog()
              },
              onError: () => toast.error(t.toast.updateError),
            },
          )
        }
      />

      {/* 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        target={deleteTarget}
        deleting={deleteMut.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// 빈 상태
// ─────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  const t = ko.settings.policies
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-subtle',
        'px-6 py-10 text-center',
      )}
    >
      <div className="rounded-full bg-card-2 p-3" aria-hidden="true">
        <Truck className="h-6 w-6 text-text-tertiary" />
      </div>
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-text">{t.empty.title}</h3>
        <p className="text-[13px] text-text-tertiary">{t.empty.body}</p>
      </div>
      <Button type="button" variant="primary" size="sm" onClick={onAdd}>
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
        {t.addCta}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────
// 목록
// ─────────────────────────────────────────────

interface PoliciesListProps {
  policies: ShippingPolicy[]
  onEdit: (p: ShippingPolicy) => void
  onDelete: (p: ShippingPolicy) => void
  onSetDefault: (p: ShippingPolicy) => void
  setDefaultPending: boolean
}

function PoliciesList({
  policies,
  onEdit,
  onDelete,
  onSetDefault,
  setDefaultPending,
}: PoliciesListProps): JSX.Element {
  const t = ko.settings.policies
  return (
    <ul className="flex flex-col gap-2" data-testid="policies-list">
      {policies.map((p) => (
        <li
          key={p.id}
          className={cn(
            'flex flex-col gap-3 rounded-lg border border-border bg-surface p-4',
            'md:flex-row md:items-center md:justify-between',
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[14px] font-semibold text-text">{p.name}</h4>
              {p.isDefault && (
                <Badge variant="accent">{t.badge.isDefault}</Badge>
              )}
              <Badge variant="default">{t.methodLabels[p.method]}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] text-text-tertiary sm:grid-cols-3">
              <div className="flex gap-1.5">
                <dt>{t.columns.fee}</dt>
                <dd className="font-medium text-text">{formatFee(p.fee)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>{t.columns.etaDays}</dt>
                <dd className="font-medium text-text">
                  {p.etaDays}
                  {t.etaUnit}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt id={`default-label-${p.id}`}>{t.columns.isDefault}</dt>
                <dd>
                  <Switch
                    checked={p.isDefault}
                    onCheckedChange={() => onSetDefault(p)}
                    disabled={setDefaultPending || p.isDefault}
                    aria-labelledby={`default-label-${p.id}`}
                    {...(p.isDefault
                      ? {}
                      : { title: t.actions.setDefault })}
                  />
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(p)}
              aria-label={`${p.name} ${t.actions.edit}`}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {t.actions.edit}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => onDelete(p)}
              aria-label={`${p.name} ${t.actions.delete}`}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {t.actions.delete}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function formatFee(fee: number): string {
  const t = ko.settings.policies.fee
  if (fee === 0) return t.free
  return `${fee.toLocaleString()}${t.unit}`
}

// ─────────────────────────────────────────────
// 폼 다이얼로그 (신규/수정 공용)
// ─────────────────────────────────────────────

type DialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; policy: ShippingPolicy }

interface PolicyFormDialogProps {
  state: DialogState
  onClose: () => void
  submitting: boolean
  onSubmitCreate: (values: ShippingPolicyForm) => void
  onSubmitEdit: (id: string, values: ShippingPolicyForm) => void
}

const METHOD_VALUES: ShippingPolicyMethod[] = [
  'parcel',
  'direct',
  'quick',
  'visit_pickup',
]

function defaultsFor(state: DialogState): ShippingPolicyForm {
  if (state.kind === 'edit') {
    return {
      name: state.policy.name,
      method: state.policy.method,
      fee: state.policy.fee,
      etaDays: state.policy.etaDays,
      isDefault: state.policy.isDefault,
    }
  }
  return {
    name: '',
    method: 'parcel',
    fee: 0,
    etaDays: 2,
    isDefault: false,
  }
}

function PolicyFormDialog({
  state,
  onClose,
  submitting,
  onSubmitCreate,
  onSubmitEdit,
}: PolicyFormDialogProps): JSX.Element {
  const t = ko.settings.policies
  const open = state.kind !== 'closed'

  const form = useForm<ShippingPolicyForm>({
    resolver: zodResolver(ShippingPolicyFormSchema) as Resolver<ShippingPolicyForm>,
    mode: 'onChange',
    defaultValues: defaultsFor(state),
  })

  // 다이얼로그 열림/대상 변경 시 폼 초기화
  useEffect(() => {
    if (open) {
      form.reset(defaultsFor(state))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, state.kind === 'edit' ? state.policy.id : null])

  const onSubmit = (values: ShippingPolicyForm): void => {
    if (state.kind === 'create') {
      onSubmitCreate(values)
    } else if (state.kind === 'edit') {
      onSubmitEdit(state.policy.id, values)
    }
  }

  const title = state.kind === 'edit' ? t.dialog.editTitle : t.dialog.createTitle
  const blockingReasons: string[] = []
  if (Object.keys(form.formState.errors).length > 0) {
    blockingReasons.push(...collectFieldErrorMessages(form.formState.errors))
  }
  if (submitting) blockingReasons.push(t.dialog.submitting)
  const disabled = blockingReasons.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t.dialog.description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          <FormField
            id="policy-name"
            label={t.dialog.nameLabel}
            required
            error={form.formState.errors.name?.message}
          >
            <Input
              id="policy-name"
              type="text"
              autoComplete="off"
              placeholder={t.dialog.namePlaceholder}
              {...form.register('name')}
            />
          </FormField>

          <FormField
            id="policy-method"
            label={t.dialog.methodLabel}
            required
            error={form.formState.errors.method?.message}
          >
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <div
                  role="radiogroup"
                  aria-labelledby="policy-method-label"
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                >
                  {METHOD_VALUES.map((m) => {
                    const checked = field.value === m
                    return (
                      <Button
                        key={m}
                        type="button"
                        variant={checked ? 'primary' : 'outline'}
                        size="sm"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => field.onChange(m)}
                        className="w-full"
                      >
                        {t.methodLabels[m]}
                      </Button>
                    )
                  })}
                </div>
              )}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="policy-fee"
              label={t.dialog.feeLabel}
              required
              error={form.formState.errors.fee?.message}
            >
              <Input
                id="policy-fee"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder={t.dialog.feePlaceholder}
                className="font-mono"
                {...form.register('fee', { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              id="policy-eta"
              label={t.dialog.etaDaysLabel}
              required
              error={form.formState.errors.etaDays?.message}
            >
              <Input
                id="policy-eta"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                step={1}
                placeholder={t.dialog.etaDaysPlaceholder}
                className="font-mono"
                {...form.register('etaDays', { valueAsNumber: true })}
              />
            </FormField>
          </div>

          <div className="rounded-lg border border-border bg-surface-subtle p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="policy-default" className="text-[13.5px]">
                  {t.dialog.isDefaultLabel}
                </Label>
                <p className="text-[12px] text-text-tertiary">
                  {t.dialog.isDefaultDescription}
                </p>
              </div>
              <Controller
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <Switch
                    id="policy-default"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label={t.dialog.isDefaultLabel}
                  />
                )}
              />
            </div>
          </div>

          {disabled && blockingReasons.length > 0 && (
            <ul
              role="alert"
              className="space-y-0.5 text-[12px] text-text-tertiary"
            >
              {blockingReasons.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={submitting}
            >
              {t.dialog.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={disabled}
              {...(disabled && blockingReasons.length > 0
                ? { title: blockingReasons.join(' · ') }
                : {})}
            >
              {submitting ? t.dialog.submitting : t.dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 삭제 확인 다이얼로그
// ─────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  target: ShippingPolicy | null
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmDialog({
  target,
  deleting,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps): JSX.Element {
  const t = ko.settings.policies.delete
  const open = target !== null
  const isDefault = target?.isDefault ?? false

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.confirmTitle}</DialogTitle>
          <DialogDescription>
            {isDefault ? t.confirmBodyDefault : t.confirmBody}
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-[13px]">
            <span className="font-semibold text-text">{target.name}</span>
            <span className="text-text-tertiary">
              {' · '}
              {ko.settings.policies.methodLabels[target.method]}
              {' · '}
              {formatFee(target.fee)}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={deleting}
          >
            {t.cancelCta}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? t.confirmingCta : t.confirmCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// Skeleton + FormField (로컬 공용)
// ─────────────────────────────────────────────

function PoliciesSkeleton(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="배송 정책을 불러오는 중"
      className="space-y-2"
    >
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  error?: string | undefined
  children: React.ReactNode
}

function FormField({
  id,
  label,
  required,
  error,
  children,
}: FormFieldProps): JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} id={`${id}-label`} className="text-[13.5px]">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// utils
// ─────────────────────────────────────────────

type FieldErrors = Record<string, { message?: string } | undefined>

function collectFieldErrorMessages(errors: FieldErrors): string[] {
  const out: string[] = []
  for (const key of Object.keys(errors)) {
    const e = errors[key]
    if (e && typeof e.message === 'string' && e.message.length > 0) {
      out.push(e.message)
    }
  }
  return out
}

export default SettingsPoliciesPage
