import { z } from 'zod'

/**
 * 로젠택배 자격증명 + 발송인 정보 zod 스키마.
 *
 * 마스터:
 *  - docs/spec/PRD.md §6.2 (registerOrderData 입력 — sndCustNm / sndCustAddr / sndTelNo / fareTy / dlvFare)
 *  - docs/spec/PRD.md §7 (인증 — userId / custCd)
 *  - docs/spec/PRD.md §8 (logen_credentials DDL)
 *
 * 마이그레이션 동기화 대상:
 *  - 20260521000003_logen_credentials.sql
 *  - 20260521000005_logen_credentials_rpc.sql (set_logen_credentials RPC)
 *
 * 보안 주의:
 *  - userId / custCd 는 클라이언트 → Edge Function → set_logen_credentials RPC 한 방향으로만 흐른다.
 *    응답에 절대 평문이 돌아오지 않는다. LogenCredentialsInputSchema 는 입력 전용.
 */

// ─────────────────────────────────────────────
// 발송인 정보 (registerOrderData 의 sndCustNm / sndCustAddr / sndTelNo / fareTy / dlvFare)
//   GET/PATCH 양방향에서 사용. 평문 노출 가능 (셀러 본인 정보).
// ─────────────────────────────────────────────
export const LogenSenderInfoSchema = z.object({
  name: z
    .string()
    .min(1, '발송인 이름은 1자 이상')
    .max(50, '발송인 이름은 50자 이하'),
  address: z
    .string()
    .min(1, '발송지 주소를 입력해주세요')
    .max(500, '발송지 주소는 500자 이하'),
  phone: z
    .string()
    .min(1, '발송인 연락처를 입력해주세요')
    .max(30, '발송인 연락처는 30자 이하'),
  /**
   * fareTy:
   *  C = 신용 (계약 기본)
   *  P = 선불
   *  M = 착불
   * PRD-v2 §6 OQ-V2-04 확정 전까지 'C' 기본.
   */
  fareTy: z.enum(['C', 'P', 'M']).default('C'),
  /** 운임 (KRW). 0 이상 정수. */
  dlvFare: z.number().int().min(0).default(0),
})
export type LogenSenderInfo = z.infer<typeof LogenSenderInfoSchema>

// ─────────────────────────────────────────────
// 자격증명 입력 (set_logen_credentials RPC 호출 직전 RHF/parse)
//   userId / custCd 는 평문으로 한 번만 흐른다 (입력 → Edge Function → pgp_sym_encrypt).
//   발송인 정보는 별도 화면(n60) 에서 LogenSenderInfoSchema 로 단독 저장.
// ─────────────────────────────────────────────
export const LogenCredentialsInputSchema = z
  .object({
    userId: z
      .string()
      .min(1, 'userId(연동업체코드)를 입력해주세요')
      .max(100, 'userId 가 너무 깁니다'),
    custCd: z
      .string()
      .min(1, 'custCd(거래처코드)를 입력해주세요')
      .max(100, 'custCd 가 너무 깁니다'),
  })
  .strict()
export type LogenCredentialsInput = z.infer<typeof LogenCredentialsInputSchema>

// ─────────────────────────────────────────────
// 자격증명 연결 검증 응답 (verify 엔드포인트)
//   - ok=true 면 로젠 호출 1회로 연결 가능 확인
//   - 실패 시 error 코드 + 마스킹된 메시지만 노출. raw 응답 금지.
// ─────────────────────────────────────────────
export const LogenVerifyResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    /** 연결 가능 여부 + 회전 시각 (epoch ms 또는 ISO). */
    verifiedAt: z.string().datetime(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      /** logen_invalid_credentials | logen_network_error | logen_rate_limited | logen_unknown */
      code: z.enum([
        'logen_invalid_credentials',
        'logen_network_error',
        'logen_rate_limited',
        'logen_unknown',
      ]),
      message: z.string().max(500),
    }),
  }),
])
export type LogenVerifyResponse = z.infer<typeof LogenVerifyResponseSchema>

// ═════════════════════════════════════════════
// PR8/PR10 정합용 추가 스키마
//   - 페이지/hook/api 가 요구하는 모양 (ko.settings.shipping.errors 키와 1:1).
//   - PR2 의 ground truth (위 4개 스키마) 를 view 표현하는 별칭/확장.
// ═════════════════════════════════════════════

// ─────────────────────────────────────────────
// LogenApiError — 클라이언트 ↔ Edge Function 간 표준 에러 표현
//   code 가 ko.settings.shipping.errors 의 key 와 1:1 (i18n hit)
// ─────────────────────────────────────────────
export const LOGEN_API_ERROR_CODES = [
  'invalid_credentials',
  'contract_not_active',
  'rate_limited',
  'unauthenticated',
  'validation_failed',
  'network_error',
  'internal',
] as const
export const LogenApiErrorSchema = z.object({
  code: z.enum(LOGEN_API_ERROR_CODES),
  message: z.string().max(500),
  /** 디버깅 보조 — 절대 PII 미포함. */
  correlationId: z.string().optional().nullable(),
})
export type LogenApiError = z.infer<typeof LogenApiErrorSchema>

// ─────────────────────────────────────────────
// LogenCredentialsStatus — get_logen_credentials_status RPC 응답
//   평문 자격증명은 절대 포함 안 됨 — 보유 여부와 메타 시각만.
// ─────────────────────────────────────────────
export const LogenCredentialsStatusSchema = z.object({
  hasCredentials: z.boolean(),
  hasSenderInfo: z.boolean(),
  lastVerifiedAt: z.string().nullable(),
  lastErrorAt: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  /** 발송인 정보는 평문이 가능 (셀러 본인 정보). 미설정 시 null. */
  senderInfo: LogenSenderInfoSchema.nullable(),
})
export type LogenCredentialsStatus = z.infer<typeof LogenCredentialsStatusSchema>

// ─────────────────────────────────────────────
// LogenVerifyRequest — logen-verify-credential Edge Function 본문
//   - source='inline': 화면에서 방금 입력한 credentials 로 검증 (저장 직후 동일 값 재검증)
//   - source='stored': DB 저장 credentials 로 검증 (재확인)
// ─────────────────────────────────────────────
export const LogenVerifyRequestSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('inline'),
    credentials: LogenCredentialsInputSchema,
  }),
  z.object({
    source: z.literal('stored'),
  }),
])
export type LogenVerifyRequest = z.infer<typeof LogenVerifyRequestSchema>

// ─────────────────────────────────────────────
// SetLogenCredentialsArgs — set_logen_credentials RPC 인자
//   credentials 또는 senderInfo 중 하나 이상 (부분 갱신).
// ─────────────────────────────────────────────
export const SetLogenCredentialsArgsSchema = z
  .object({
    credentials: LogenCredentialsInputSchema.optional(),
    senderInfo: LogenSenderInfoSchema.optional(),
  })
  .refine((d) => d.credentials !== undefined || d.senderInfo !== undefined, {
    message: 'credentials 또는 senderInfo 중 하나 이상 필요',
  })
export type SetLogenCredentialsArgs = z.infer<
  typeof SetLogenCredentialsArgsSchema
>

// ─────────────────────────────────────────────
// ShippingAutoDispatchSetting — sellers.auto_dispatch_after_print
// ─────────────────────────────────────────────
export const ShippingAutoDispatchSettingSchema = z.object({
  autoDispatchAfterPrint: z.boolean(),
})
export type ShippingAutoDispatchSetting = z.infer<
  typeof ShippingAutoDispatchSettingSchema
>
