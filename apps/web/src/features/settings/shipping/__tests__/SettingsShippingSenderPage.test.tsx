import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import type * as DaumPostcodeModule from '@/lib/daum-postcode'

const openPostcodePopupMock = vi.fn()
vi.mock('@/lib/daum-postcode', async () => {
  const actual = await vi.importActual<typeof DaumPostcodeModule>('@/lib/daum-postcode')
  return {
    ...actual,
    openPostcodePopup: () => openPostcodePopupMock(),
  }
})

import type * as ApiModule from '../api/shipping-settings-api'

const fetchStatusMock = vi.fn()
const setCredsMock = vi.fn()

vi.mock('../api/shipping-settings-api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../api/shipping-settings-api')
  return {
    ...actual,
    fetchLogenCredentialsStatus: () => fetchStatusMock(),
    setLogenCredentials: (args: unknown) => setCredsMock(args),
  }
})

import { SettingsShippingSenderPage } from '../pages/SettingsShippingSenderPage'

function renderPage(): void {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/settings/shipping/sender']}>
        <Routes>
          <Route path="/settings/shipping/sender" element={children} />
          <Route path="/settings/shipping" element={<div>shipping-index</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(<SettingsShippingSenderPage />, { wrapper })
}

describe('SettingsShippingSenderPage (n60)', () => {
  beforeEach(() => {
    fetchStatusMock.mockReset()
    setCredsMock.mockReset()
    openPostcodePopupMock.mockReset()
  })

  it('loading: skeleton 표시', async () => {
    fetchStatusMock.mockImplementation(() => new Promise(() => undefined))
    renderPage()
    expect(await screen.findByLabelText(/발송인 정보 불러오는 중/)).toBeInTheDocument()
  })

  it('happy path: 폼 채우고 저장 → shipping-index 로 navigate', async () => {
    fetchStatusMock.mockResolvedValue({
      hasCredentials: true,
      hasSenderInfo: false,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: null,
    })
    setCredsMock.mockResolvedValue(undefined)
    openPostcodePopupMock.mockResolvedValue({
      zonecode: '06236',
      address: '서울 강남구 테헤란로 123',
      addressEnglish: '',
      addressType: 'R',
      bname: '',
      buildingName: '',
      apartment: 'N',
      jibunAddress: '',
      roadAddress: '서울 강남구 테헤란로 123',
      sido: '서울',
      sigungu: '강남구',
      sigunguCode: '',
      userSelectedType: 'R',
      userLanguageType: 'K',
    })

    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/발송인명/), '홍길동 스토어')
    await user.click(screen.getByRole('button', { name: /주소 검색/ }))
    await waitFor(() => {
      expect(openPostcodePopupMock).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByLabelText('발송지 주소')).toHaveValue(
        '[06236] 서울 강남구 테헤란로 123',
      )
    })
    await user.type(screen.getByLabelText(/연락처/), '010-1234-5678')
    await user.clear(screen.getByLabelText(/택배 운임/))
    await user.type(screen.getByLabelText(/택배 운임/), '2500')
    await user.click(screen.getByRole('button', { name: /^저장$/ }))

    await waitFor(() => expect(setCredsMock).toHaveBeenCalledTimes(1))
    await screen.findByText('shipping-index')
  })

  it('prefill: 기존 senderInfo 있으면 폼에 입력됨', async () => {
    fetchStatusMock.mockResolvedValue({
      hasCredentials: true,
      hasSenderInfo: true,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: {
        name: '기존 스토어',
        address: '서울특별시 종로구 1',
        phone: '010-0000-1111',
        fareTy: 'C',
        dlvFare: 3000,
      },
    })
    renderPage()
    expect(await screen.findByDisplayValue('기존 스토어')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('서울특별시 종로구 1')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('3000')).toBeInTheDocument()
  })

  it('error: status fetch 실패 시 ErrorMessage', async () => {
    fetchStatusMock.mockRejectedValue(new Error('boom'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/예상치 못한 오류가 발생했습니다/)).toBeInTheDocument()
    })
  })
})
