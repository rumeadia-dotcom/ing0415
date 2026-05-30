import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// supabase storage signed URL mock — ImageThumbnailGrid 의 ImagePreview 가 사용
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: 'https://example.test/x.jpg' },
          error: null,
        }),
      }),
    },
  }),
}))

import { StepImagesPage } from '../pages/StepImagesPage'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import type { ImageMeta } from '@/lib/schemas/registration'

const PRODUCT_ID = '00000000-0000-0000-0000-0000000000c3'

function makeImage(idx: number, role: 'main' | 'sub' = 'sub'): ImageMeta {
  return {
    id: `00000000-0000-0000-0000-00000000000${idx}`,
    storagePath: `seller/p/${idx}.jpg`,
    role,
    sortOrder: idx,
    width: 1024,
    height: 1024,
    bytes: 12345,
    mimeType: 'image/jpeg',
    hashSha256: 'a'.repeat(64),
  }
}

function renderPage(): void {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TooltipProvider>
      <MemoryRouter initialEntries={['/register/images']}>
        <Routes>
          <Route path="/register/info" element={<div>step-info</div>} />
          <Route path="/register/images" element={children} />
          <Route path="/register/markets" element={<div>step-markets</div>} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>
  )
  render(<StepImagesPage />, { wrapper })
}

describe('StepImagesPage', () => {
  beforeEach(() => {
    useRegisterFormStore.getState().clear()
  })

  it('productId 없으면 /register/info 로 회귀', async () => {
    renderPage()
    await screen.findByText('step-info')
  })

  it('images=0: 다음 버튼 disabled + 1장 이상 업로드 필요 안내', () => {
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    renderPage()
    const submit = screen.getByRole('button', { name: /다음: 마켓 선택/ })
    expect(submit).toBeDisabled()
  })

  it('main 1장 + sub 1장 → 다음 활성 → /register/markets 로 이동', async () => {
    const user = userEvent.setup()
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    useRegisterFormStore.getState().setImages([makeImage(1, 'main'), makeImage(2, 'sub')])
    renderPage()
    const submit = await screen.findByRole('button', { name: /다음: 마켓 선택/ })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    await screen.findByText('step-markets')
  })

  it('대표 이미지 0장 → blocking', () => {
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    useRegisterFormStore.getState().setImages([makeImage(1, 'sub')])
    renderPage()
    const submit = screen.getByRole('button', { name: /다음: 마켓 선택/ })
    expect(submit).toBeDisabled()
  })
})
