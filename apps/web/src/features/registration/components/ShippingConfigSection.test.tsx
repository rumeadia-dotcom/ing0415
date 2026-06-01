import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { ShippingConfigSection } from './ShippingConfigSection'
import { DEFAULT_SHIPPING_CONFIG } from '@/lib/schemas/shipping-config'
import { describeTiers } from '@/lib/shipping/expand-box'
import { ko } from '@/locales/ko'

/**
 * ShippingConfigSection 단위 테스트.
 * 마스터: 2026-06-01-quantity-tiered-shipping-design.md §5.
 *
 * - 라벨은 ko.register.shipping.* 값으로 조회 → 컴포넌트↔테스트 라벨 drift 방지.
 * - MUST-HAVE 1: 수량별(박스) 선택 → box 입력 노출 + describeTiers 라이브 프리뷰.
 * - MUST-HAVE 2: 수량별(박스) 선택 → 쿠팡 미지원 경고("쿠팡" 포함) 노출.
 */

const t = ko.register.shipping

function Harness(): JSX.Element {
  const form = useForm({ defaultValues: { shippingConfig: DEFAULT_SHIPPING_CONFIG } })
  return (
    <FormProvider {...form}>
      <ShippingConfigSection name="shippingConfig" />
    </FormProvider>
  )
}

/** 단위가 붙은 라벨 텍스트 — 컴포넌트와 동일하게 "라벨 (단위)" 로 합성. */
function withUnit(label: string, unit?: string): string {
  return unit ? `${label} (${unit})` : label
}

describe('ShippingConfigSection', () => {
  it('초기 상태: 배송방식/배송비유형 radiogroup 이 보이고 box 입력은 숨겨져 있다', () => {
    render(<Harness />)
    expect(screen.getByLabelText(t.method.label)).toBeInTheDocument()
    // 무료(free) 가 기본 → 박스 입력은 아직 없음.
    expect(
      screen.queryByLabelText(withUnit(t.box.qtyPerBox.label, t.box.qtyPerBox.unit)),
    ).not.toBeInTheDocument()
    // free 기본이므로 쿠팡 경고도 없음.
    expect(screen.queryByText(/쿠팡/)).not.toBeInTheDocument()
  })

  it('수량별(박스) 선택 → box 입력 노출 + describeTiers 라이브 프리뷰', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // 수량별(박스) 라디오 선택.
    await user.click(screen.getByLabelText(t.feeType.quantity_tiered))

    const qtyInput = screen.getByLabelText(
      withUnit(t.box.qtyPerBox.label, t.box.qtyPerBox.unit),
    )
    const feeInput = screen.getByLabelText(
      withUnit(t.box.feePerBox.label, t.box.feePerBox.unit),
    )
    expect(qtyInput).toBeInTheDocument()
    expect(feeInput).toBeInTheDocument()

    await user.type(qtyInput, '12')
    await user.type(feeInput, '2500')

    const expected = describeTiers({ qtyPerBox: 12, feePerBox: 2500 })
    expect(expected).toContain('1~12개 2,500원')
    expect(
      screen.getByText((content) => content.includes('1~12개 2,500원')),
    ).toBeInTheDocument()
  })

  it('수량별(박스) 선택 → 쿠팡 미지원 경고가 보인다', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByLabelText(t.feeType.quantity_tiered))

    const warning = screen.getByText(t.coupangWarning)
    expect(warning).toBeInTheDocument()
    expect(warning.textContent).toContain('쿠팡')
  })
})
