import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ImageMeta } from '@/lib/schemas/registration'

/**
 * ImageThumbnailGrid.ImagePreview 회귀 테스트.
 * 배경: private 버킷에 getPublicUrl('product-images') 쓰던 버그(real 403 깨짐) →
 *       createSignedUrl('product-images-original') 비동기 발급으로 교체.
 */

const createSignedUrl = vi.fn()
const from = vi.fn(() => ({ createSignedUrl }))

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ storage: { from } }),
}))
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { ImageThumbnailGrid } from '../ImageThumbnailGrid'

function makeImage(): ImageMeta {
  return {
    id: '00000000-0000-0000-0000-0000000000a1',
    storagePath: 'seller-1/prod-1/img-1.jpg',
    role: 'main',
    sortOrder: 0,
    width: 1024,
    height: 1024,
    bytes: 12345,
    mimeType: 'image/jpeg',
    hashSha256: 'a'.repeat(64),
  }
}

function renderGrid(): void {
  render(
    <ImageThumbnailGrid
      images={[makeImage()]}
      onSetMain={vi.fn()}
      onRemove={vi.fn()}
      onMove={vi.fn()}
    />,
  )
}

describe('ImageThumbnailGrid · ImagePreview', () => {
  beforeEach(() => {
    createSignedUrl.mockReset()
    from.mockClear()
  })

  it('성공: product-images-original 버킷에 signed URL 발급 후 img 렌더', async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.test/img-1.jpg' },
      error: null,
    })
    renderGrid()

    const img = await screen.findByRole('img', { name: '상품 이미지 1' })
    expect(img).toHaveAttribute('src', 'https://signed.test/img-1.jpg')
    // private 버킷 + 원본 경로로 호출됐는지 검증 (이전 버그: 'product-images' + getPublicUrl)
    expect(from).toHaveBeenCalledWith('product-images-original')
    expect(createSignedUrl).toHaveBeenCalledWith('seller-1/prod-1/img-1.jpg', 3600)
  })

  it('실패: signed URL 에러 시 "불러오기 실패" placeholder 표시', async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'object not found' },
    })
    renderGrid()

    await screen.findByText('불러오기 실패')
    // 깨진 img 가 아니라 placeholder(role=img, 실패 라벨)로 대체
    expect(
      screen.getByRole('img', { name: '상품 이미지 1 (불러오기 실패)' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: '상품 이미지 1' })).not.toBeInTheDocument()
  })
})
