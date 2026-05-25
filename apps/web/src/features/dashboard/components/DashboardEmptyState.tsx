import { Link } from 'react-router-dom'
import { PackagePlus } from 'lucide-react'
import { Button } from '@/components/ui'

type Variant = 'no-markets' | 'no-activity'

interface DashboardEmptyStateProps {
  /**
   * - `no-markets`: 연결 마켓 0건 — 최우선 hero (2-step onboarding)
   * - `no-activity`: 마켓 ≥1 + 주문·잡 0건 — 첫 등록 유도
   *
   * 마스터: docs/design-renewal/s2-dashboard.md §6.2
   * 디자인: docs/design-renewal/designFile/concepts/studio-empty.jsx · StudioDashboardEmpty
   */
  variant: Variant
}

/**
 * 대시보드 빈 상태 hero. variant 별로 메시지 / CTA 분기.
 * Studio gradient + decorative blobs + 2-step onboarding checklist.
 */
export function DashboardEmptyState({ variant }: DashboardEmptyStateProps): JSX.Element {
  if (variant === 'no-markets') {
    return (
      <section
        aria-labelledby="dashboard-empty-hero-title"
        className="relative overflow-hidden rounded-[18px] border border-border-strong bg-gradient-to-br from-white via-white to-accent-soft px-7 py-10 md:px-10 md:py-12"
      >
        <span
          aria-hidden
          className="absolute -right-10 -top-10 h-[200px] w-[200px] rounded-full bg-accent opacity-[0.12]"
        />
        <span
          aria-hidden
          className="absolute -bottom-7 right-16 h-[100px] w-[100px] rounded-full bg-ink opacity-[0.04]"
        />

        <div className="relative max-w-[640px]">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-accent">
            처음이시군요
          </p>
          <h2
            id="dashboard-empty-hero-title"
            className="mt-2.5 text-[30px] font-bold leading-[1.15] tracking-[-0.025em] text-ink"
          >
            첫 상품을 등록하면
            <br />
            여기에 활동이 보여요
          </h2>
          <p className="mt-3 text-[14px] leading-[1.55] text-dim">
            마켓 4곳에 한 번에 등록하고, 주문이 들어오면 자동으로 배송까지 처리해요.
            두 단계만 거치면 시작할 수 있어요.
          </p>

          {/* 2-step checklist */}
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-[12px] border border-border-strong bg-white p-[18px]">
              <div className="mb-2 flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white"
                >
                  1
                </span>
                <span className="text-[13.5px] font-bold text-ink">
                  마켓 연결
                </span>
              </div>
              <p className="mb-3 text-[12px] leading-[1.5] text-dim">
                네이버·쿠팡·G마켓·옥션 중 1개 이상의 셀러 계정을 연결하세요
              </p>
              <Button asChild className="w-full rounded-[9px]">
                <Link to="/markets">마켓 연결하기 →</Link>
              </Button>
            </div>
            <div className="rounded-[12px] border border-dashed border-border-strong bg-card-2 p-[18px] opacity-70">
              <div className="mb-2 flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-dashed border-border-strong bg-white text-[12px] font-bold text-faint"
                >
                  2
                </span>
                <span className="text-[13.5px] font-bold text-dim">
                  상품 등록
                </span>
              </div>
              <p className="mb-3 text-[12px] leading-[1.5] text-faint">
                5단계 위저드로 한 상품을 모든 마켓에 동시 등록
              </p>
              <Button
                variant="outline"
                disabled
                className="w-full rounded-[9px]"
                title="마켓 연결 후 가능"
                aria-label="마켓 연결 후 가능"
              >
                마켓 연결 후 가능
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // no-activity — 마켓은 있지만 잡 0건. 컴팩트 한 hero.
  return (
    <section
      aria-labelledby="dashboard-empty-activity-title"
      className="rounded-[18px] border border-border bg-white px-7 py-10 text-center md:py-14"
    >
      <div
        aria-hidden
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-onlight"
      >
        <PackagePlus className="h-6 w-6" />
      </div>
      <h2
        id="dashboard-empty-activity-title"
        className="text-[22px] font-bold tracking-[-0.02em] text-ink"
      >
        첫 상품을 등록해 보세요
      </h2>
      <p className="mt-2 text-[13.5px] text-dim">
        한 번 입력하면 여러 마켓에 동시에 올릴 수 있어요.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <Button asChild size="lg" className="rounded-[10px]">
          <Link to="/register">
            <PackagePlus className="mr-2 h-4 w-4" aria-hidden />
            상품 등록 시작
          </Link>
        </Button>
        <Link
          to="/markets"
          className="text-[12.5px] font-semibold text-accent hover:underline"
        >
          마켓 추가하기 →
        </Link>
      </div>
    </section>
  )
}
