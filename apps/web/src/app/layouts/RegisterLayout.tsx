import { Outlet, useLocation } from 'react-router-dom'
import { REGISTER_STEPS, Stepper, type RegisterStepId } from '@/features/registration/components/Stepper'
import { PageHeader } from '@/components/layout/PageHeader'
import { useRegisterFormStore } from '@/features/registration/store/useRegisterFormStore'
import { useBeforeUnload } from '@/lib/use-before-unload'

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

  // cycle 37: store 에 입력 데이터가 있으면 reload / 탭 닫기 시 경고.
  // step1 / images / selections 중 하나라도 있으면 진행 중 — 데이터 손실 방지.
  const hasDraft = useRegisterFormStore((s) => {
    return s.step1 != null || s.images.length > 0 || s.selections.length > 0
  })
  useBeforeUnload(hasDraft)

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
