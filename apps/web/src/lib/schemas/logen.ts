import { z } from 'zod'

/**
 * 로젠택배 자격증명 / 발송인 정보 / 셀러 설정 zod 스키마.
 *
 * 마스터: docs/spec/PRD-v2-shipping.md §4 (logen_credentials)
 *
 * - 클라이언트는 평문 자격증명을 다루되, Supabase 로 전송된 후 pgcrypto 로 즉시 암호화 저장
 *   (set_logen_credentials RPC 책임). 클라이언트가 SELECT 로 평문을 다시 받지는 않는다.
 * - 발송인 정보 / fareTy / dlvFare 는 평문 컬럼.
 * - "출력 후 자동 제출" 토글은 본 스키마와 별개의 seller_settings 컬럼 (PR2 에서 마이그레이션).
 *
 * 본 스키마는 RHF resolver + RPC payload parse + verify Edge Function payload 에 공통 사용.
 */

// ─────────────────────────────────────────────
// 1. 자격증명 입력 (n59)
// ─────────────────────────────────────────────

export const LogenCredentialsInputSchema = z.object({
  userId: z
    .string()
    .min(1, 'userId(연동업체코드)를 입력하세요')
    .max(50, '50자 이내로 입력하세요')
    .regex(/^[A-Za-z0-9_-]+$/, '영문/숫자/언더스코어/하이픈만 허용됩니다'),
  custCd: z
    .string()
    .min(1, 'custCd(거래처코드)를 입력하세요')
    .max(50, '50자 이내로 입력하세요')
    .regex(/^[A-Za-z0-9_-]+$/, '영문/숫자/언더스코어/하이픈만 허용됩니다'),
})
export type LogenCredentialsInput = z.infer<typeof LogenCredentialsInputSchema>

// ─────────────────────────────────────────────
// 2. 발송인 정보 (n60)
// ─────────────────────────────────────────────

/** 로젠 운임 타입 — 계약 시 확정값. v2 기본 'C' (선불 / 계약). */
export const FareTySchema = z.enum(['C', 'S', 'R']).default('C')
export type FareTy = z.infer<typeof FareTySchema>

export const LogenSenderInfoSchema = z.object({
  senderName: z
    .string()
    .min(1, '발송인명을 입력하세요')
    .max(40, '40자 이내로 입력하세요'),
  senderAddress: z
    .string()
    .min(5, '발송지 주소를 5자 이상 입력하세요')
    .max(200, '200자 이내로 입력하세요'),
  senderPhone: z
    .string()
    .min(9, '연락처는 9자 이상 입력하세요')
    .max(20, '20자 이내로 입력하세요')
    .regex(/^[0-9+\-() ]+$/, '숫자·+·-·괄호·공백만 허용됩니다'),
  fareTy: FareTySchema,
  dlvFare: z
    .number({ invalid_type_error: '숫자로 입력하세요' })
    .int('정수로 입력하세요')
    .min(0, '0 이상이어야 합니다')
    .max(100000, '100000 이하로 입력하세요'),
})
export type LogenSenderInfo = z.infer<typeof LogenSenderInfoSchema>

// ─────────────────────────────────────────────
// 3. 자격증명 + 발송인 정보 통합 (set_logen_credentials RPC payload)
// ─────────────────────────────────────────────

/**
 * RPC `set_logen_credentials` 의 입력 payload. PR2 의 마이그레이션이 정의.
 * 본 PR 에서는 시그니처만 zod 로 명시 (RPC 자체는 PR2 가 제공).
 *
 * - userId/custCd 는 Edge runtime 에서 pgcrypto 로 암호화 → user_id_enc / cust_cd_enc 컬럼 저장.
 * - 발송인 정보 일체는 평문 컬럼.
 * - 부분 갱신: senderInfo 단독 / credentials 단독 호출 가능.
 */
export const SetLogenCredentialsArgsSchema = z.object({
  credentials: LogenCredentialsInputSchema.optional(),
  senderInfo: LogenSenderInfoSchema.optional(),
}).refine(
  (v) => v.credentials !== undefined || v.senderInfo !== undefined,
  '자격증명 또는 발송인 정보 중 하나는 입력해야 합니다',
)
export type SetLogenCredentialsArgs = z.infer<typeof SetLogenCredentialsArgsSchema>

// ─────────────────────────────────────────────
// 4. 자격증명 상태 (SELECT 응답 — 평문은 절대 반환 안 함)
// ─────────────────────────────────────────────

export const LogenCredentialsStatusSchema = z.object({
  /** 자격증명(userId/custCd) 등록 여부. true 면 양쪽 enc 컬럼 채워짐. */
  hasCredentials: z.boolean(),
  /** 발송인 정보 완성도 — name/address/phone/fareTy/dlvFare 모두 존재. */
  hasSenderInfo: z.boolean(),
  /** 마지막 연결 테스트 (logen-verify-credential) 성공 시각. null 이면 미검증. */
  lastVerifiedAt: z.string().nullable(),
  /** 마지막 검증 실패 시각. */
  lastErrorAt: z.string().nullable(),
  /** 마지막 검증 실패 코드 (예: 'invalid_credentials' | 'contract_not_active'). */
  lastErrorCode: z.string().nullable(),
  /** 발송인 정보 (있을 때만 평문 반환). */
  senderInfo: LogenSenderInfoSchema.nullable(),
})
export type LogenCredentialsStatus = z.infer<typeof LogenCredentialsStatusSchema>

// ─────────────────────────────────────────────
// 5. 연결 테스트 (logen-verify-credential Edge Function)
// ─────────────────────────────────────────────

export const LogenVerifyRequestSchema = z.object({
  /**
   * 저장된 자격증명으로 테스트할지, 새 자격증명으로 테스트할지 선택.
   * - 'stored': DB 의 user_id_enc / cust_cd_enc 사용. 저장된 값 검증.
   * - 'inline': 본 요청에 포함된 credentials 사용 (저장 전 시험용).
   */
  source: z.enum(['stored', 'inline']),
  credentials: LogenCredentialsInputSchema.optional(),
}).refine(
  (v) => v.source === 'stored' || v.credentials !== undefined,
  'inline 검증 시 credentials 가 필요합니다',
)
export type LogenVerifyRequest = z.infer<typeof LogenVerifyRequestSchema>

export const LogenVerifyResponseSchema = z.object({
  ok: z.literal(true),
  /** verify 시각 (서버) — ISO 8601. */
  verifiedAt: z.string(),
  /** 응답 구조 단순화 (계약 활성·잔여 운송장 슬릿 수 등 확장 여지). */
  contractActive: z.boolean().optional(),
})
export type LogenVerifyResponse = z.infer<typeof LogenVerifyResponseSchema>

/** Edge Function 에러 페이로드 — markets-feature 와 동일 포맷 유지. */
export const LogenApiErrorSchema = z.object({
  code: z.enum([
    'invalid_credentials',
    'contract_not_active',
    'rate_limited',
    'unauthenticated',
    'internal',
    'validation_failed',
    'network_error',
  ]),
  message: z.string(),
  correlationId: z.string().optional(),
})
export type LogenApiError = z.infer<typeof LogenApiErrorSchema>

// ─────────────────────────────────────────────
// 6. 셀러 설정 — "출력 후 자동 제출"
// ─────────────────────────────────────────────

export const ShippingAutoDispatchSettingSchema = z.object({
  /** 운송장 출력 완료 시 마켓 송장 제출을 자동 트리거할지. */
  autoDispatchAfterPrint: z.boolean(),
})
export type ShippingAutoDispatchSetting = z.infer<
  typeof ShippingAutoDispatchSettingSchema
>
