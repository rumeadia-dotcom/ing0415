/**
 * validate 모듈 내부 타입.
 *
 * - ValidationIssue 의 code 는 registration.md §6.2 의 화이트리스트 + 어댑터 transform 실패용 'transform_failed'.
 * - 본 타입은 응답 스키마와 동기 (registration.md §9 의 ValidationIssue 미러).
 */

import { z } from 'npm:zod@3.23.8'
import type { MarketId } from '../../_shared/index.ts'

export const ValidationIssueCodeSchema = z.enum([
  'product_name_invalid',
  'product_price_invalid',
  'category_missing',
  'category_not_leaf',
  'brand_required',
  'manufacturer_required',
  'shipping_method_unsupported',
  'image_main_missing',
  'image_size_too_small',
  'description_required',
  'market_options_missing',
  'token_expired',
  'token_revoked',
  'mapping_not_found',
  'transform_failed',
])
export type ValidationIssueCode = z.infer<typeof ValidationIssueCodeSchema>

export interface ValidationIssue {
  marketId: MarketId
  code: ValidationIssueCode
  field: string
  message: string
  hint?: string
}

export interface MarketPreview {
  marketId: MarketId
  payload: unknown
  estimatedFee: number | null
}

export interface ProductRow {
  id: string
  seller_id: string
  name: string
  price: number
  brand: string | null
  manufacturer: string | null
  description_html: string | null
  base_category_id: string
  shipping_policy_id: string | null
  // 로더가 shipping_policy_id → shipping_policies.fee 로 해소해 채운다
  // (cross-cutting/shipping-fee-model.md §3-1). 정책 미지정 시 0.
  shipping_fee: number
}

export interface MappingRow {
  market_id: string
  market_category_code: string
  market_name_override: string | null
  market_price_override: number | null
  market_options: Record<string, unknown>
}

export interface ImageRow {
  url: string
  role: 'main' | 'sub'
  sort_order: number
}
