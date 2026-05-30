/**
 * MarketOptionsCard 동적 등록필드 렌더 테스트 (PR-3.5).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.6 / §5 / §7(PR-3.5 수락기준).
 * 검증:
 *   - ESM(gmarket) 카드: 카테고리 + 배송 프로필 select 렌더 (active 프로필만 옵션).
 *   - 프로필 없음 → "배송 프로필 만들러 가기" deep link CTA (/settings/shipping/esm-profiles).
 *   - 프로필 선택 시 onChange 가 marketOptions.shippingProfileId 에 적재.
 *   - 타 마켓(naver) 카드: 카테고리만 — 배송 프로필 select 미노출 (하위호환 회귀).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui'
import type { EsmShippingProfile } from '@/lib/schemas/esm'
import type { CategoryMapping } from '@/lib/schemas/registration'

const esmProfilesMock = vi.fn()
const elevenStAddressesMock = vi.fn()

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

vi.mock('@/features/settings/shipping', () => ({
  useEsmShippingProfiles: (marketAccountId?: string) =>
    esmProfilesMock(marketAccountId),
  useElevenStShippingAddresses: (marketAccountId?: string) =>
    elevenStAddressesMock(marketAccountId),
}))

vi.mock('../hooks/useMarketCategoryTree', () => ({
  useMarketCategoryTree: () => ({
    isLoading: false,
    isError: false,
    data: [
      {
        id: 'c-root',
        name: '가전',
        depth: 1,
        leaf: false,
        parentId: null,
        children: [
          {
            id: 'c-kitchen',
            name: '주방가전',
            depth: 2,
            leaf: true,
            parentId: 'c-root',
            children: [],
          },
        ],
      },
    ],
  }),
}))

import { MarketOptionsCard } from '../components/MarketOptionsCard'

const ACCOUNT_ID = '00000000-0000-0000-0000-0000000000a1'

function profile(over: Partial<EsmShippingProfile>): EsmShippingProfile {
  return {
    id: 'p1',
    sellerId: 'seller-1',
    marketAccountId: ACCOUNT_ID,
    site: 'G',
    profileLabel: '기본 출고지',
    addrNo: 'A1',
    placeNo: 'PL1',
    bundlePolicyNo: null,
    dispatchPolicyNo: 'D1',
    dispatchType: 'A',
    shippingFee: 0,
    feeType: 1,
    status: 'active',
    createdAt: '2026-05-30T00:00:00.000+09:00',
    updatedAt: '2026-05-30T00:00:00.000+09:00',
    ...over,
  }
}

function renderCard(
  marketId: 'gmarket' | 'naver' | '11st',
  onChange = vi.fn(),
  mapping: CategoryMapping | null = null,
): { onChange: ReturnType<typeof vi.fn> } {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TooltipProvider>
      <MemoryRouter initialEntries={['/register/markets']}>
        <Routes>
          <Route path="/register/markets" element={children} />
          <Route
            path="/settings/shipping/esm-profiles"
            element={<div>esm-profiles-page</div>}
          />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>
  )
  render(
    <MarketOptionsCard
      marketId={marketId}
      marketAccountId={ACCOUNT_ID}
      mapping={mapping}
      onChange={onChange}
    />,
    { wrapper },
  )
  return { onChange }
}

describe('MarketOptionsCard — ESM(gmarket) 동적 필드', () => {
  beforeEach(() => {
    esmProfilesMock.mockReset()
  })

  it('active 배송 프로필을 select 옵션으로 렌더한다', () => {
    esmProfilesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [profile({ id: 'p1', profileLabel: '기본 출고지' })],
    })
    renderCard('gmarket')
    expect(
      screen.getByLabelText('G마켓·옥션 배송 프로필'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: '기본 출고지' }),
    ).toBeInTheDocument()
  })

  it('status=error 프로필은 선택지에서 제외된다', () => {
    esmProfilesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        profile({ id: 'p1', profileLabel: '정상', status: 'active' }),
        profile({ id: 'p2', profileLabel: '고아', status: 'error' }),
      ],
    })
    renderCard('gmarket')
    expect(screen.getByRole('option', { name: '정상' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '고아' })).not.toBeInTheDocument()
  })

  it('프로필이 없으면 "만들러 가기" deep link 로 이동한다 (empty)', async () => {
    const user = userEvent.setup()
    esmProfilesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
    })
    renderCard('gmarket')
    const cta = screen.getByRole('button', { name: /배송 프로필 만들러 가기/ })
    await user.click(cta)
    expect(await screen.findByText('esm-profiles-page')).toBeInTheDocument()
  })

  it('프로필 선택 시 onChange 가 marketOptions.shippingProfileId 에 적재한다', async () => {
    const user = userEvent.setup()
    esmProfilesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [profile({ id: 'p1', profileLabel: '기본 출고지' })],
    })
    const { onChange } = renderCard('gmarket')
    await user.selectOptions(
      screen.getByLabelText('G마켓·옥션 배송 프로필'),
      'p1',
    )
    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls.at(-1)?.[0] as CategoryMapping
    expect(last.marketOptions).toEqual({ shippingProfileId: 'p1' })
  })

  it('로드 실패 시 에러 문구를 노출한다 (error 상태)', () => {
    esmProfilesMock.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    })
    renderCard('gmarket')
    expect(
      screen.getByText('배송 프로필을 불러오지 못했습니다.'),
    ).toBeInTheDocument()
  })

  it('상품정보고시(officialNotice) 입력 필드도 함께 렌더한다 (PR-5)', () => {
    esmProfilesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [profile({ id: 'p1', profileLabel: '기본 출고지' })],
    })
    renderCard('gmarket')
    // 상품군 select (officialNotice 필드).
    expect(
      screen.getByLabelText('G마켓·옥션 상품정보고시'),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '의류' })).toBeInTheDocument()
  })

  it('상품군 선택 시 marketOptions.officialNotice 에 적재한다 (PR-5)', async () => {
    const user = userEvent.setup()
    esmProfilesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [profile({ id: 'p1', profileLabel: '기본 출고지' })],
    })
    const { onChange } = renderCard('gmarket')
    await user.selectOptions(
      screen.getByLabelText('G마켓·옥션 상품정보고시'),
      '41',
    )
    const last = onChange.mock.calls.at(-1)?.[0] as CategoryMapping
    expect(last.marketOptions.officialNotice).toEqual({
      officialNoticeNo: '41',
      details: [{ code: '41-1', value: '' }],
    })
  })
})

describe('MarketOptionsCard — 11번가 출고지/반품지 select (PR-2)', () => {
  beforeEach(() => {
    esmProfilesMock.mockReset()
    elevenStAddressesMock.mockReset()
  })

  it('출고지/반품지 select 를 addrNm 표시·addrSeq 값으로 렌더한다 (data)', () => {
    elevenStAddressesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        outbound: [{ addrSeq: '14', addrNm: '본사 출고지' }],
        returnAddrs: [{ addrSeq: '31', addrNm: '본사 반품지' }],
      },
    })
    renderCard('11st')
    expect(screen.getByLabelText('11번가 출고지')).toBeInTheDocument()
    expect(screen.getByLabelText('11번가 반품/교환지')).toBeInTheDocument()
    // addrNm 표시 + addrSeq 값.
    const opt = screen.getByRole('option', { name: '본사 출고지' }) as HTMLOptionElement
    expect(opt.value).toBe('14')
    // ESM 훅은 호출되지 않는다(11번가 카드).
    expect(esmProfilesMock).not.toHaveBeenCalled()
  })

  it('출고지 선택 시 onChange 가 marketOptions.outboundAddrSeq 에 addrSeq 적재', async () => {
    const user = userEvent.setup()
    elevenStAddressesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        outbound: [{ addrSeq: '14', addrNm: '본사 출고지' }],
        returnAddrs: [{ addrSeq: '31', addrNm: '본사 반품지' }],
      },
    })
    const { onChange } = renderCard('11st')
    await user.selectOptions(screen.getByLabelText('11번가 출고지'), '14')
    const last = onChange.mock.calls.at(-1)?.[0] as CategoryMapping
    expect(last.marketOptions.outboundAddrSeq).toBe('14')
  })

  it('loading 상태 — skeleton(주소 목록 불러오는 중) 노출', () => {
    elevenStAddressesMock.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    })
    renderCard('11st')
    expect(screen.getAllByLabelText('주소 목록 불러오는 중…').length).toBeGreaterThan(0)
  })

  it('error 상태 — 조회 실패 문구 노출', () => {
    elevenStAddressesMock.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    })
    renderCard('11st')
    expect(
      screen.getAllByText(/출고지\/반품지를 불러오지 못했습니다/).length,
    ).toBeGreaterThan(0)
  })

  it('empty 상태 — 셀러오피스 등록 안내 + 외부 링크 CTA', () => {
    elevenStAddressesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { outbound: [], returnAddrs: [] },
    })
    renderCard('11st')
    expect(screen.getByText('등록된 출고지가 없습니다')).toBeInTheDocument()
    expect(screen.getByText('등록된 반품/교환지가 없습니다')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /11번가 셀러오피스 열기/ }).length,
    ).toBe(2)
  })
})

describe('MarketOptionsCard — 하위호환 회귀(naver)', () => {
  beforeEach(() => {
    esmProfilesMock.mockReset()
    elevenStAddressesMock.mockReset()
  })

  it('네이버 카드는 카테고리만 — 배송 프로필 필드 미노출', () => {
    renderCard('naver')
    expect(
      screen.getByLabelText(/네이버 스마트스토어 카테고리 선택/),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('G마켓·옥션 배송 프로필'),
    ).not.toBeInTheDocument()
    // useEsmShippingProfiles / useElevenStShippingAddresses 호출조차 안 됨(추가 필드 0개).
    expect(esmProfilesMock).not.toHaveBeenCalled()
    expect(elevenStAddressesMock).not.toHaveBeenCalled()
  })
})
