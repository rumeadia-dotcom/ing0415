import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Footer } from '../Footer'
import { ko } from '@/locales/ko'

/**
 * Footer 단위 테스트 — D-C 약관/개인정보처리방침/매뉴얼 링크 + 저작권.
 * 검증:
 *  - 3개 링크가 올바른 라우트로 연결 (/legal/terms, /legal/privacy, /manual)
 *  - 저작권 표기가 노출 (© 2026 MarketCast)
 *  - contentinfo role 노출 (스크린리더 랜드마크)
 */

function renderFooter(): void {
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  )
}

describe('Footer', () => {
  it('3개 링크가 올바른 라우트로 연결됨', () => {
    renderFooter()
    expect(screen.getByRole('link', { name: ko.footer.terms })).toHaveAttribute(
      'href',
      '/legal/terms',
    )
    expect(screen.getByRole('link', { name: ko.footer.privacy })).toHaveAttribute(
      'href',
      '/legal/privacy',
    )
    expect(screen.getByRole('link', { name: ko.footer.manual })).toHaveAttribute(
      'href',
      '/manual',
    )
  })

  it('저작권 표기 노출', () => {
    renderFooter()
    expect(screen.getByText(ko.footer.copyright)).toBeInTheDocument()
  })

  it('contentinfo 랜드마크 + nav 라벨 노출', () => {
    renderFooter()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: ko.footer.nav })).toBeInTheDocument()
  })
})
