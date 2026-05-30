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

  // ESM(gmarket/auction): 조회형 전환(esm.md "전환 결정 2026-05-30" / PR-E2·E3·E4) 후
  // 셀러가 3단계 카드(MarketOptionsCard)에서 ESM Plus 의 출하지/발송정책을 조회·선택해
  // marketOptions.shippingPlaceNo / marketOptions.dispatchPolicyNo 로 적재한다.
  // 우리 앱은 더 이상 배송 프로필을 생성·저장하지 않으므로(esm_shipping_profiles DROP),
  // 오케스트레이터는 DB 조회 없이 선택값을 transformProduct 가 읽는 extra(placeNo/
  // dispatchPolicyNo)로 매핑만 한다. PR-5 가 적재하는 officialNotice 는 보존.
  const extra = isEsmMarket(marketId)
    ? mapEsmShippingOptions(baseExtra)
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
 * 조회형(esm.md "전환 결정 2026-05-30" / PR-E2~E4) ESM 배송 선택값을 extra 로 매핑.
 *
 * 셀러가 3단계 카드(MarketOptionsCard / EsmShippingSelect)에서 ESM Plus 의 출하지·발송정책을
 * 조회·선택하면 marketOptions 에 shippingPlaceNo / dispatchPolicyNo (둘 다 string 번호) 가 적재된다.
 * transformProduct(순수 함수)는 extra.placeNo / extra.dispatchPolicyNo 를 읽으므로, 오케스트레이터는
 * 키 이름만 매핑한다. DB 조회 없음(생성형 esm_shipping_profiles 테이블 제거).
 *
 * - 선택값 미입력 시 placeNo 미주입 → transformProduct 가 validation 으로 차단(3단계
 *   makeStep3Schema 가 required 로 막지만 서버에서도 방어).
 * - 이미 placeNo/dispatchPolicyNo 가 extra 에 있으면(테스트 fixture 등) 보존한다.
 */
function mapEsmShippingOptions(
  baseExtra: Record<string, unknown>,
): Record<string, unknown> {
  const shippingPlaceNo = baseExtra['shippingPlaceNo']
  const dispatchPolicyNo = baseExtra['dispatchPolicyNo']

  const next = { ...baseExtra }
  if (typeof shippingPlaceNo === 'string' && shippingPlaceNo.length > 0) {
    next.placeNo = shippingPlaceNo
  }
  if (typeof dispatchPolicyNo === 'string' && dispatchPolicyNo.length > 0) {
    next.dispatchPolicyNo = dispatchPolicyNo
  }
  return next
}
