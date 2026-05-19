/**
 * image-transform 내부 헬퍼 — 마켓당 이미지 1장 처리 로직.
 *
 * 분리 사유: index.ts 의 200줄 제약 + 변환 라이브러리 교체 시 본 파일만 수정 (OQ-17).
 *
 * 강제:
 *   - service_role 만 transformed 버킷에 쓰기.
 *   - (image_id, market) UNIQUE 멱등 키 — upsert 로 충돌 안전.
 *   - real 모드에서는 실 변환 미구현 (OQ-17), status='failed' 적재 + 'failed' 반환.
 */

import {
  type getServiceClient,
  isDebug,
  type Logger,
  type MarketId,
} from '../_shared/index.ts'

export interface ImageRow {
  id: string
  seller_id: string
  product_id: string
  original_path: string
  mime: string
  status: string
}

export interface ExistingTransform {
  market: string
  status: string
  output_path: string | null
}

export type PerMarketStatus = 'ready' | 'failed' | 'skipped'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

type ServiceClient = ReturnType<typeof getServiceClient>

/**
 * debug 모드 mock 변환: 원본 바이트를 transformed 버킷에 그대로 복사.
 * 실 변환(resize/recompress) 통합은 OQ-17 결정 후.
 */
async function mockTransform(
  service: ServiceClient,
  image: ImageRow,
  market: MarketId,
  logger: Logger,
): Promise<{ outputPath: string; outputBytes: number; outputFormat: string }> {
  const { data: blob, error: dlErr } = await service.storage
    .from('product-images-original')
    .download(image.original_path)
  if (dlErr || !blob) {
    throw new Error(`original download failed: ${dlErr?.message ?? 'unknown'}`)
  }
  const ext = MIME_TO_EXT[image.mime] ?? 'jpg'
  const outputPath = `${image.seller_id}/${image.product_id}/${image.id}/${market}.${ext}`
  const { error: upErr } = await service.storage
    .from('product-images-transformed')
    .upload(outputPath, blob, { contentType: image.mime, upsert: true })
  if (upErr) {
    throw new Error(`transformed upload failed: ${upErr.message}`)
  }
  logger.debug(
    { market, imageId: image.id, outputPath, bytes: blob.size },
    'mock transform copied',
  )
  return {
    outputPath,
    outputBytes: blob.size,
    outputFormat: ext === 'jpg' ? 'jpeg' : ext,
  }
}

export async function processOne(
  service: ServiceClient,
  image: ImageRow,
  market: MarketId,
  existing: ExistingTransform | undefined,
  logger: Logger,
): Promise<PerMarketStatus> {
  // 멱등 캐시 hit
  if (existing && existing.status === 'succeeded' && existing.output_path) {
    return 'skipped'
  }

  const startedAt = new Date().toISOString()

  // real 모드: OQ-17 미해결 → 실 변환 미구현
  if (!isDebug) {
    await service.from('product_image_transforms').upsert(
      {
        image_id: image.id,
        market,
        status: 'failed',
        error_code: 'unknown',
        error_message: 'image-transform real 구현 보류 — OQ-17 (wasm-vips Deno 호환)',
        attempts: 1,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'image_id,market' },
    )
    logger.warn({ market, imageId: image.id }, 'real transform not implemented (OQ-17)')
    return 'failed'
  }

  try {
    const result = await mockTransform(service, image, market, logger)
    const { error: upErr } = await service.from('product_image_transforms').upsert(
      {
        image_id: image.id,
        market,
        output_path: result.outputPath,
        output_bytes: result.outputBytes,
        output_format: result.outputFormat,
        status: 'succeeded',
        error_code: null,
        error_message: null,
        attempts: 1,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'image_id,market' },
    )
    if (upErr) throw new Error(`pit upsert: ${upErr.message}`)
    return 'ready'
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await service.from('product_image_transforms').upsert(
      {
        image_id: image.id,
        market,
        status: 'failed',
        error_code: 'unknown',
        error_message: msg.slice(0, 200),
        attempts: 1,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'image_id,market' },
    )
    logger.warn({ market, imageId: image.id, error: msg }, 'transform failed')
    return 'failed'
  }
}
