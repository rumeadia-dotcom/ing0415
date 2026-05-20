import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PrivacyPage } from '../pages/PrivacyPage'
import { ko } from '@/locales/ko'

/**
 * PrivacyPage 단위 테스트 — D-C 개인정보처리방침.
 * 검증:
 *  - 타이틀 / 부제 노출
 *  - 10조 본문 섹션 모두 렌더
 *  - Supabase / Sentry 위탁 사실 명시 (안전성 확보 조치 § 인용)
 */

function renderPage(): void {
  render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  )
}

describe('PrivacyPage', () => {
  it('타이틀과 부제 노출', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: ko.legal.privacy.title }),
    ).toBeInTheDocument()
    expect(screen.getByText(ko.legal.privacy.subtitle)).toBeInTheDocument()
  })

  it('10조 본문 섹션 모두 렌더', () => {
    renderPage()
    const sectionTitles = [
      ko.legal.privacy.sections.items.title,
      ko.legal.privacy.sections.method.title,
      ko.legal.privacy.sections.purpose.title,
      ko.legal.privacy.sections.retention.title,
      ko.legal.privacy.sections.thirdParty.title,
      ko.legal.privacy.sections.delegation.title,
      ko.legal.privacy.sections.destruction.title,
      ko.legal.privacy.sections.rights.title,
      ko.legal.privacy.sections.safety.title,
      ko.legal.privacy.sections.officer.title,
    ]
    for (const title of sectionTitles) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
  })

  it('Supabase / Sentry 위탁 사실이 본문에 명시', () => {
    renderPage()
    // 위탁 처리 조항 본문 본문에 두 처리자 모두 명시되어야 함
    const delegationSection = document.getElementById('delegation')
    expect(delegationSection).not.toBeNull()
    const text = delegationSection?.textContent ?? ''
    expect(text).toContain('Supabase')
    expect(text).toContain('Sentry')
  })
})
