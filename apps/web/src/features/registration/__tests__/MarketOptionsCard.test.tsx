/**
 * MarketOptionsCard 동적 등록필드 렌더 테스트.
 *
 * 마스터: docs/architecture/v1/features/esm.md "전환 결정 2026-05-30"(조회형 PR-E2) / §4.6 / §5.
 * 검증:
 *   - ESM(gmarket) 카드: 카테고리 + 출하지 select + 발송정책 select(조회형) + officialNotice.
 *   - 출하지/발송정책 없음 → ESM Plus 등록 안내 + 외부 링크 CTA (생성 진입점 없음, empty).
 *   - 선택 시 onChange 가 marketOptions.shippingPlaceNo / dispatchPolicyNo 에 적재.
 *   - 발송정책은 site별(G/A) — useEsmShippingOptions 가 계정 site 분만 내려준다(site 분기).
 *   - 11번가(11st): 출고지/반품지 select (PR-2 회귀) + 상품정보고시(PR-4, 11번가 마스터 1군+free-form).
 *   - 타 마켓(naver) 카드: 카테고리만 — ESM 필드 미노출 (하위호환 회귀).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui'
import type { EsmShippingListResponse } from '@/lib/schemas/esm'
import type { CategoryMapping } from '@/lib/schemas/registration'

const elevenStAddressesMock = vi.fn()
const esmShippingOptionsMock = vi.fn()

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

// 생성형 훅(useEsmShippingProfiles)은 조회형 전환(PR-E2~E4)으로 제거됨 — 모킹하지 않는다.
vi.mock('@/features/settings/shipping', () => ({
  useElevenStShippingAddresses: (marketAccountId?: string) =>
    elevenStAddressesMock(marketAccountId),
  useEsmShippingOptions: (marketAccountId?: string) =>
    esmShippingOptionsMock(marketAccountId),
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

/** ESM 조회형 응답(useEsmShippingOptions) 기본 fixture — site='G'. */
function esmOptions(
  over: Partial<EsmShippingListResponse> = {},
): EsmShippingListResponse {
  return {
    site: 'G',
    places: [
      { placeNo: '1001', placeName: '기본 출하지', isDefault: true },
      { placeNo: '1002', placeName: '제2 출하지', isDefault: false },
    ],
    dispatchPolicies: [
      {
        site: 'G',
        dispatchPolicyNo: '2001',
        dispatchPolicyName: '오늘출발 발송정책',
        dispatchType: 'A',
        isDefault: true,
      },
    ],
    ...over,
  }
}

function renderCard(
  marketId: 'gmarket' | 'auction' | 'naver' | '11st',
  onChange = vi.fn(),
  mapping: CategoryMapping | null = null,
): { onChange: ReturnType<typeof vi.fn> } {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TooltipProvider>
      <MemoryRouter initialEntries={['/register/markets']}>
        <Routes>
          <Route path="/register/markets" element={children} />
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

describe('MarketOptionsCard — ESM(gmarket) 조회형 출하지/발송정책 (PR-E2)', () => {
  beforeEach(() => {
    esmShippingOptionsMock.mockReset()
  })

  it('출하지/발송정책 select 를 이름 표시·번호 값으로 렌더한다 (data)', () => {
    esmShippingOptionsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: esmOptions(),
    })
    renderCard('gmarket')
    expect(screen.getByLabelText('G마켓·옥션 출하지')).toBeInTheDocument()
    expect(screen.getByLabelText('G마켓·옥션 발송정책')).toBeInTheDocument()
    // placeName 표시 + placeNo 값.
    const opt = screen.getByRole('option', {
      name: '기본 출하지',
    }) as HTMLOptionElement
    expect(opt.value).toBe('1001')
    const dispatchOpt = screen.getByRole('option', {
      name: '오늘출발 발송정책',
    }) as HTMLOptionElement
    expect(dispatchOpt.value).toBe('2001')
  })

  it('출하지 선택 시 onChange 가 marketOptions.shippingPlaceNo 에 placeNo 적재', async () => {
    const user = userEvent.setup()
    esmShippingOptionsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: esmOptions(),
    })
    const { onChange } = renderCard('gmarket')
    await user.selectOptions(screen.getByLabelText('G마켓·옥션 출하지'), '1002')
    const last = onChange.mock.calls.at(-1)?.[0] as CategoryMapping
    expect(last.marketOptions.shippingPlaceNo).toBe('1002')
  })

  it('발송정책 선택 시 onChange 가 marketOptions.dispatchPolicyNo 에 적재', async () => {
    const user = userEvent.setup()
    esmShippingOptionsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: esmOptions(),
    })
    const { onChange } = renderCard('gmarket')
    await user.selectOptions(
      screen.getByLabelText('G마켓·옥션 발송정책'),
      '2001',
    )
    const last = onChange.mock.calls.at(-1)?.[0] as CategoryMapping
    expect(last.marketOptions.dispatchPolicyNo).toBe('2001')
  })

  it('옥션(auction) 카드는 site=A 발송정책만 노출한다 (site 분기)', () => {
    // useEsmShippingOptions(Edge)가 계정 site 분(A)만 태깅해 내려준다 — 카드는 받은 목록 그대로 노출.
    esmShippingOptionsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: esmOptions({
        site: 'A',
        dispatchPolicies: [
          {
            site: 'A',
            dispatchPolicyNo: '3001',
            dispatchPolicyName: '옥션 발송정책',
            dispatchType: 'B',
            isDefault: true,
          },
        ],
      }),
    })
    renderCard('auction')
    const dispatchOpt = screen.getByRole('option', {
      name: '옥션 발송정책',
    }) as HTMLOptionElement
    expect(dispatchOpt.value).toBe('3001')
    // G마켓 발송정책은 내려오지 않았으므로 옵션에 없다.
    expect(
      screen.queryByRole('option', { name: '오늘출발 발송정책' }),
    ).not.toBeInTheDocument()
  })

  it('loading 상태 — skeleton(배송 설정 불러오는 중) 노출', () => {
    esmShippingOptionsMock.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    })
    renderCard('gmarket')
    expect(
      screen.getAllByLabelText('배송 설정 불러오는 중…').length,
    ).toBeGreaterThan(0)
  })

  it('error 상태 — 조회 실패 문구 노출', () => {
    esmShippingOptionsMock.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    })
    renderCard('gmarket')
    expect(
      screen.getAllByText(/출하지\/발송정책을 불러오지 못했습니다/).length,
    ).toBeGreaterThan(0)
  })

  it('empty 상태 — ESM Plus 등록 안내 + 외부 링크 CTA (생성 진입점 없음)', () => {
    esmShippingOptionsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: esmOptions({ places: [], dispatchPolicies: [] }),
    })
    renderCard('gmarket')
    expect(screen.getByText('등록된 출하지가 없습니다')).toBeInTheDocument()
    expect(screen.getByText('등록된 발송정책이 없습니다')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /ESM Plus 열기/ }).length,
    ).toBe(2)
  })

  it('상품정보고시(officialNotice) 입력 필드도 함께 렌더한다 (PR-5)', () => {
    esmShippingOptionsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: esmOptions(),
    })
    renderCard('gmarket')
    expect(
      screen.getByLabelText('G마켓·옥션 상품정보고시'),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '의류' })).toBeInTheDocument()
  })

  it('상품군 선택 시 marketOptions.officialNotice 에 적재한다 (PR-5)', async () => {
    const user = userEvent.setup()
    esmShippingOptionsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: esmOptions(),
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
    esmShippingOptionsMock.mockReset()
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
    // ESM 조회 훅은 호출되지 않는다(11번가 카드).
    expect(esmShippingOptionsMock).not.toHaveBeenCalled()
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

  it('상품정보고시(officialNotice) 필드를 11번가 마스터(1군 + 직접입력)로 렌더한다 (PR-4)', () => {
    elevenStAddressesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        outbound: [{ addrSeq: '14', addrNm: '본사 출고지' }],
        returnAddrs: [{ addrSeq: '31', addrNm: '본사 반품지' }],
      },
    })
    renderCard('11st')
    expect(screen.getByLabelText('11번가 상품정보고시')).toBeInTheDocument()
    // 11번가 마스터 = 확보 군 1개(891011) + free-form 직접입력 옵션 (ESM 41군 아님).
    expect(
      screen.getByRole('option', { name: '일반 상품 (예시 군 · 891011)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: '직접 입력 (마스터에 없는 상품군)' }),
    ).toBeInTheDocument()
    // ESM 41군(의류)은 11번가 카드에 노출되지 않는다.
    expect(screen.queryByRole('option', { name: '의류' })).not.toBeInTheDocument()
  })

  it('상품군 선택 시 marketOptions.officialNotice 에 generic 형태로 적재 (PR-4)', async () => {
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
    await user.selectOptions(screen.getByLabelText('11번가 상품정보고시'), '891011')
    const last = onChange.mock.calls.at(-1)?.[0] as CategoryMapping
    // UI 값은 generic 형태({officialNoticeNo, details}) — 11번가 {type,item} 변환은 transformProduct.
    expect(last.marketOptions.officialNotice).toEqual({
      officialNoticeNo: '891011',
      details: [],
    })
  })

  it('free-form 직접입력 선택 시 type 빈 값 + 항목 1행으로 시작한다 (C4 미확보 군)', async () => {
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
    await user.selectOptions(
      screen.getByLabelText('11번가 상품정보고시'),
      '__freeform__',
    )
    const last = onChange.mock.calls.at(-1)?.[0] as CategoryMapping
    expect(last.marketOptions.officialNotice).toEqual({
      officialNoticeNo: '',
      details: [{ code: '', value: '' }],
    })
  })
})

describe('MarketOptionsCard — 하위호환 회귀(naver)', () => {
  beforeEach(() => {
    esmShippingOptionsMock.mockReset()
    elevenStAddressesMock.mockReset()
  })

  it('네이버 카드는 카테고리만 — ESM/11번가 필드 미노출', () => {
    renderCard('naver')
    expect(
      screen.getByLabelText(/네이버 스마트스토어 카테고리 선택/),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('G마켓·옥션 출하지'),
    ).not.toBeInTheDocument()
    // ESM/11번가 조회 훅 호출조차 안 됨(추가 필드 0개).
    expect(esmShippingOptionsMock).not.toHaveBeenCalled()
    expect(elevenStAddressesMock).not.toHaveBeenCalled()
  })
})
