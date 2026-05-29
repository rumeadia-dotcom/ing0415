import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui'
import { SafeNumberBadge } from '../components/SafeNumberBadge'
import { ko } from '@/locales/ko'

function renderBadge(): void {
  render(
    <TooltipProvider delayDuration={0}>
      <SafeNumberBadge />
    </TooltipProvider>,
  )
}

describe('SafeNumberBadge', () => {
  it('배지 라벨과 aria-label 이 노출된다 (a11y trigger 식별 가능)', () => {
    renderBadge()
    const trigger = screen.getByRole('button', { name: ko.orders.detail.safeNumberAriaLabel })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent(ko.orders.detail.safeNumberBadge)
  })

  it('hover 시 안심번호 안내 툴팁 content 가 표시된다', async () => {
    const user = userEvent.setup()
    renderBadge()
    const trigger = screen.getByRole('button', { name: ko.orders.detail.safeNumberAriaLabel })
    await user.hover(trigger)

    // Radix Tooltip 은 portal 로 띄우므로 findAllByText 로 검출
    const matches = await screen.findAllByText(ko.orders.detail.safeNumberNote)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('trigger 가 키보드 focus 가능하고 type="button" 이다 (form submit 방지)', () => {
    renderBadge()
    const trigger = screen.getByRole('button', { name: ko.orders.detail.safeNumberAriaLabel })
    expect(trigger).toHaveAttribute('type', 'button')
    trigger.focus()
    expect(trigger).toHaveFocus()
  })
})
