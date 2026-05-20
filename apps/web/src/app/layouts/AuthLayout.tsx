import { Outlet } from 'react-router-dom'
import { Wordmark } from '@/components/brand'

/**
 * AuthLayout — 사이드바 없는 인증 화면용 셸.
 * /login /signup /forgot-password /reset-password 4개 라우트 공통.
 *
 * - 좌우 가운데 정렬 + 상단 브랜드(마크 + 워드마크) + 카드 컨테이너
 * - 반응형: 모바일 16px 좌우 패딩, 데스크탑은 max-width 420 중앙
 * - 테마 토글은 추후 우상단 fixed 로 추가 (Stage D)
 */
export function AuthLayout(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle">
      <header className="flex items-center justify-center px-4 pt-10 pb-6">
        <Wordmark size="lg" tone="two-tone" withMark />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-10">
        <div className="w-full max-w-[420px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
