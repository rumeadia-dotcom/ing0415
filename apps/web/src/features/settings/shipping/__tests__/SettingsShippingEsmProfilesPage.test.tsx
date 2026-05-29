/**
 * SettingsShippingEsmProfilesPage 단위 테스트 (PR-3 frontend).
 *
 * 마스터: docs/architecture/v1/features/esm.md §3 / §5 / §7(PR-3)
 *         docs/spec/user_flow.md s9 n61
 *
 * 4상태 + 게이팅 커버리지:
 *  - loading: skeleton
 *  - error: ErrorMessage
 *  - empty: 프로필 0 + ESM 계정 있음 → 빈 안내 + 생성 버튼 활성
 *  - data: 프로필 카드 렌더
 *  - no-ESM-account: 생성 불가 안내 + 생성 버튼 disabled
 *  - create: 폼 제출 → createEsmShippingProfile 호출 (happy path)
 *  - create-error (QA-315): Edge 4단계 생성 실패 시 ErrorMessage + toast
 *      + 폼 유지(재시도 가능) + 로딩 해제 검증.
 *  - create-error-partial (QA-315): 일부 단계 성공 후 실패(internal) 폴백 검증.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ReactNode } from 'react'
import type { MarketAccount } from '@/lib/schemas/markets-feature'
import type { EsmShippingProfile } from '@/lib/schemas/esm'
import { ko } from '@/locales/ko'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const accountsMock = vi.fn()
vi.mock('@/features/markets/hooks/useMarketAccounts', () => ({
  useMarketAccounts: () => accountsMock(),
}))

import type * as EsmApiModule from '../api/esm-shipping-profile-api'

const listMock = vi.fn()
const createMock = vi.fn()
vi.mock('../api/esm-shipping-profile-api', async () => {
  const actual = await vi.importActual<typeof EsmApiModule>(
    '../api/esm-shipping-profile-api',
  )
  return {
    ...actual,
    listEsmShippingProfiles: (id?: string) => listMock(id),
    createEsmShippingProfile: (input: unknown) => createMock(input),
  }
})

// 실제 에러 클래스 — 위 mock 이 `...actual` 로 spread 하므로 동일 인스턴스 타입.
import { EsmShippingProfileError } from '../api/esm-shipping-profile-api'
import { SettingsShippingEsmProfilesPage } from '../pages/SettingsShippingEsmProfilesPage'

const t = ko.settings.shipping.esmProfiles

function esmAccount(over: Partial<MarketAccount> = {}): MarketAccount {
  return {
    id: '00000000-0000-4000-8000-000000001003',
    marketId: 'gmarket',
    accountLabel: 'G마켓 ESM',
    externalAccountId: 'gmarket-007',
    status: 'active',
    connectedAt: '2026-05-20T09:00:00.000+09:00',
    lastVerifiedAt: '2026-05-20T09:00:00.000+09:00',
    lastErrorCode: null,
    lastErrorAt: null,
    ...over,
  }
}

function profile(over: Partial<EsmShippingProfile> = {}): EsmShippingProfile {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    sellerId: 'seller-1',
    marketAccountId: '00000000-0000-4000-8000-000000001003',
    site: 'G',
    profileLabel: '기본 출고지',
    addrNo: 'ADDR-1',
    placeNo: 'PLACE-1',
    bundlePolicyNo: 'BUNDLE-1',
    dispatchPolicyNo: 'DISP-1',
    dispatchType: 'B',
    shippingFee: 3000,
    feeType: 1,
    status: 'active',
    createdAt: '2026-05-30T00:00:00.000+09:00',
    updatedAt: '2026-05-30T00:00:00.000+09:00',
    ...over,
  }
}

function renderPage(): void {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/settings/shipping/esm-profiles']}>
        <Routes>
          <Route path="/settings/shipping/esm-profiles" element={children} />
          <Route path="/markets/connect" element={<div>connect-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(<SettingsShippingEsmProfilesPage />, { wrapper })
}

function querySuccess<T>(data: T) {
  return { data, isPending: false, isSuccess: true, isError: false, error: null }
}

beforeEach(() => {
  accountsMock.mockReset()
  listMock.mockReset()
  createMock.mockReset()
  // sonner toast 는 모듈 레벨 vi.fn() 이라 테스트 간 호출 기록이 누적된다 — 초기화.
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('SettingsShippingEsmProfilesPage', () => {
  it('loading: 프로필 로딩 중 skeleton', async () => {
    accountsMock.mockReturnValue(querySuccess([esmAccount()]))
    listMock.mockImplementation(() => new Promise(() => undefined))
    renderPage()
    expect(
      await screen.findByLabelText(/배송 프로필을 불러오는 중/),
    ).toBeInTheDocument()
  })

  it('error: 목록 조회 실패 시 ErrorMessage', async () => {
    accountsMock.mockReturnValue(querySuccess([esmAccount()]))
    listMock.mockRejectedValue(new Error('boom'))
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText(/배송 프로필을 불러오지 못했습니다/),
      ).toBeInTheDocument()
    })
  })

  it('empty: ESM 계정 있으나 프로필 0 → 빈 안내 + 생성 버튼 활성', async () => {
    accountsMock.mockReturnValue(querySuccess([esmAccount()]))
    listMock.mockResolvedValue([])
    renderPage()
    expect(
      await screen.findByText(/등록된 배송 프로필이 없습니다/),
    ).toBeInTheDocument()
    const addBtn = screen.getByRole('button', { name: /새 배송 프로필/ })
    expect(addBtn).not.toBeDisabled()
  })

  it('data: 프로필 카드 렌더', async () => {
    accountsMock.mockReturnValue(querySuccess([esmAccount()]))
    listMock.mockResolvedValue([profile()])
    renderPage()
    expect(await screen.findByText('기본 출고지')).toBeInTheDocument()
    expect(screen.getByText('DISP-1')).toBeInTheDocument()
  })

  it('no-ESM-account: 계정 없으면 생성 불가 안내 + 버튼 disabled', async () => {
    accountsMock.mockReturnValue(querySuccess([]))
    listMock.mockResolvedValue([])
    renderPage()
    expect(
      await screen.findByText(/G마켓·옥션 계정이 연결되어 있지 않습니다/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /새 배송 프로필/ }),
    ).toBeDisabled()
  })

  it('create: 폼 제출 → createEsmShippingProfile 호출', async () => {
    accountsMock.mockReturnValue(querySuccess([esmAccount()]))
    listMock.mockResolvedValue([])
    createMock.mockResolvedValue(profile())

    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /새 배송 프로필/ }),
    )

    // dialog 폼 입력
    await user.type(await screen.findByLabelText('프로필명'), '기본 출고지')
    await user.type(screen.getByLabelText('우편번호'), '06236')
    await user.type(screen.getByLabelText('기본 주소'), '서울 강남구 테헤란로 123')
    await user.type(screen.getByLabelText('담당자명'), '홍길동')
    await user.type(screen.getByLabelText('연락처'), '010-1234-5678')

    await user.click(screen.getByRole('button', { name: /배송 프로필 생성/ }))

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      marketAccountId: '00000000-0000-4000-8000-000000001003',
      site: 'G',
      profileLabel: '기본 출고지',
      address: expect.objectContaining({ zipCode: '06236' }),
    })
  })

  // ── QA-315: 생성 실패 시나리오 ──────────────────────────────

  /** 다이얼로그를 열고 유효한 폼을 채운 뒤 생성 버튼을 누른다. */
  async function openAndSubmitValidForm(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> {
    await user.click(
      await screen.findByRole('button', { name: /새 배송 프로필/ }),
    )
    await user.type(await screen.findByLabelText('프로필명'), '기본 출고지')
    await user.type(screen.getByLabelText('우편번호'), '06236')
    await user.type(screen.getByLabelText('기본 주소'), '서울 강남구 테헤란로 123')
    await user.type(screen.getByLabelText('담당자명'), '홍길동')
    await user.type(screen.getByLabelText('연락처'), '010-1234-5678')
    await user.click(screen.getByRole('button', { name: /배송 프로필 생성/ }))
  }

  it('create-error: Edge 4단계 생성 실패 → ErrorMessage(role=alert) + toast.error + 폼 유지 + 로딩 해제', async () => {
    accountsMock.mockReturnValue(querySuccess([esmAccount()]))
    listMock.mockResolvedValue([])
    // Edge 가 매핑된 도메인 코드(not_esm_market)로 실패 → 로컬라이즈 메시지 노출.
    createMock.mockRejectedValue(
      new EsmShippingProfileError({
        code: 'not_esm_market',
        message: 'account is not an ESM market',
        correlationId: 'corr-err-1',
      }),
    )

    const user = userEvent.setup()
    renderPage()
    await openAndSubmitValidForm(user)

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))

    // 1) ErrorMessage 가 role=alert 로 노출 + 코드 매핑된 로컬라이즈 메시지.
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(t.errors.not_esm_market)
    // correlationId 는 접힘 상세(요청 ID) — 토글 펼치면 노출.
    await user.click(screen.getByRole('button', { name: '자세히 보기' }))
    expect(alert).toHaveTextContent(/corr-err-1/)

    // 2) toast.error 도 함께 발화.
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(t.toast.createError),
    )
    expect(toast.success).not.toHaveBeenCalled()

    // 3) 폼이 사라지지 않고 입력값 유지 → 재시도 가능.
    expect(screen.getByLabelText('프로필명')).toHaveValue('기본 출고지')
    expect(screen.getByLabelText('우편번호')).toHaveValue('06236')

    // 4) 로딩 해제: 제출 버튼이 '생성 중…' 이 아니라 다시 활성.
    const submitBtn = screen.getByRole('button', { name: /배송 프로필 생성/ })
    expect(submitBtn).not.toBeDisabled()
    expect(
      screen.queryByRole('button', { name: t.dialog.submitting }),
    ).not.toBeInTheDocument()
  })

  it('create-error-partial: 일부 단계 성공 후 실패(internal) → 폴백 메시지 + 폼 유지 후 재시도 성공', async () => {
    accountsMock.mockReturnValue(querySuccess([esmAccount()]))
    listMock.mockResolvedValue([])
    // ESM 4단계 중 마지막 단계에서 실패 — 매핑 없는 internal 코드 → toast 폴백 메시지.
    createMock.mockRejectedValueOnce(
      new EsmShippingProfileError({
        code: 'internal',
        message: 'step 4 (dispatch policy) failed',
        correlationId: 'corr-partial-1',
      }),
    )

    const user = userEvent.setup()
    renderPage()
    await openAndSubmitValidForm(user)

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))

    // internal 은 errors 사전에 있으므로 그 메시지가 노출(없었다면 createError 폴백).
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(t.errors.internal)
    await user.click(screen.getByRole('button', { name: '자세히 보기' }))
    expect(alert).toHaveTextContent(/corr-partial-1/)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(t.toast.createError),
    )

    // 폼이 유지되어 재시도 가능 — 2번째 시도는 성공.
    createMock.mockResolvedValueOnce(profile())
    await user.click(screen.getByRole('button', { name: /배송 프로필 생성/ }))

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(t.toast.createSuccess),
    )
  })
})
