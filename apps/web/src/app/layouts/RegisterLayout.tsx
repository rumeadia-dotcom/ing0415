import { Outlet, useLocation } from 'react-router-dom'
import { REGISTER_STEPS, Stepper, type RegisterStepId } from '@/features/registration/components/Stepper'
import { PageHeader } from '@/components/layout/PageHeader'

/**
 * RegisterLayout — /register/* 공통 셸.
 * AppLayout 내부에 nesting 되어 5단계 위저드 헤더 + 진행 표시 + Outlet.
 *
 * 현재 step 은 pathname 의 마지막 세그먼트로 추론. 잘못된 step 이면 'info' 폴백.
 * frontend.md §2.3 — step 검증 zod enum 은 Stage D (URL 검증 정식화) 에서 도입.
 */

function deriveStepFromPath(pathname: string): RegisterStepId {
  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  const matched = REGISTER_STEPS.find((s) => s.id === last)
  return matched?.id ?? 'info'
}

export function RegisterLayout(): JSX.Element {
  const location = useLocation()
  const current = deriveStepFromPath(location.pathname)

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader
        title="상품 등록"
        subtitle="5단계로 다중 마켓에 동시 등록합니다"
      />
      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <Stepper current={current} />
      </div>
      <Outlet />
    </div>
  )
}
