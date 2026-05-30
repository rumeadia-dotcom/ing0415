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
  resolveShippingFee,
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

  // 배송 정책(Layer 1) 의 fee 를 해소 — 기존엔 0 하드코딩 버그
  // (cross-cutting/shipping-fee-model.md §3-1).
  const shippingPolicyId =
    typeof productRes.data.shipping_policy_id === 'string'
      ? productRes.data.shipping_policy_id
      : null
  const shippingFeeKrw = await resolveShippingFee(service, shippingPolicyId, sellerId)

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
    shippingFeeKrw,
  }

  const baseExtra = (mappingRes.data.market_options ?? {}) as Record<
    string,
    unknown
  >

  // ESM(gmarket/auction): marketOptions.shippingProfileId 로 esm_shipping_profiles
  // (service_role) 조회 → 배송 프로필 번호(placeNo/dispatchPolicyNo/bundlePolicyNo)를
  // mapping.extra 에 주입. transformProduct 는 순수 함수이므로 조회는 오케스트레이터가 맡는다
  // (esm.md §7 PR-4). PR-5 가 적재하는 officialNotice 는 marketOptions 에 이미 있으면 보존.
  const extra = isEsmMarket(marketId)
    ? await injectEsmShippingProfile(service, sellerId, marketId, baseExtra)
    : baseExtra

  const mapping: MarketMapping = {
    market: marketId,
    categoryId: String(mappingRes.data.market_category_code),
    transformedImageUrls: transformedUrls,
    extra,
  }

  return { product, mapping }
}

function isEsmMarket(market: MarketId): boolean {
  return market === 'gmarket' || market === 'auction'
}

/**
 * marketOptions.shippingProfileId → esm_shipping_profiles 조회 후 번호를 extra 에 주입.
 *
 * - service_role 조회 + seller_id WHERE 강제 (cross-tenant 차단).
 * - status='active' 프로필만 사용 (error/부분 실패 row 는 등록 차단).
 * - place_no / dispatch_policy_no 누락(active 인데 NULL — partial CHECK 가 막지만 방어) 시 validation.
 * - shippingProfileId 자체가 없으면 placeNo 미주입 → transformProduct 가 validation 으로 차단.
 */
async function injectEsmShippingProfile(
  service: Service,
  sellerId: string,
  marketId: MarketId,
  baseExtra: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const shippingProfileId = baseExtra['shippingProfileId']
  if (typeof shippingProfileId !== 'string' || shippingProfileId.length === 0) {
    // 프로필 미선택 — 번호 주입 없이 그대로. transformProduct 가 누락을 validation 으로 차단.
    return baseExtra
  }

  const { data, error } = await service
    .from('esm_shipping_profiles')
    .select('place_no, dispatch_policy_no, bundle_policy_no, status')
    .eq('id', shippingProfileId)
    .eq('seller_id', sellerId)
    .maybeSingle()

  if (error || !data) {
    throw new MarketError('validation', 'esm shipping profile not found', {
      market: marketId,
    })
  }
  if (data.status !== 'active') {
    throw new MarketError(
      'validation',
      'esm shipping profile not active (부분 실패 프로필)',
      { market: marketId },
    )
  }
  const placeNo = typeof data.place_no === 'string' ? data.place_no : null
  const dispatchPolicyNo =
    typeof data.dispatch_policy_no === 'string' ? data.dispatch_policy_no : null
  if (!placeNo || !dispatchPolicyNo) {
    throw new MarketError(
      'validation',
      'esm shipping profile missing place_no/dispatch_policy_no',
      { market: marketId },
    )
  }

  return {
    ...baseExtra,
    placeNo,
    dispatchPolicyNo,
    ...(typeof data.bundle_policy_no === 'string'
      ? { bundlePolicyNo: data.bundle_policy_no }
      : {}),
  }
}
