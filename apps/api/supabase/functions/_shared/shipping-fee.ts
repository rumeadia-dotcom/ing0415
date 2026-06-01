/**
 * 배송 설정 해소 — 워커/validate 공용. (C9: shipping_policies.fee 조회 → products.shipping_config 파싱.)
 * 마스터: docs/superpowers/specs/2026-06-01-quantity-tiered-shipping-design.md §2.
 */

import { ShippingConfigSchema, type ShippingConfig } from './schemas.ts'

/** products.shipping_config(jsonb) → 검증된 ShippingConfig. 비정상 → null(방어). */
export function parseShippingConfig(raw: unknown): ShippingConfig | null {
  const r = ShippingConfigSchema.safeParse(raw)
  return r.success ? r.data : null
}
