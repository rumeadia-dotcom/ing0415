import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'
import { useDocumentTitle } from '@/lib/use-document-title'

/**
 * LegalLayout — 약관 / 개인정보처리방침 / 매뉴얼 공통 레이아웃.
 *
 * 마스터: docs/architecture/v1/features/legal.md
 *        docs/design-renewal/s9-settings.md §부록(법적/도움말)
 *        docs/design-renewal/designFile/concepts/studio-domains.jsx (Studio prose 룩)
 *
 * 구조:
 *  - skip-link (키보드 첫 Tab 진입 시 본문으로 점프, WCAG 2.4.1 Bypass Blocks)
 *  - 페이지 헤더 (타이틀 + 부제 + 메타 정보)
 *  - 좌측 사이드 TOC (lg+) + 우측 본문 prose 카드 (max 760px)
 *  - 모바일(<lg): TOC 가 본문 위 `<details>` 로 접힘 → 점프 가능, 콘텐츠 우선
 *
 * 접근성:
 *  - 본문은 `<main id="legal-main">` 으로 wrap → skip-link target.
 *  - TOC 항목은 `<a href="#section-id">` 앵커. 키보드 포커스 시 ring 표시. 터치 타겟 ≥44px.
 *  - 섹션 본문은 `<section id>` + `<h2>` 로 의미 구조 명시.
 */

export interface LegalSection {
  id: string
  title: string
  body: string
}

export interface LegalLayoutProps {
  title: string
  subtitle: string
  sections: readonly LegalSection[]
  /** 우측 본문 상단에 추가로 표시할 메타 (시행일·개정일·초안 안내 등) */
  meta?: ReactNode
}

export function LegalLayout({
  title,
  subtitle,
  sections,
  meta,
}: LegalLayoutProps): JSX.Element {
  useDocumentTitle(title)
  const mainRef = useRef<HTMLElement>(null)

  // 해시 진입(예: /legal/terms#purpose) 시 해당 섹션으로 스크롤 + 포커스
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const target = document.getElementById(hash)
    if (target) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' })
      // 헤더가 포커스 가능하도록 tabindex=-1 설정 후 focus
      target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-8 md:px-8">
      <a
        href="#legal-main"
        className={cn(
          'sr-only focus:not-sr-only',
          'focus:absolute focus:left-4 focus:top-4 focus:z-50',
          'focus:rounded-md focus:bg-surface focus:px-3 focus:py-2',
          'focus:text-sm focus:font-semibold focus:text-accent',
          'focus:shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-surface',
        )}
      >
        {ko.legal.common.skipToContent}
      </a>

      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-h1-mobile md:text-h1 text-text">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary md:text-base">
          {subtitle}
        </p>
        {meta ? <div className="mt-4">{meta}</div> : null}
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* 데스크탑 TOC: lg+ sticky rail */}
        <aside
          aria-label={ko.legal.common.tocHeading}
          className="hidden lg:block"
        >
          <TocList sections={sections} />
        </aside>

        {/* 모바일 TOC: <details> 접힘 (기본 닫힘 — 콘텐츠 우선) */}
        <details
          className={cn(
            'rounded-lg border border-border bg-surface lg:hidden',
            'group',
          )}
        >
          <summary
            className={cn(
              'flex min-h-[44px] cursor-pointer list-none items-center justify-between',
              'rounded-lg px-4 py-3 text-sm font-semibold text-text',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            )}
          >
            <span>{ko.legal.common.tocMobileToggle}</span>
            <span
              aria-hidden="true"
              className="text-text-tertiary transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <div className="border-t border-border p-3">
            <TocList sections={sections} />
          </div>
        </details>

        <main
          id="legal-main"
          ref={mainRef}
          className={cn(
            'min-w-0',
            // Studio prose 카드 (max-width 760)
            'mx-auto w-full max-w-[760px]',
            'rounded-lg border border-border bg-surface',
            'p-5 md:p-8',
            'space-y-8 md:space-y-10',
          )}
          tabIndex={-1}
        >
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-heading`}
              className="scroll-mt-24"
            >
              <h2
                id={`${section.id}-heading`}
                className="mb-3 text-h2 text-text"
              >
                {section.title}
              </h2>
              <div
                className={cn(
                  'whitespace-pre-line text-sm leading-7 text-text-secondary',
                  'md:text-base md:leading-8',
                )}
              >
                {section.body}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// TOC 리스트 — 데스크탑/모바일 공용
// ─────────────────────────────────────────────

function TocList({
  sections,
}: {
  sections: readonly LegalSection[]
}): JSX.Element {
  return (
    <nav
      aria-label={ko.legal.common.tocHeading}
      className={cn(
        'rounded-lg lg:border lg:border-border lg:bg-surface lg:p-4',
        'lg:sticky lg:top-20',
      )}
    >
      <h2
        className={cn(
          'mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary',
          // 모바일 details 안에서는 summary 가 트리거 역할이지만,
          // 의미 구조와 회귀(스크린리더 / 단위 테스트 heading count) 유지를 위해 헤딩 자체는 노출.
        )}
      >
        {ko.legal.common.tocHeading}
      </h2>
      <ol className="space-y-1">
        {sections.map((section, idx) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={cn(
                'flex min-h-[44px] items-start gap-2 rounded px-2 py-2 text-sm leading-snug',
                'text-text-secondary transition-colors hover:bg-surface-muted hover:text-text',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              )}
            >
              <span className="shrink-0 text-text-tertiary">{idx + 1}.</span>
              <span className="min-w-0">{section.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
