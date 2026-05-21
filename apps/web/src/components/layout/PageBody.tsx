import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * PageBody — Studio shell 본문 컨텐츠 영역 wrapper.
 * 시각 레퍼런스: docs/design-renewal/designFile/concepts/studio.jsx
 *  - studioShell `<main>` 의 `{children}` 영역. PageHeader 아래에 위치.
 *  - Studio 사양상 본문 패딩 = 22 (top) · 30 (x) · 30 (bottom).
 *
 * 사용:
 *   <PageHeader title="..." />
 *   <PageBody>
 *     ...content (Cards, Tables, Forms 등)
 *   </PageBody>
 *
 * 페이지 내부 max-width 가 필요한 경우 (예: 설정 800px) 본 컴포넌트 안에서 한번 더
 * `<div className="mx-auto w-full max-w-[...]">` 로 감싼다.
 *
 * 도입 전략: 본 PR(03) 은 컴포넌트만 제공. 각 페이지의 적용 (기존 `<main>` 패딩 의존
 * 제거) 은 도메인 PR(04-10) 에서 진행.
 */
export interface PageBodyProps {
  children: ReactNode
  className?: string
}

export function PageBody({ children, className }: PageBodyProps): JSX.Element {
  return (
    <div className={cn('px-4 py-5 md:px-[30px] md:pb-[30px] md:pt-[22px]', className)}>
      {children}
    </div>
  )
}
