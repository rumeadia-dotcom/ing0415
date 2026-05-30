/**
 * 배송 정책(Layer 1) fee 해소 — 워커/validate 공용.
 *
 * 마스터: docs/architecture/v1/cross-cutting/shipping-fee-model.md
 *   - Layer 1(배송 정책 = 요금 의도)의 fee 를 product.shipping_policy_id 로 조회.
 *   - 기존엔 워커(data-load.ts)·validate(check.ts) 양쪽이 shippingFeeKrw 를 0 으로
 *     하드코딩하여, 셀러가 고른 배송비가 등록/미리보기에 반영되지 않던 버그 (§3-1).
 *
 * 강제:
 *   - shipping_policy_id 가 null → 0 (배송정책 미지정 = 무료 기본).
 *   - seller_id WHERE 필수 (cross-tenant 차단). 정책 미존재 / 타 셀러 소유 / fee
 *     비정상이면 0 (방어). service_role / user(JWT RLS) 클라이언트 모두 동작.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

export async function resolveShippingFee(
  client: SupabaseClient,
  shippingPolicyId: string | null,
  sellerId: string,
): Promise<number> {
  if (!shippingPolicyId) return 0
  const { data, error } = await client
    .from('shipping_policies')
    .select('fee')
    .eq('id', shippingPolicyId)
    .eq('seller_id', sellerId)
    .maybeSingle()
  if (error || !data || typeof data.fee !== 'number') return 0
  return data.fee
}
