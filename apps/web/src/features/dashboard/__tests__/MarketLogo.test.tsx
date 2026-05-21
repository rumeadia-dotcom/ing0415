import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketLogo } from '../components/MarketLogo'

describe('MarketLogo', () => {
  it('각 마켓별 initial 문자 렌더 (N/C/G/A/11)', () => {
    const { rerender } = render(<MarketLogo id="naver" />)
    expect(screen.getByText('N')).toBeInTheDocument()

    rerender(<MarketLogo id="coupang" />)
    expect(screen.getByText('C')).toBeInTheDocument()

    rerender(<MarketLogo id="gmarket" />)
    expect(screen.getByText('G')).toBeInTheDocument()

    rerender(<MarketLogo id="auction" />)
    expect(screen.getByText('A')).toBeInTheDocument()

    rerender(<MarketLogo id="11st" />)
    expect(screen.getByText('11')).toBeInTheDocument()
  })

  it('label 이 있으면 role=img + aria-label 노출 (스크린리더 보조)', () => {
    render(<MarketLogo id="naver" label="네이버 스마트스토어" />)
    const el = screen.getByRole('img', { name: '네이버 스마트스토어' })
    expect(el).toBeInTheDocument()
  })

  it('label 이 없으면 aria-hidden (장식 요소 — 부모가 텍스트 보유 가정)', () => {
    const { container } = render(<MarketLogo id="naver" />)
    const el = container.querySelector('[aria-hidden="true"]')
    expect(el).not.toBeNull()
    expect(el?.getAttribute('role')).toBeNull()
  })
})
