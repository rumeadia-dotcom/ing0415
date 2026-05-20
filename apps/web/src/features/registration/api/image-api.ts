import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * image-upload-url + image-register Edge Function 래퍼.
 * 마스터: docs/architecture/v1/cross-cutting/image-pipeline.md
 *
 * 흐름:
 *   1) image-upload-url 호출 → signed URL + imageId + originalPath 발급
 *   2) 클라이언트가 signed URL 로 직접 PUT (Edge Function 우회 — 대용량 회피)
 *   3) image-register 호출 → DB 등록 + Storage 검증 + 변환 큐 enqueue
 */

export class ImageApiError extends Error {
  readonly code: string
  readonly correlationId: string | null
  constructor(payload: { code: string; message: string; correlationId?: string | undefined }) {
    super(payload.message)
    this.name = 'ImageApiError'
    this.code = payload.code
    this.correlationId = payload.correlationId ?? null
  }
}

const ErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string().uuid().optional(),
})

// ─────────────────────────────────────────────
// image-upload-url
// ─────────────────────────────────────────────

export const UploadUrlRequestSchema = z.object({
  productId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})
export type UploadUrlRequest = z.infer<typeof UploadUrlRequestSchema>

const UploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  token: z.string(),
  imageId: z.string().uuid(),
  originalPath: z.string(),
  expiresAt: z.string().datetime({ offset: true }),
})
export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>

export async function requestUploadUrl(req: UploadUrlRequest): Promise<UploadUrlResponse> {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>('image-upload-url', {
    body: UploadUrlRequestSchema.parse(req) as unknown as Record<string, unknown>,
  })
  if (error) {
    logger.warn({ err: error.message }, '← image-upload-url error')
    const parsed = ErrorBodySchema.safeParse((error as { context?: { body?: unknown } }).context?.body)
    throw new ImageApiError(parsed.success ? parsed.data : { code: 'internal', message: error.message })
  }
  const errBody = ErrorBodySchema.safeParse(data)
  if (errBody.success) throw new ImageApiError(errBody.data)
  return UploadUrlResponseSchema.parse(data)
}

// ─────────────────────────────────────────────
// 직접 PUT (signed URL)
// ─────────────────────────────────────────────

export async function putImageToSignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl, true)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new ImageApiError({ code: 'storage_upload_failed', message: `PUT ${xhr.status}` }))
    }
    xhr.onerror = () => reject(new ImageApiError({ code: 'network', message: 'PUT network error' }))
    xhr.send(file)
  })
}

// ─────────────────────────────────────────────
// image-register
// ─────────────────────────────────────────────

export const RegisterRequestSchema = z.object({
  productId: z.string().uuid(),
  imageId: z.string().uuid(),
  originalPath: z.string().min(1).max(512),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  hashSha256: z.string().regex(/^[a-f0-9]{64}$/),
  position: z.number().int().min(0).max(9),
})
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>

const RegisterResponseSchema = z.object({
  imageId: z.string().uuid(),
  status: z.literal('uploaded'),
  role: z.enum(['main', 'sub']),
})
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>

export async function registerImage(req: RegisterRequest): Promise<RegisterResponse> {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>('image-register', {
    body: RegisterRequestSchema.parse(req) as unknown as Record<string, unknown>,
  })
  if (error) {
    logger.warn({ err: error.message }, '← image-register error')
    const parsed = ErrorBodySchema.safeParse((error as { context?: { body?: unknown } }).context?.body)
    throw new ImageApiError(parsed.success ? parsed.data : { code: 'internal', message: error.message })
  }
  const errBody = ErrorBodySchema.safeParse(data)
  if (errBody.success) throw new ImageApiError(errBody.data)
  return RegisterResponseSchema.parse(data)
}

// ─────────────────────────────────────────────
// 클라이언트 사이드: 파일 → SHA-256 hex
// ─────────────────────────────────────────────

export async function computeSha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ImageApiError({ code: 'image_decode_failed', message: 'cannot decode image' }))
    }
    img.src = url
  })
}
