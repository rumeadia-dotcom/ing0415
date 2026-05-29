import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckCircle2, AlertCircle, Truck, PackageCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorMessage,
  Skeleton,
  Switch,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'
import { SettingsNav } from '../../components/SettingsNav'
import { useLogenCredentialsStatus } from '../hooks/useLogenCredentialsStatus'
import {
  useAutoDispatchSetting,
  useAutoDispatchToggle,
} from '../hooks/useAutoDispatchToggle'
import { useEsmShippingProfiles } from '../hooks/useEsmShippingProfiles'
import type { LogenCredentialsStatus } from '@/lib/schemas/logen'

/**
 * SettingsShippingPage — n58 (/settings/shipping).
 *
 * 마스터: docs/spec/user_flow.md s9 n58
 *         docs/spec/PRD.md §6.4 / §8
 *
 * 책임:
 *  - 로젠 API 연동 상태 카드 (연결됨 / 미연결 + 발송인 정보 완성도)
 *  - "출력 후 자동 제출" 토글 (셀러 설정 저장)
 *  - 기본 택배사 = 로젠 (고정 v2)
 *  - [로젠 API 설정] / [발송인 정보] 진입점
 *
 * 4상태:
 *  - loading: 스켈레톤 카드
 *  - error: ErrorMessage
 *  - data: 카드 4종 (logen status + sender + auto dispatch + carrier)
 *  - empty: hasCredentials === false 분기 (안내 + CTA)
 */
export function SettingsShippingPage(): JSX.Element {
  const status = useLogenCredentialsStatus()
  const autoDispatch = useAutoDispatchSetting()
  const toggleMut = useAutoDispatchToggle()
  const esmProfiles = useEsmShippingProfiles()

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <PageHeader
        title={ko.settings.shipping.title}
        subtitle={ko.settings.shipping.subtitle}
      />

      <div
        className={cn(
          'grid grid-cols-1 gap-6',
          'md:grid-cols-[220px_minmax(0,1fr)] md:gap-8',
        )}
      >
        <aside>
          <SettingsNav active="shipping" />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {status.isPending && <ShippingPageSkeleton />}

          {status.isError && (
            <ErrorMessage
              message={ko.settings.shipping.errors.internal}
              {...(status.error instanceof Error
                ? { details: status.error.message }
                : {})}
            />
          )}

          {status.isSuccess && (
            <>
              <LogenConnectionCard status={status.data} />
              <SenderInfoCard hasSenderInfo={status.data.hasSenderInfo} />
              <AutoDispatchCard
                value={autoDispatch.data?.autoDispatchAfterPrint ?? false}
                loading={autoDispatch.isPending || toggleMut.isPending}
                disabled={!status.data.hasCredentials || !status.data.hasSenderInfo}
                blockingReasons={[
                  ...(status.data.hasCredentials
                    ? []
                    : [ko.settings.shipping.errors.invalid_credentials]),
                  ...(status.data.hasSenderInfo
                    ? []
                    : [ko.settings.shipping.senderCard.notConfiguredDescription]),
                ]}
                onChange={(next) =>
                  toggleMut.mutate(next, {
                    onError: () => {
                      toast.error(ko.settings.shipping.autoDispatchCard.updateError)
                    },
                  })
                }
              />
              <CarrierCard />
              <EsmProfilesCard
                count={esmProfiles.data?.length ?? null}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 카드 — 로젠 API 연동 상태
// ─────────────────────────────────────────────

function LogenConnectionCard({
  status,
}: {
  status: LogenCredentialsStatus
}): JSX.Element {
  const t = ko.settings.shipping.logenCard
  const connected = status.hasCredentials

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {t.title}
            <Badge
              variant={connected ? 'success' : 'default'}
              aria-label={connected ? t.connected : t.disconnected}
            >
              {connected ? (
                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
              ) : (
                <AlertCircle className="mr-1 h-3 w-3" aria-hidden="true" />
              )}
              {connected ? t.connected : t.disconnected}
            </Badge>
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/shipping/logen">{t.manageButton}</Link>
          </Button>
        </div>
        <CardDescription>
          {connected ? t.connectedDescription : t.disconnectedDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-text-secondary">
        <dl className="grid grid-cols-1 gap-1 sm:grid-cols-[140px_1fr]">
          <dt>{t.lastVerifiedAt}</dt>
          <dd className="text-text">
            {status.lastVerifiedAt ? (
              <time dateTime={status.lastVerifiedAt}>
                {formatKstDateTime(status.lastVerifiedAt)}
              </time>
            ) : (
              <span className="text-text-tertiary">{t.notVerified}</span>
            )}
          </dd>
          {status.lastErrorAt && (
            <>
              <dt>{t.lastErrorAt}</dt>
              <dd className="text-danger-on-soft">
                <time dateTime={status.lastErrorAt}>
                  {formatKstDateTime(status.lastErrorAt)}
                </time>
                {status.lastErrorCode && (
                  <> ({status.lastErrorCode})</>
                )}
              </dd>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 카드 — 발송인 정보
// ─────────────────────────────────────────────

function SenderInfoCard({ hasSenderInfo }: { hasSenderInfo: boolean }): JSX.Element {
  const t = ko.settings.shipping.senderCard
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {t.title}
            <Badge
              variant={hasSenderInfo ? 'success' : 'warning'}
              aria-label={hasSenderInfo ? t.configured : t.notConfigured}
            >
              {hasSenderInfo ? t.configured : t.notConfigured}
            </Badge>
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/shipping/sender">{t.manageButton}</Link>
          </Button>
        </div>
        <CardDescription>
          {hasSenderInfo ? t.configuredDescription : t.notConfiguredDescription}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 카드 — 출력 후 자동 제출 토글
// ─────────────────────────────────────────────

function AutoDispatchCard({
  value,
  loading,
  disabled,
  blockingReasons,
  onChange,
}: {
  value: boolean
  loading: boolean
  disabled: boolean
  blockingReasons: string[]
  onChange: (next: boolean) => void
}): JSX.Element {
  const t = ko.settings.shipping.autoDispatchCard
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Switch
            checked={value}
            onCheckedChange={onChange}
            disabled={disabled || loading}
            aria-label={t.toggleAriaLabel}
            {...(disabled && blockingReasons.length > 0
              ? { title: blockingReasons.join(' · ') }
              : {})}
          />
        </div>
        {disabled && blockingReasons.length > 0 && (
          <ul role="alert" className="mt-2 space-y-0.5 text-xs text-text-tertiary">
            {blockingReasons.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        )}
      </CardHeader>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 카드 — 기본 택배사
// ─────────────────────────────────────────────

function CarrierCard(): JSX.Element {
  const t = ko.settings.shipping.carrierCard
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-4 w-4" aria-hidden="true" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary">{t.carrier}</Badge>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 카드 — G마켓·옥션 배송 프로필 진입점
// ─────────────────────────────────────────────

function EsmProfilesCard({ count }: { count: number | null }): JSX.Element {
  const t = ko.settings.shipping.esmProfilesCard
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            {t.title}
            {count !== null && count > 0 && (
              <Badge variant="secondary">
                {t.count.replace('{count}', String(count))}
              </Badge>
            )}
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/shipping/esm-profiles">{t.manageButton}</Link>
          </Button>
        </div>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function ShippingPageSkeleton(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="배송 설정을 불러오는 중"
      className="space-y-4"
    >
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

// ─────────────────────────────────────────────
// utils
// ─────────────────────────────────────────────

function formatKstDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Seoul',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default SettingsShippingPage
