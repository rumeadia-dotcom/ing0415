import { useEffect, useRef, useState } from 'react'
import { useForm, FormProvider, type Resolver, Controller } from 'react-hook-form'
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
  ShippingTemplateSchema,
  DEFAULT_SHIPPING_CONFIG,
  type ShippingTemplate as ShippingTemplateForm,
  type ShippingConfig,
} from '@/lib/schemas/shipping-config'
import { describeTiers } from '@/lib/shipping/expand-box'
import { ShippingConfigSection } from '@/features/registration/components/ShippingConfigSection'
import { SettingsNav } from '../../components/SettingsNav'
import {
  useCreateShippingPolicy,
  useDeleteShippingPolicy,
  useShippingPolicies,
  useUpdateShippingPolicy,
  type ShippingTemplate,
} from '@/features/registration/hooks/useShippingPolicies'

/**
 * SettingsPoliciesPage — /settings/policies.
 *
 * 마스터:
 *  - docs/architecture/v1/features/registration.md §3.2 shipping_policies (config 재편)
 *  - PRD §1.1.4 기본 배송 정보 입력 + 수량 구간(박스) 배송비 (C9)
 *  - user_flow.md s9 (settings 도메인 — v1 정규 항목으로 편입)
 *
 * 책임:
 *  - 셀러 배송 템플릿 목록 + 신규/수정/삭제 + 기본값 토글
 *  - 템플릿 = ShippingConfig 묶음 + 이름 + 기본여부. StepInfoPage 에서 "템플릿 적용" 으로 불러온다.
 *  - 폼은 StepInfoPage 와 동일한 ShippingConfigSection(name="config") 재사용.
 *
 * 4상태:
 *  - loading: Skeleton 카드
 *  - error: ErrorMessage
 *  - empty: 빈 상태 안내 + [새 템플릿 추가] CTA
 *  - data: 템플릿 row 리스트 + 헤더 [새 템플릿 추가]
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
  const [deleteTarget, setDeleteTarget] = useState<ShippingTemplate | null>(null)

  // cycle 38: 다이얼로그 닫힘 시 트리거 element 로 포커스 복귀 (WCAG 2.4.3).
  // discriminated state + 다중 트리거 패턴이라 DialogTrigger asChild 안 됨 → onCloseAutoFocus 콜백.
  const lastTriggerRef = useRef<HTMLElement | null>(null)
  const track = (e: { currentTarget: HTMLElement }): void => {
    lastTriggerRef.current = e.currentTarget
  }
  const restoreFocus = (e: Event): void => {
    e.preventDefault()
    requestAnimationFrame(() => lastTriggerRef.current?.focus())
  }

  const openCreate = (e: React.MouseEvent<HTMLElement>): void => {
    track(e)
    setDialogState({ kind: 'create' })
  }
  const openEdit = (template: ShippingTemplate, e: React.MouseEvent<HTMLElement>): void => {
    track(e)
    setDialogState({ kind: 'edit', template })
  }
  const openDelete = (template: ShippingTemplate, e: React.MouseEvent<HTMLElement>): void => {
    track(e)
    setDeleteTarget(template)
  }
  const closeDialog = (): void => setDialogState({ kind: 'closed' })

  const handleSetDefault = (template: ShippingTemplate): void => {
    if (template.isDefault) return
    updateMut.mutate(
      {
        id: template.id,
        name: template.name,
        config: template.config,
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
                  templates={list.data}
                  onEdit={openEdit}
                  onDelete={openDelete}
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
        onCloseAutoFocus={restoreFocus}
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
        onCloseAutoFocus={restoreFocus}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// 빈 상태
// ─────────────────────────────────────────────

function EmptyState({
  onAdd,
}: {
  onAdd: (e: React.MouseEvent<HTMLElement>) => void
}): JSX.Element {
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
// config → 사람이 읽는 요약 (목록 row / 삭제 확인 셀)
// ─────────────────────────────────────────────

const won = (n: number): string => `${n.toLocaleString()}${ko.settings.policies.fee.unit}`

/** ShippingConfig → "무료배송 · 배송 3일" 형태의 한 줄 요약. */
export function describeShippingConfig(config: ShippingConfig): string {
  const s = ko.settings.policies.summary
  const parts: string[] = [s.feeType[config.feeType]]

  switch (config.feeType) {
    case 'paid':
      parts.push(s.baseFee.replace('{fee}', won(config.baseFee)))
      break
    case 'conditional_free':
      if (config.freeThreshold != null) {
        parts.push(s.freeOver.replace('{amount}', won(config.freeThreshold)))
      }
      break
    case 'quantity_tiered':
      if (config.box) {
        parts.push(describeTiers(config.box))
      }
      break
    default:
      break
  }

  parts.push(s.etaDays.replace('{days}', String(config.etaDays)))
  return parts.join(' · ')
}

// ─────────────────────────────────────────────
// 목록
// ─────────────────────────────────────────────

interface PoliciesListProps {
  templates: ShippingTemplate[]
  onEdit: (p: ShippingTemplate, e: React.MouseEvent<HTMLElement>) => void
  onDelete: (p: ShippingTemplate, e: React.MouseEvent<HTMLElement>) => void
  onSetDefault: (p: ShippingTemplate) => void
  setDefaultPending: boolean
}

function PoliciesList({
  templates,
  onEdit,
  onDelete,
  onSetDefault,
  setDefaultPending,
}: PoliciesListProps): JSX.Element {
  const t = ko.settings.policies
  return (
    <ul className="flex flex-col gap-2" data-testid="policies-list">
      {templates.map((p) => (
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
              <Badge variant="default">{t.methodLabels[p.config.method]}</Badge>
            </div>
            <p className="text-[12.5px] text-text-tertiary">{describeShippingConfig(p.config)}</p>
            <div className="flex items-center gap-2 pt-0.5">
              <span id={`default-label-${p.id}`} className="text-[12.5px] text-text-tertiary">
                {t.columns.isDefault}
              </span>
              <Switch
                checked={p.isDefault}
                onCheckedChange={() => onSetDefault(p)}
                disabled={setDefaultPending || p.isDefault}
                aria-labelledby={`default-label-${p.id}`}
                {...(p.isDefault ? {} : { title: t.actions.setDefault })}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => onEdit(p, e)}
              aria-label={`${p.name} ${t.actions.edit}`}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {t.actions.edit}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={(e) => onDelete(p, e)}
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

// ─────────────────────────────────────────────
// 폼 다이얼로그 (신규/수정 공용)
// ─────────────────────────────────────────────

type DialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; template: ShippingTemplate }

interface PolicyFormDialogProps {
  state: DialogState
  onClose: () => void
  onCloseAutoFocus: (e: Event) => void
  submitting: boolean
  onSubmitCreate: (values: ShippingTemplateForm) => void
  onSubmitEdit: (id: string, values: ShippingTemplateForm) => void
}

function defaultsFor(state: DialogState): ShippingTemplateForm {
  if (state.kind === 'edit') {
    return {
      name: state.template.name,
      isDefault: state.template.isDefault,
      config: state.template.config,
    }
  }
  return {
    name: '',
    isDefault: false,
    config: DEFAULT_SHIPPING_CONFIG,
  }
}

function PolicyFormDialog({
  state,
  onClose,
  onCloseAutoFocus,
  submitting,
  onSubmitCreate,
  onSubmitEdit,
}: PolicyFormDialogProps): JSX.Element {
  const t = ko.settings.policies
  const open = state.kind !== 'closed'

  const form = useForm<ShippingTemplateForm>({
    resolver: zodResolver(ShippingTemplateSchema) as Resolver<ShippingTemplateForm>,
    mode: 'onChange',
    defaultValues: defaultsFor(state),
  })

  // 다이얼로그 열림/대상 변경 시 폼 초기화
  useEffect(() => {
    if (open) {
      form.reset(defaultsFor(state))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, state.kind === 'edit' ? state.template.id : null])

  const onSubmit = (values: ShippingTemplateForm): void => {
    if (state.kind === 'create') {
      onSubmitCreate(values)
    } else if (state.kind === 'edit') {
      onSubmitEdit(state.template.id, values)
    }
  }

  const title = state.kind === 'edit' ? t.dialog.editTitle : t.dialog.createTitle
  const nameError = form.formState.errors.name?.message
  const configInvalid = form.formState.errors.config != null
  const blockingReasons: string[] = []
  if (typeof nameError === 'string' && nameError.length > 0) blockingReasons.push(nameError)
  if (configInvalid) blockingReasons.push(ko.register.shipping.blockingTiered)
  if (submitting) blockingReasons.push(t.dialog.submitting)
  const disabled = blockingReasons.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t.dialog.description}</DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <FormField
              id="policy-name"
              label={t.dialog.nameLabel}
              required
              error={nameError}
            >
              <Input
                id="policy-name"
                type="text"
                autoComplete="off"
                placeholder={t.dialog.namePlaceholder}
                aria-invalid={form.formState.errors.name ? 'true' : 'false'}
                aria-describedby={form.formState.errors.name ? 'policy-name-error' : undefined}
                {...form.register('name')}
              />
            </FormField>

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

            <ShippingConfigSection name="config" />

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
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 삭제 확인 다이얼로그
// ─────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  target: ShippingTemplate | null
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
  onCloseAutoFocus: (e: Event) => void
}

function DeleteConfirmDialog({
  target,
  deleting,
  onConfirm,
  onCancel,
  onCloseAutoFocus,
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
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
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
              {describeShippingConfig(target.config)}
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
      aria-label="배송 템플릿을 불러오는 중"
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
        <p
          id={`${id}-error`}
          role="alert"
          className="text-[12px] font-medium text-danger"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export default SettingsPoliciesPage
