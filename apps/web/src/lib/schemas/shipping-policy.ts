import { z } from 'zod'
import { ShippingMethodSchema } from './registration'

/**
 * 배송 정책 (shipping_policies) zod 스키마 — 단일 ground truth.
 *
 * 마스터:
 *  - docs/architecture/v1/features/registration.md §3.2 shipping_policies
 *  - PRD §1.1.4 기본 배송 정보 입력
 *
 * 사용처:
 *  - RHF resolver: SettingsPoliciesPage 의 신규/수정 다이얼로그 폼
 *  - Supabase insert / update: useCreateShippingPolicy / useUpdateShippingPolicy
 *
 * method ENUM 은 schemas/registration.ts 의 ShippingMethodSchema 를 그대로 재사용
 * (도메인 ENUM 단일 소스 규약).
 */

export const ShippingPolicyMethodSchema = ShippingMethodSchema
export type ShippingPolicyMethod = z.infer<typeof ShippingPolicyMethodSchema>

export const ShippingPolicyFormSchema = z.object({
  name: z
    .string()
    .min(1, '정책명을 입력해주세요')
    .max(50, '정책명은 50자 이하'),
  method: ShippingPolicyMethodSchema,
  fee: z
    .number({ invalid_type_error: '배송비를 숫자로 입력해주세요' })
    .int('배송비는 정수로 입력해주세요')
    .min(0, '배송비는 0원 이상'),
  etaDays: z
    .number({ invalid_type_error: '예상 배송일수를 숫자로 입력해주세요' })
    .int('예상 배송일수는 정수로 입력해주세요')
    .min(1, '예상 배송일수는 1일 이상')
    .max(30, '예상 배송일수는 30일 이하'),
  isDefault: z.boolean(),
})

export type ShippingPolicyForm = z.infer<typeof ShippingPolicyFormSchema>
