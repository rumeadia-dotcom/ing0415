/**
 * Stepper 렌더 회귀 (category-sync.md §7 — 라벨 truncate fix).
 *
 * 검증:
 *  - 데스크탑 5단계 라벨 전체 텍스트가 DOM 에 존재 ("마켓 · 카테고리" 잘림 방지 회귀).
 *  - 현재 단계 라벨에 whitespace-nowrap(잘림 방지) 적용.
 *  - aria-current="step" 가 현재 단계 번호에 부여(접근성).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stepper, REGISTER_STEPS } from '../components/Stepper'

describe('Stepper', () => {
  it('모든 단계 라벨 전체 텍스트가 렌더된다 (마켓 · 카테고리 잘림 방지 회귀)', () => {
    render(<Stepper current="markets" />)
    for (const step of REGISTER_STEPS) {
      // getByText 는 정확 일치 — "마켓 · 카테고리" 가 truncate 로 잘리지 않고 전체 노출.
      expect(screen.getByText(step.label)).toBeInTheDocument()
    }
    expect(screen.getByText('마켓 · 카테고리')).toBeInTheDocument()
  })

  it('현재 단계 라벨은 데스크탑에서 whitespace-nowrap (잘림 방지)', () => {
    render(<Stepper current="markets" />)
    const label = screen.getByText('마켓 · 카테고리')
    expect(label.className).toContain('md:whitespace-nowrap')
  })

  it('현재 단계 번호에 aria-current="step" 부여', () => {
    render(<Stepper current="markets" />)
    const current = screen.getByText('3')
    expect(current).toHaveAttribute('aria-current', 'step')
  })

  it('등록 단계 목록은 ol[aria-label] 로 노출 (접근성)', () => {
    render(<Stepper current="info" />)
    expect(screen.getByRole('list', { name: '등록 단계' })).toBeInTheDocument()
  })
})
