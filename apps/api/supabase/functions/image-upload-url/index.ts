/**
 * Edge Function: image-upload-url
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/image-pipeline.md §5.2 (서명 URL 발급)
 *   - docs/architecture/v1/cross-cutting/image-pipeline.md §3.2 (경로 규약)
 *
 * 책임:
 *   - 클라이언트가 원본 이미지를 product-images-original 버킷에 직접 PUT 하기 위한
 *     서명 업로드 URL 을 발급한다.
 *   - 셀러 본인 productId 소유 검증 + UUID 기반 imageId 발급 + 경로 규약 강제.
 *
 * 강제:
 *   - service_role 사용 경로지만 ownership 검증을 명시적으로 수행
 *     (RLS bypass 자체가 보안 결함이 되지 않도록 — security.md "RLS bypass 경로").
 *   - 응답 body 에 sellerId / 셀러 PII 포함 금지. imageId / originalPath / uploadUrl 만.
 *   - 발급 URL TTL = 10분 (PRD 첨부 스펙 600초). 6분 초과 시 클라이언트 재요청.
 *   - audit 적재는 본 함수에서 수행하지 않음 (등록 시 image-register 에서 적재).
 */

import { z } from 'npm:zod@3.23.8'
import {
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
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

const MIME_TO_EXT: Record<z.infer<typeof RequestSchema>['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const SIGNED_URL_TTL_SEC = 600

export default Deno.serve(
  withRequest('image-upload-url', async ({ req, logger, correlationId }) => {
    const jwt = requireBearer(req)
    const userSb = getUserClient(jwt)
    const { data: userData, error: userErr } = await userSb.auth.getUser()
    if (userErr || !userData.user) {
      throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
    }
    const sellerId = userData.user.id

    const body = await parseBody(req, RequestSchema)

    // ownership: products.seller_id == auth.uid()
    const service = getServiceClient()
    const { data: prod, error: prodErr } = await service
      .from('products')
      .select('id, seller_id')
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

    const imageId = crypto.randomUUID()
    const ext = MIME_TO_EXT[body.contentType]
    const originalPath = `${sellerId}/${body.productId}/${imageId}.${ext}`

    const { data: signed, error: signErr } = await service.storage
      .from('product-images-original')
      .createSignedUploadUrl(originalPath)
    if (signErr || !signed) {
      logger.error(
        { sellerId, productId: body.productId, imageId, storageError: signErr?.message ?? 'unknown' },
        '← signed upload url failed',
      )
      throw HttpErrors.internal('signed_url_failed', 'failed to create signed upload url')
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000).toISOString()
    logger.info(
      { sellerId, productId: body.productId, imageId, correlationId },
      '← image-upload-url issued',
    )

    return ok(
      {
        uploadUrl: signed.signedUrl,
        token: signed.token,
        imageId,
        originalPath,
        expiresAt,
      },
      { correlationId },
    )
  }),
)
