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
import { ko } from '@/locales/ko'

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
    throw new ImageApiError({ code: 'invalid_mime', message: ko.imageUpload.invalidMime })
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new ImageApiError({ code: 'file_too_large', message: ko.imageUpload.fileTooLarge })
  }

  const [hashSha256, dimensions] = await Promise.all([computeSha256Hex(file), readImageDimensions(file)])

  const { uploadUrl, imageId, originalPath } = await requestUploadUrl({
    productId,
    filename: file.name,
    contentType: file.type as (typeof allowed)[number],
  })

  await putImageToSignedUrl(uploadUrl, file, onProgress)

  // image-register 는 멱등: 같은 상품에 동일 파일/위치 재시도 시 기존 row 를 반환한다.
  // 따라서 ImageMeta 의 id / storagePath 는 요청값이 아니라 **응답값**을 신뢰한다
  // (멱등 반환 시 새로 발급한 imageId/originalPath 가 아닌 기존 것을 가리켜야 정합).
  const registered = await registerImage({
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
    id: registered.imageId,
    storagePath: registered.originalPath,
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
