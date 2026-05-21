import { z } from 'zod'

/**
 * 로젠택배 자격증명 + 발송인 정보 zod 스키마.
 *
 * 마스터:
 *  - docs/spec/PRD-v2-shipping.md §2.2 (registerOrderData 입력 — sndCustNm / sndCustAddr / sndTelNo / fareTy / dlvFare)
 *  - docs/spec/PRD-v2-shipping.md §3 (인증 — userId / custCd)
 *  - docs/spec/PRD-v2-shipping.md §4 (logen_credentials DDL)
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
// 자격증명 + 발송인 UPSERT 입력 (set_logen_credentials RPC 호출 직전 RHF/parse)
//   userId / custCd 는 평문으로 한 번만 흐른다 (입력 → Edge Function → pgp_sym_encrypt).
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
    sender: LogenSenderInfoSchema,
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
