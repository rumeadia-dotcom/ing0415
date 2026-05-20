import { useMutation } from '@tanstack/react-query'
import {
  ImageApiError,
  computeSha256Hex,
  putImageToSignedUrl,
  readImageDimensions,
  registerImage,
  requestUploadUrl,
} from '../api/image-api'
import type { ImageMeta } from '@/lib/schemas/registration'

interface UploadOneInput {
  productId: string
  file: File
  position: number
  onProgress?: (loaded: number, total: number) => void
}

/**
 * 단일 이미지 업로드: signed URL → PUT → register → ImageMeta 반환.
 *
 * - 클라이언트 사이드 사전 검증: mimeType / fileSize.
 * - sha256 + dimensions 계산은 클라이언트.
 * - image-register 응답의 role 은 무시 (Step 2 폼에서 별도 결정 — main 은 첫 장 기본).
 */
export async function uploadOneImage({ productId, file, position, onProgress }: UploadOneInput): Promise<ImageMeta> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'] as const
  if (!(allowed as readonly string[]).includes(file.type)) {
    throw new ImageApiError({ code: 'invalid_mime', message: 'jpg / png / webp 만 허용됩니다.' })
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new ImageApiError({ code: 'file_too_large', message: '10MB 이하만 업로드 가능합니다.' })
  }

  const [hashSha256, dimensions] = await Promise.all([computeSha256Hex(file), readImageDimensions(file)])

  const { uploadUrl, imageId, originalPath } = await requestUploadUrl({
    productId,
    filename: file.name,
    contentType: file.type as (typeof allowed)[number],
  })

  await putImageToSignedUrl(uploadUrl, file, onProgress)

  await registerImage({
    productId,
    imageId,
    originalPath,
    contentType: file.type as (typeof allowed)[number],
    fileSize: file.size,
    width: dimensions.width,
    height: dimensions.height,
    hashSha256,
    position,
  })

  return {
    id: imageId,
    storagePath: originalPath,
    role: position === 0 ? 'main' : 'sub',
    sortOrder: position,
    width: dimensions.width,
    height: dimensions.height,
    bytes: file.size,
    mimeType: file.type as (typeof allowed)[number],
    hashSha256,
  }
}

export function useImageUpload() {
  return useMutation<ImageMeta, unknown, UploadOneInput>({
    mutationFn: uploadOneImage,
  })
}
