/**
 * Edge Function: image-transform
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/image-pipeline.md §7 (변환 파이프라인)
 *   - supabase/migrations/20260519000005_products.sql §5 (product_image_transforms)
 *
 * 책임:
 *   - 등록 잡 시작 시 fan-out 호출. (productId, marketIds[]) 입력으로 해당 상품의 모든
 *     이미지를 각 마켓 스펙으로 변환 → product-images-transformed 버킷 저장.
 *   - product_image_transforms 에 마켓별 결과 (success/failed/skipped) 적재.
 *   - 모든 마켓 ready 인 image 는 product_images.status='ready' 로 승격.
 *
 * 멱등성:
 *   - (image_id, market) UNIQUE + 기존 succeeded + output_path 존재 시 skipped 반환.
 *   - 동일 (productId, marketIds) 재호출 안전.
 *
 * 변환 라이브러리:
 *   - 본 Stage 는 stub. debug → mock 복사, real → 'failed' (OQ-17 wasm-vips Deno 호환 검증 필요).
 *
 * 강제:
 *   - ownership 명시 검증 (service_role 사용 경로).
 *   - 한 마켓 실패가 다른 마켓 변환을 막지 않음 (병렬 독립 원칙).
 *   - process.ts 의 processOne 으로 마켓당 1장 처리 위임.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  getServiceClient,
  getUserClient,
  HttpErrors,
  MarketIdSchema,
  ok,
  parseBody,
  requireBearer,
  withRequest,
} from '../_shared/index.ts'
import {
  processOne,
  type ExistingTransform,
  type ImageRow,
  type PerMarketStatus,
} from './process.ts'

const RequestSchema = z.object({
  productId: z.string().uuid(),
  marketIds: z.array(MarketIdSchema).min(1).max(5),
})

export default Deno.serve(
  withRequest('image-transform', async ({ req, logger, correlationId }) => {
    const jwt = requireBearer(req)
    const userSb = getUserClient(jwt)
    const { data: userData, error: userErr } = await userSb.auth.getUser()
    if (userErr || !userData.user) {
      throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
    }
    const sellerId = userData.user.id

    const body = await parseBody(req, RequestSchema)
    const service = getServiceClient()

    // ownership + 변환 대상 이미지 로드 (status uploaded/ready 만)
    const { data: imgs, error: imgErr } = await service
      .from('product_images')
      .select('id, seller_id, product_id, original_path, mime, status')
      .eq('product_id', body.productId)
      .eq('seller_id', sellerId)
      .in('status', ['uploaded', 'ready'])
      .order('position', { ascending: true })
    if (imgErr) {
      logger.error(
        { sellerId, productId: body.productId, rpcError: imgErr.code ?? 'unknown' },
        '← product_images select error',
      )
      throw HttpErrors.internal('select_failed', 'failed to load images')
    }
    if (!imgs || imgs.length === 0) {
      throw HttpErrors.notFound('no_images', 'no images to transform')
    }
    const images = imgs as ImageRow[]

    // 기존 변환 결과 일괄 조회 (멱등 판정)
    const imageIds = images.map((i) => i.id)
    const { data: existingRows, error: pitErr } = await service
      .from('product_image_transforms')
      .select('image_id, market, status, output_path')
      .in('image_id', imageIds)
      .in('market', body.marketIds)
    if (pitErr) {
      logger.error(
        { sellerId, productId: body.productId, rpcError: pitErr.code ?? 'unknown' },
        '← pit select error',
      )
      throw HttpErrors.internal('select_failed', 'failed to load transforms')
    }
    const existingMap = new Map<string, ExistingTransform>()
    for (const row of (existingRows ?? []) as {
      image_id: string
      market: string
      status: string
      output_path: string | null
    }[]) {
      existingMap.set(`${row.image_id}:${row.market}`, {
        market: row.market,
        status: row.status,
        output_path: row.output_path,
      })
    }

    // 이미지 × 마켓 fan-out (직렬 — Edge Fn timeout 내 안전)
    const summary: {
      imageId: string
      perMarketStatus: Record<string, PerMarketStatus>
    }[] = []
    for (const image of images) {
      const perMarket: Record<string, PerMarketStatus> = {}
      let allOk = true
      for (const market of body.marketIds) {
        const existing = existingMap.get(`${image.id}:${market}`)
        const status = await processOne(service, image, market, existing, logger)
        perMarket[market] = status
        if (status === 'failed') allOk = false
      }
      summary.push({ imageId: image.id, perMarketStatus: perMarket })

      if (allOk && image.status !== 'ready') {
        await service.from('product_images').update({ status: 'ready' }).eq('id', image.id)
      }
    }

    const anyFailed = summary.some((s) =>
      Object.values(s.perMarketStatus).includes('failed'),
    )
    await appendAudit({
      category: 'registration',
      event: anyFailed ? 'image_transform_failed' : 'image_transformed',
      sellerId,
      meta: {
        productId: body.productId,
        marketIds: body.marketIds,
        imageCount: images.length,
      },
      correlationId,
      logger,
    })

    logger.info(
      { sellerId, productId: body.productId, imageCount: images.length, anyFailed },
      '← image-transform done',
    )

    return ok({ summary }, { correlationId })
  }),
)
