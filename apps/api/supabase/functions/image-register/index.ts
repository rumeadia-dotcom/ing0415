/**
 * Edge Function: image-register
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/image-pipeline.md §5.1 (5단계 — DB row 생성)
 *   - supabase/migrations/20260519000005_products.sql §4 (product_images DDL)
 *
 * 책임:
 *   - 클라이언트가 원본 PUT 완료 후 호출. product_images INSERT (status='uploaded').
 *   - 동일 셀러의 동일 sha256 재업로드는 409 (UNIQUE (seller_id, sha256)).
 *   - position=0 → role='main' / else 'sub' (DB enum `product_image_role`).
 *     주의: 현재 마이그레이션 product_images 에는 role 컬럼 없음. role 은 응답 메타로만 반환
 *     (DDL 미스매치는 history.md 후속 마이그레이션에서 컬럼 추가 시 동기화).
 *   - audit 적재 (category='registration', event='image_registered').
 *
 * 강제:
 *   - ownership 명시 검증 (service_role 사용 경로).
 *   - sha256 / mime / bytes 모두 클라이언트 신고값이므로 zod 강제 후 그대로 사용.
 *     변환 시점에 원본 다운로드 → 실제 검증 수행 (image-transform 에서 src 검증).
 *   - 응답 메시지에 PII 노출 금지.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  getServiceClient,
  getUserClient,
  HttpErrors,
  ok,
  parseBody,
  requireBearer,
  withRequest,
} from '../_shared/index.ts'

const RequestSchema = z.object({
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

export default Deno.serve(
  withRequest('image-register', async ({ req, logger, correlationId }) => {
    const jwt = requireBearer(req)
    const userSb = getUserClient(jwt)
    const { data: userData, error: userErr } = await userSb.auth.getUser()
    if (userErr || !userData.user) {
      throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
    }
    const sellerId = userData.user.id

    const body = await parseBody(req, RequestSchema)

    // ownership 검증
    const service = getServiceClient()
    const { data: prod, error: prodErr } = await service
      .from('products')
      .select('id')
      .eq('id', body.productId)
      .eq('seller_id', sellerId)
      .maybeSingle()
    if (prodErr) {
      logger.error(
        { sellerId, productId: body.productId, rpcError: prodErr.code ?? 'unknown' },
        '← product lookup error',
      )
      throw HttpErrors.internal('product_lookup_failed', 'product lookup failed')
    }
    if (!prod) {
      throw HttpErrors.notFound('product_not_found', 'product not found or not owned')
    }

    // 경로 규약 검증: <sellerId>/<productId>/<imageId>.<ext>
    const expectedPrefix = `${sellerId}/${body.productId}/${body.imageId}.`
    if (!body.originalPath.startsWith(expectedPrefix)) {
      throw HttpErrors.badRequest('path_mismatch', 'originalPath does not match path convention')
    }

    const role: 'main' | 'sub' = body.position === 0 ? 'main' : 'sub'

    const { error: insErr } = await service.from('product_images').insert({
      id: body.imageId,
      seller_id: sellerId,
      product_id: body.productId,
      position: body.position,
      original_path: body.originalPath,
      mime: body.contentType,
      bytes: body.fileSize,
      width: body.width ?? null,
      height: body.height ?? null,
      sha256: body.hashSha256,
      status: 'uploaded',
      uploaded_at: new Date().toISOString(),
    })

    if (insErr) {
      // Postgres unique violation = 23505
      if (insErr.code === '23505') {
        logger.warn(
          { sellerId, productId: body.productId, imageId: body.imageId },
          '← image-register duplicate',
        )
        throw HttpErrors.conflict('duplicate_image', 'image already registered (same file or position)')
      }
      logger.error(
        { sellerId, productId: body.productId, imageId: body.imageId, rpcError: insErr.code ?? 'unknown' },
        '← product_images insert error',
      )
      throw HttpErrors.internal('insert_failed', 'failed to register image')
    }

    await appendAudit({
      category: 'registration',
      event: 'image_registered',
      sellerId,
      meta: {
        productId: body.productId,
        imageId: body.imageId,
        position: body.position,
        role,
        bytes: body.fileSize,
        mime: body.contentType,
      },
      correlationId,
      logger,
    })

    logger.info(
      { sellerId, productId: body.productId, imageId: body.imageId, position: body.position },
      '← image-register ok',
    )

    return ok(
      { imageId: body.imageId, status: 'uploaded' as const, role },
      { correlationId },
    )
  }),
)
