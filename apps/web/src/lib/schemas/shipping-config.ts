import { z } from 'zod'
import { ShippingMethodSchema, MARKET_IDS } from './common'

/**
 * 배송 설정(상품 인라인) — zod 단일 소스.
 * RHF resolver + Supabase products.shipping_config insert + 서버 응답 parse 3중 재사용.
 * 마스터: docs/superpowers/specs/2026-06-01-quantity-tiered-shipping-design.md §2.
 * Edge 미러: apps/api/supabase/functions/_shared/schemas.ts (동형 유지).
 *
 * NOTE: 기존 shipping.ts 는 "송장 일괄 제출(ShippingJob)" 도메인 전용이므로 별도 파일 사용.
 */

export const ShippingFeeTypeSchema = z.enum([
  'free',
  'conditional_free',
  'paid',
  'quantity_tiered',
  'charge_on_delivery',
])
export type ShippingFeeType = z.infer<typeof ShippingFeeTypeSchema>

export const ShippingBoxSchema = z.object({
  qtyPerBox: z.number().int().min(2, '박스당 수량은 2개 이상'),
  feePerBox: z.number().int().min(0, '박스당 배송비는 0원 이상'),
})
export type ShippingBox = z.infer<typeof ShippingBoxSchema>

export const ShippingConfigSchema = z
  .object({
    method: ShippingMethodSchema,
    etaDays: z.number().int().min(0).max(30),
    feeType: ShippingFeeTypeSchema,
    baseFee: z.number().int().min(0).default(0),
    freeThreshold: z.number().int().min(0).optional(),
    box: ShippingBoxSchema.optional(),
    payType: z.enum(['prepaid', 'collect', 'both']).default('prepaid'),
    returnFee: z.number().int().min(0).optional(),
    exchangeFee: z.number().int().min(0).optional(),
    areaSurcharge: z
      .object({
        jeju: z.number().int().min(0),
        island: z.number().int().min(0),
      })
      .optional(),
    bundleAllowed: z.boolean().default(false),
    marketOverrides: z
      .record(
        z.enum(MARKET_IDS),
        z.object({
          feeType: ShippingFeeTypeSchema,
          baseFee: z.number().int().min(0),
        }),
      )
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.feeType === 'paid' && v.baseFee <= 0)
      ctx.addIssue({
        code: 'custom',
        message: '유료배송은 기본배송비가 필요합니다',
        path: ['baseFee'],
      })
    if (v.feeType === 'conditional_free' && v.freeThreshold == null)
      ctx.addIssue({
        code: 'custom',
        message: '무료조건 금액이 필요합니다',
        path: ['freeThreshold'],
      })
    if (v.feeType === 'quantity_tiered' && v.box == null)
      ctx.addIssue({
        code: 'custom',
        message: '박스 설정이 필요합니다',
        path: ['box'],
      })
  })

export type ShippingConfig = z.infer<typeof ShippingConfigSchema>

/** 배송 템플릿(shipping_policies 재편) — config + 이름 + 기본여부. */
export const ShippingTemplateSchema = ShippingConfigSchema.and(
  z.object({
    name: z.string().min(1, '템플릿 이름을 입력해주세요').max(50, '이름은 50자 이하'),
    isDefault: z.boolean(),
  }),
)
export type ShippingTemplate = z.infer<typeof ShippingTemplateSchema>

/** feeType 별 폼 초기값 헬퍼 (UI/마이그 backfill 기본값과 동형). */
export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  method: 'parcel',
  etaDays: 3,
  feeType: 'free',
  baseFee: 0,
  payType: 'prepaid',
  bundleAllowed: false,
}
