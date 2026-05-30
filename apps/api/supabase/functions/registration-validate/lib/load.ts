/**
 * 상품 / 이미지 / 마켓 매핑 로딩 (RLS 통과).
 *
 * - getUserClient 로 셀러 JWT 적용. service_role 사용 안 함.
 */

import {
  getUserClient,
  HttpErrors,
  type Logger,
  resolveShippingFee,
} from '../../_shared/index.ts'
import type { ImageRow, MappingRow, ProductRow } from './types.ts'

export async function loadProductBundle(
  jwt: string,
  productId: string,
  logger: Logger,
): Promise<{
  product: ProductRow
  images: ImageRow[]
  mappings: Map<string, MappingRow>
}> {
  const supabase = getUserClient(jwt)

  const productRes = await supabase
    .from('products')
    .select(
      'id, seller_id, name, price, brand, manufacturer, description_html, base_category_id, shipping_policy_id',
    )
    .eq('id', productId)
    .maybeSingle()

  if (productRes.error) {
    logger.error(
      { productId, rpcError: productRes.error.code ?? 'unknown' },
      '← validate product fetch error',
    )
    throw HttpErrors.internal('product_load_failed', 'failed to load product')
  }
  if (!productRes.data) {
    throw HttpErrors.notFound('product_not_found', 'product not found')
  }
  const productRaw = productRes.data as Omit<ProductRow, 'shipping_fee'>

  // 배송 정책(Layer 1) fee 해소 — 미리보기 배송비를 워커와 동일하게 맞춘다
  // (cross-cutting/shipping-fee-model.md §3-1).
  const shippingFee = await resolveShippingFee(
    supabase,
    productRaw.shipping_policy_id,
    productRaw.seller_id,
  )
  const product: ProductRow = { ...productRaw, shipping_fee: shippingFee }

  const imagesRes = await supabase
    .from('product_images')
    .select('storage_path, role, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (imagesRes.error) {
    throw HttpErrors.internal('images_load_failed', 'failed to load product images')
  }
  const images: ImageRow[] = (imagesRes.data ?? []).map((row) => ({
    url: String(row.storage_path),
    role: row.role === 'main' ? 'main' : 'sub',
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
  }))

  const mappingsRes = await supabase
    .from('product_market_mappings')
    .select(
      'market_id, market_category_code, market_name_override, market_price_override, market_options',
    )
    .eq('product_id', productId)

  if (mappingsRes.error) {
    throw HttpErrors.internal('mappings_load_failed', 'failed to load market mappings')
  }
  const mappings = new Map<string, MappingRow>()
  for (const row of mappingsRes.data ?? []) {
    mappings.set(String(row.market_id), {
      market_id: String(row.market_id),
      market_category_code: String(row.market_category_code),
      market_name_override: row.market_name_override
        ? String(row.market_name_override)
        : null,
      market_price_override:
        typeof row.market_price_override === 'number'
          ? row.market_price_override
          : null,
      market_options: (row.market_options ?? {}) as Record<string, unknown>,
    })
  }

  return { product, images, mappings }
}
