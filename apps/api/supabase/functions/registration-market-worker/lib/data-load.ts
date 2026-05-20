/**
 * worker 도메인 데이터 로딩 helper.
 *
 * - 모든 SELECT 는 service_role + (seller_id, job_id, product_id) WHERE 강제 (cross-tenant 차단).
 * - product / images / mapping / credential_id 4 종.
 */

import {
  type getServiceClient,
  HttpErrors,
  MarketError,
  type Logger,
  type MarketId,
  type MarketMapping,
  type Product,
} from '../../_shared/index.ts'

type Service = ReturnType<typeof getServiceClient>

export interface JobContext {
  jobId: string
  sellerId: string
  productId: string
}

export interface JmrContext {
  marketResultId: string
  marketAccountId: string
  attemptCount: number
}

export async function loadJobContext(
  service: Service,
  jobId: string,
  logger: Logger,
): Promise<JobContext> {
  const { data, error } = await service
    .from('registration_jobs')
    .select('id, seller_id, product_id, status')
    .eq('id', jobId)
    .maybeSingle()
  if (error) {
    logger.error({ jobId, rpcError: error.code ?? 'unknown' }, '← worker job load error')
    throw HttpErrors.internal('job_load_failed', 'failed to load job')
  }
  if (!data) {
    throw HttpErrors.notFound('job_not_found', 'job not found')
  }
  if (data.status === 'cancelled') {
    // 협조적 취소 (state.md §6).
    throw HttpErrors.conflict('job_cancelled', 'job already cancelled')
  }
  return {
    jobId: String(data.id),
    sellerId: String(data.seller_id),
    productId: String(data.product_id),
  }
}

export async function loadJmr(
  service: Service,
  marketResultId: string,
  jobId: string,
  logger: Logger,
): Promise<JmrContext> {
  const { data, error } = await service
    .from('registration_job_market_results')
    .select('id, market_account_id, attempt_count, market_status')
    .eq('id', marketResultId)
    .eq('job_id', jobId)
    .maybeSingle()
  if (error || !data) {
    logger.error(
      { jobId, marketResultId, rpcError: error?.code ?? 'not_found' },
      '← worker jmr load error',
    )
    throw HttpErrors.notFound('jmr_not_found', 'market result not found')
  }
  return {
    marketResultId: String(data.id),
    marketAccountId: String(data.market_account_id),
    attemptCount: typeof data.attempt_count === 'number' ? data.attempt_count : 0,
  }
}

export async function loadCredentialId(
  service: Service,
  marketAccountId: string,
  sellerId: string,
  logger: Logger,
): Promise<{ credentialId: string }> {
  const { data, error } = await service
    .from('market_credentials')
    .select('id')
    .eq('market_account_id', marketAccountId)
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .maybeSingle()
  if (error || !data) {
    logger.error(
      { marketAccountId, sellerId, rpcError: error?.code ?? 'not_found' },
      '← worker credential meta error',
    )
    throw HttpErrors.notFound('credential_not_found', 'active credential not found')
  }
  return { credentialId: String(data.id) }
}

export async function loadAccountLabel(
  service: Service,
  marketAccountId: string,
): Promise<string> {
  const labelRes = await service
    .from('market_accounts')
    .select('label')
    .eq('id', marketAccountId)
    .maybeSingle()
  return labelRes.data && typeof labelRes.data.label === 'string'
    ? labelRes.data.label
    : 'refreshed'
}

export async function loadDomainProduct(
  service: Service,
  productId: string,
  sellerId: string,
  marketId: MarketId,
): Promise<{ product: Product; mapping: MarketMapping }> {
  const productRes = await service
    .from('products')
    .select('id, seller_id, name, price, brand, description_html, shipping_policy_id')
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .single()
  if (productRes.error || !productRes.data) {
    throw HttpErrors.notFound('product_not_found', 'product not found for worker')
  }

  const imagesRes = await service
    .from('product_image_transforms')
    .select('output_path, market, status')
    .eq('product_id', productId)
    .eq('market', marketId)
    .eq('status', 'succeeded')
  if (imagesRes.error) {
    throw HttpErrors.internal('image_transforms_load_failed', 'failed to load transforms')
  }
  const transformedUrls: string[] = (imagesRes.data ?? [])
    .map((row) => (typeof row.output_path === 'string' ? row.output_path : null))
    .filter((u): u is string => Boolean(u))

  if (transformedUrls.length === 0) {
    // image-transform 미완료. validation 으로 분류 (재시도 불가 → state.md §6.2 매핑).
    throw new MarketError('validation', 'no transformed images for market', {
      market: marketId,
    })
  }

  const mappingRes = await service
    .from('product_market_mappings')
    .select('market_category_code, market_options')
    .eq('product_id', productId)
    .eq('seller_id', sellerId)
    .eq('market_id', marketId)
    .single()
  if (mappingRes.error || !mappingRes.data) {
    throw new MarketError('validation', 'market mapping not found', { market: marketId })
  }

  const product: Product = {
    id: String(productRes.data.id),
    sellerId: String(productRes.data.seller_id),
    name: String(productRes.data.name),
    priceKrw: Number(productRes.data.price),
    stock: 0,
    images: transformedUrls.map((url, idx) => ({ url, order: idx })),
    descriptionHtml: productRes.data.description_html
      ? String(productRes.data.description_html)
      : '',
    brand: productRes.data.brand ? String(productRes.data.brand) : undefined,
    shippingFeeKrw: 0,
  }

  const mapping: MarketMapping = {
    market: marketId,
    categoryId: String(mappingRes.data.market_category_code),
    transformedImageUrls: transformedUrls,
    extra: (mappingRes.data.market_options ?? {}) as Record<string, unknown>,
  }

  return { product, mapping }
}
