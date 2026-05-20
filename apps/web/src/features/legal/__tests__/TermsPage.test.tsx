import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TermsPage } from '../pages/TermsPage'
import { ko } from '@/locales/ko'

/**
 * TermsPage 단위 테스트 — D-C 약관 페이지.
 * 검증:
 *  - 페이지 타이틀이 ko.legal.terms.title 로 렌더
 *  - 12조 모두가 본문 섹션으로 노출
 *  - 초안 안내 (draftNotice) 가 노출 — 법률 검토 전임을 사용자에게 명시
 */

function renderPage(): void {
  render(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>,
  )
}

describe('TermsPage', () => {
  it('페이지 타이틀이 ko.legal.terms.title 로 렌더', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: ko.legal.terms.title }),
    ).toBeInTheDocument()
  })

  it('12조 본문 섹션 모두가 h2 로 렌더', () => {
    renderPage()
    const headings = screen.getAllByRole('heading', { level: 2 })
    // TOC 의 "목차" 헤딩 1개 + 12조 헤딩 12개 = 13개
    expect(headings.length).toBeGreaterThanOrEqual(13)

    // 대표적인 조항이 본문에 모두 포함되는지 sample 검증
    expect(
      screen.getByRole('heading', { level: 2, name: ko.legal.terms.sections.purpose.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: ko.legal.terms.sections.disclaimer.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: ko.legal.terms.sections.addendum.title }),
    ).toBeInTheDocument()
  })

  it('초안 안내 (draftNotice) 가 사용자에게 명시됨', () => {
    renderPage()
    expect(screen.getByText(ko.legal.common.draftNotice)).toBeInTheDocument()
  })
})
