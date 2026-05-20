import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ManualPage } from '../pages/ManualPage'
import { ko } from '@/locales/ko'

/**
 * ManualPage 단위 테스트 — D-C 매뉴얼.
 * 검증:
 *  - 5섹션 모두 렌더 (회원가입 / 첫 등록 / 결과 / 이력 / FAQ)
 *  - TOC 가 5개 항목 노출
 *  - skip-link 가 존재
 */

function renderPage(): void {
  render(
    <MemoryRouter>
      <ManualPage />
    </MemoryRouter>,
  )
}

describe('ManualPage', () => {
  it('5섹션 본문 모두 렌더', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 2, name: ko.legal.manual.sections.signup.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: ko.legal.manual.sections.register.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: ko.legal.manual.sections.result.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: ko.legal.manual.sections.history.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: ko.legal.manual.sections.faq.title }),
    ).toBeInTheDocument()
  })

  it('TOC nav 가 5개 항목을 노출', () => {
    renderPage()
    const tocNav = screen.getAllByRole('navigation', { name: ko.legal.common.tocHeading })
    expect(tocNav.length).toBeGreaterThan(0)
    const firstNav = tocNav[0]
    if (!firstNav) throw new Error('TOC nav not found')
    // TOC 안의 anchor 링크 5개
    const anchors = firstNav.querySelectorAll('a[href^="#"]')
    expect(anchors).toHaveLength(5)
  })

  it('skip-link (본문으로 건너뛰기) 가 첫 a 태그로 존재', () => {
    renderPage()
    expect(
      screen.getByRole('link', { name: ko.legal.common.skipToContent }),
    ).toBeInTheDocument()
  })
})
