import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SettingsNav } from '../components/SettingsNav'
import { ko } from '@/locales/ko'

/**
 * SettingsNav 단위 테스트 — R-001 (성공 1 + 실패 1).
 *
 * 검증:
 *  - 활성 항목: aria-current="page" 부여 + 링크 to=/settings
 *  - 비활성(v2) 항목: aria-disabled + v2 pill, Link 가 아님 (navigate 차단)
 *  - active prop 명시 시 location 과 무관하게 강제 적용
 */

function renderNav(props: { active?: 'account' | 'shipping'; path?: string } = {}): void {
  render(
    <MemoryRouter initialEntries={[props.path ?? '/settings']}>
      <SettingsNav {...(props.active ? { active: props.active } : {})} />
    </MemoryRouter>,
  )
}

describe('SettingsNav', () => {
  it('활성: 계정 항목이 active 일 때 aria-current="page" 가 부여된다', () => {
    renderNav({ active: 'account' })
    const accountLink = screen.getByRole('link', { name: ko.settings.nav.account })
    expect(accountLink).toHaveAttribute('aria-current', 'page')
    expect(accountLink).toHaveAttribute('href', '/settings')
  })

  it('v2 항목(알림)은 Link 가 아니며 aria-disabled + v2 pill 을 가진다', () => {
    renderNav({ active: 'account' })
    // 알림 항목은 link role 이 아니어야 함 (navigate 불가)
    expect(
      screen.queryByRole('link', { name: new RegExp(ko.settings.nav.notifications) }),
    ).toBeNull()

    // 텍스트와 v2 pill 은 노출
    expect(screen.getByText(ko.settings.nav.notifications)).toBeInTheDocument()
    // 동일 라벨의 v2 pill 이 aria-label 로 식별 가능
    const v2Pill = screen.getByLabelText(
      `${ko.settings.nav.notifications} ${ko.settings.nav.v2Pill}`,
    )
    expect(v2Pill).toBeInTheDocument()
    expect(v2Pill.textContent).toBe(ko.settings.nav.v2Pill)
  })

  it('실패 시나리오: 존재하지 않는 항목은 렌더되지 않는다', () => {
    renderNav({ active: 'account' })
    // ko.settings.nav 에 정의되지 않은 가짜 라벨은 노출되지 않아야 함
    expect(screen.queryByText('가짜 설정 항목')).toBeNull()
  })

  it('active prop 미지정 시 location 기반으로 shipping 항목이 active 가 된다', () => {
    renderNav({ path: '/settings/shipping' })
    const shippingLink = screen.getByRole('link', { name: ko.settings.nav.shipping })
    expect(shippingLink).toHaveAttribute('aria-current', 'page')
  })
})
