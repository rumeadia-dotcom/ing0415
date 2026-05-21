import { Outlet } from 'react-router-dom'
import { BrandLogo } from '@/components/brand'
import { Footer } from '@/components/layout/Footer'

/**
 * AuthLayout — 사이드바 없는 인증 화면용 셸.
 * /login /signup /forgot-password /reset-password 4개 라우트 공통.
 *
 * - 좌우 가운데 정렬 + 상단 브랜드 로고 (메뉴와 동일 마크 + 워드마크) + 카드 컨테이너
 * - 반응형: 모바일 16px 좌우 패딩, 데스크탑은 max-width 420 중앙
 * - 하단 Footer 상시 노출 (D-C: 약관/개인정보처리방침/매뉴얼) — 회원가입 단계에서도
 *   약관 본문에 접근할 수 있어야 동의의 의미가 성립한다.
 */
export function AuthLayout(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle">
      <header className="flex items-center justify-center px-4 pt-10 pb-6">
        <BrandLogo size="lg" withTagline />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-10">
        <div className="w-full max-w-[420px]">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}
