import { Link } from 'react-router-dom'
import { AlertTriangle, Plug } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui'
import type { MarketHealth } from '@/lib/schemas/dashboard-summary'

interface MarketHealthCardProps {
  state: 'loading' | 'data' | 'error'
  health?: MarketHealth
}

/**
 * 마켓 연결 건강 상태.
 * 마스터: docs/architecture/v1/features/dashboard.md §5
 * 디자인: docs/design-renewal/designFile/concepts/studio.jsx — "마켓 연결" 우측 카드
 *
 * - active / expired / error / total 표시
 * - expired 또는 error ≥1 시 warn 배너 + /markets 재인증 링크
 */
export function MarketHealthCard({ state, health }: MarketHealthCardProps): JSX.Element {
  return (
    <Card className="rounded-[14px] border-[oklch(0.92_0.008_75)]">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-4 py-4 pb-3">
        <CardTitle className="text-[14px] font-bold leading-none text-[oklch(0.15_0.015_60)]">
          마켓 연결 상태
        </CardTitle>
        {state === 'data' && health && health.total > 0 ? (
          <span className="text-[11.5px] text-[oklch(0.68_0.01_60)]">
            {health.active} / {health.total} 활성
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        {state === 'loading' ? (
          <div className="space-y-2" role="status" aria-label="마켓 연결 상태 불러오는 중">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : state === 'error' ? (
          <p className="text-[13px] text-[oklch(0.55_0.16_25)]" role="alert">
            마켓 연결 상태를 불러오지 못했습니다.
          </p>
        ) : !health || health.total === 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[oklch(0.94_0.04_65)] text-[oklch(0.62_0.14_55)]"
              >
                <Plug className="h-4 w-4" />
              </span>
              <p className="text-[12.5px] text-[oklch(0.48_0.012_60)]">
                아직 연결된 마켓이 없어요.
              </p>
            </div>
            <Link
              to="/markets"
              className="inline-flex w-full items-center justify-center rounded-[10px] bg-[oklch(0.15_0.015_60)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[oklch(0.22_0.015_60)]"
            >
              마켓 연결하기 →
            </Link>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[oklch(0.68_0.01_60)]">
                  정상
                </dt>
                <dd className="mt-1 text-[20px] font-bold leading-none tabular-nums text-[oklch(0.55_0.10_160)]">
                  {health.active}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[oklch(0.68_0.01_60)]">
                  만료
                </dt>
                <dd className="mt-1 text-[20px] font-bold leading-none tabular-nums text-[oklch(0.62_0.12_70)]">
                  {health.expired}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[oklch(0.68_0.01_60)]">
                  오류
                </dt>
                <dd className="mt-1 text-[20px] font-bold leading-none tabular-nums text-[oklch(0.55_0.16_25)]">
                  {health.error}
                </dd>
              </div>
            </dl>
            {health.expired + health.error > 0 ? (
              <div
                className="flex items-center gap-2 rounded-[9px] bg-[oklch(0.95_0.04_75)] px-3 py-2 text-[11.5px] text-[oklch(0.22_0.015_60)]"
                role="status"
              >
                <span
                  aria-hidden
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[oklch(0.62_0.12_70)] text-white"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                </span>
                <span className="flex-1 font-medium">
                  {health.expired > 0 && `토큰이 만료된 마켓이 ${health.expired}개 있습니다. `}
                  {health.error > 0 && `오류 상태의 마켓이 ${health.error}개 있습니다. `}
                </span>
                <Link
                  to="/markets"
                  className="shrink-0 font-bold text-[oklch(0.62_0.12_70)] hover:underline"
                >
                  마켓 페이지에서 재연결 →
                </Link>
              </div>
            ) : (
              <p className="text-[11.5px] text-[oklch(0.68_0.01_60)]">
                모든 마켓이 정상 연결됨
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
