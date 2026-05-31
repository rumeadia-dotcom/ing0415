import { describe, it, expect, vi } from 'vitest'

/**
 * uploadOneImage 멱등 회귀 (2026-05-31 운영 사고 — image-register 409 duplicate_image).
 * image-register 는 멱등: 같은 상품 동일 파일/위치 재시도 시 기존 row 를 반환한다.
 * 따라서 ImageMeta 의 id/storagePath 는 요청값(upload-url 발급분)이 아니라
 * **register 응답값**(멱등 시 기존 row)을 신뢰해야 한다.
 */

vi.mock('../api/image-api', () => {
  class ImageApiError extends Error {
    code: string
    constructor(p: { code: string; message: string }) {
      super(p.message)
      this.code = p.code
    }
  }
  return {
    ImageApiError,
    computeSha256Hex: vi.fn(async () => 'a'.repeat(64)),
    readImageDimensions: vi.fn(async () => ({ width: 100, height: 100 })),
    requestUploadUrl: vi.fn(async () => ({
      uploadUrl: 'https://example.com/upload',
      imageId: 'new-upload-uuid',
      originalPath: 'seller/prod/new-upload-uuid.jpg',
    })),
    putImageToSignedUrl: vi.fn(async () => undefined),
    // 멱등 반환: 기존 row 의 imageId/originalPath (요청과 다름).
    registerImage: vi.fn(async () => ({
      imageId: 'existing-row-uuid',
      status: 'uploaded' as const,
      role: 'main' as const,
      originalPath: 'seller/prod/existing-row-uuid.jpg',
    })),
  }
})

vi.mock('@/locales/ko', () => ({
  ko: { imageUpload: { invalidMime: 'mime 불가', fileTooLarge: '용량 초과' } },
}))

import { uploadOneImage } from '../hooks/useImageUpload'

function jpegFile(): File {
  return new File([new Uint8Array(10)], 'photo.jpg', { type: 'image/jpeg' })
}

describe('uploadOneImage — 멱등 반영', () => {
  it('성공: ImageMeta.id/storagePath 는 register 응답(멱등 시 기존 row)을 사용한다', async () => {
    const meta = await uploadOneImage({ productId: 'prod-1', file: jpegFile(), position: 0 })
    // upload-url 의 new-upload-uuid 가 아니라 register 가 돌려준 기존 row id 를 신뢰.
    expect(meta.id).toBe('existing-row-uuid')
    expect(meta.storagePath).toBe('seller/prod/existing-row-uuid.jpg')
    expect(meta.role).toBe('main')
    expect(meta.sortOrder).toBe(0)
  })

  it('실패: 허용되지 않은 mime 은 invalid_mime 으로 거부한다', async () => {
    const gif = new File([new Uint8Array(10)], 'anim.gif', { type: 'image/gif' })
    await expect(
      uploadOneImage({ productId: 'prod-1', file: gif, position: 0 }),
    ).rejects.toMatchObject({ code: 'invalid_mime' })
  })
})
