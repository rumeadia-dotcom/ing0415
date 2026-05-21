/**
 * 로젠택배 Open API zod 스키마 (런타임 검증 단일 소스).
 *
 * 마스터:
 *   - docs/spec/PRD.md §6.2, §6.3, §7
 *   - Logen Open API 명세 (B2B): /lrm02b-edi/edi/{getSlipNo, registerOrderData,
 *     outSlipPrintPop, inquirySlipNoMulti}
 *
 * 강제:
 *   - 4 메서드 req / res 응답은 모두 본 파일 스키마로 parse 후 도메인 객체로 반환.
 *   - 응답에 알 수 없는 필드가 와도 throw 하지 않고 무시 (.passthrough 사용하지 않음 — 명시 필드만).
 *   - resultCd 정상값은 '00' / 'OK' / 'SUCCESS' 등 환경에 따라 다를 수 있으므로
 *     본 스키마는 형식만 검증하고 성공·실패 판정은 client.ts 가 담당.
 */

import { z } from 'zod'

// ─────────────────────────────────────────────
// 공통 — Logen API 응답 공통 필드
// ─────────────────────────────────────────────

/**
 * 로젠 응답 공통 — resultCd 가 모든 응답에 포함된다.
 * 일부 응답은 resultMsg / errorMsg / errMsg 형태로 메시지를 함께 반환.
 */
const LogenResultMetaSchema = z.object({
  resultCd: z.string().min(1),
  resultMsg: z.string().optional(),
  errorMsg: z.string().optional(),
  errMsg: z.string().optional(),
})

// ─────────────────────────────────────────────
// 1) getSlipNo — 운송장번호 채번
// ─────────────────────────────────────────────

export const GetSlipNoReqSchema = z.object({
  /** 연동업체코드 — Edge Function env / credentials 에서 주입 */
  userId: z.string().min(1),
  /** 채번할 운송장 수량 (1 이상) */
  slipQty: z.number().int().min(1).max(1000),
})
export type GetSlipNoReq = z.infer<typeof GetSlipNoReqSchema>

/**
 * 실제 Logen API 응답 모양:
 *   { resultCd: '00', startSlipNo: '1234567890', closeSlipNo: '1234567899',
 *     slipNo: ['1234567890', ...] }
 * 일부 환경에서는 slipNoList 로 내려올 수 있어 두 키 모두 수용.
 */
export const GetSlipNoResSchema = LogenResultMetaSchema.extend({
  startSlipNo: z.string().optional(),
  closeSlipNo: z.string().optional(),
  slipNo: z.array(z.string()).optional(),
  slipNoList: z.array(z.string()).optional(),
})
export type GetSlipNoRes = z.infer<typeof GetSlipNoResSchema>

/** 도메인 반환 모양 — client.ts 가 normalize 후 반환. */
export const GetSlipNoResultSchema = z.object({
  startSlipNo: z.string().min(1),
  closeSlipNo: z.string().min(1),
  slipNo: z.array(z.string().min(1)).min(1),
})
export type GetSlipNoResult = z.infer<typeof GetSlipNoResultSchema>

// ─────────────────────────────────────────────
// 2) registerOrderData — 집하 예약 등록 (주문 1건)
// ─────────────────────────────────────────────

/**
 * 주문 1건 등록 req — PRD §2.2 필드 그대로.
 * 발송인 / 수취인 / 운임 / 운송장번호.
 *
 * 모든 텍스트 필드 길이 상한은 Logen API 명세에 맞추되 정확한 byte 제한은
 * 마켓별 quirks 로 client.ts 가 추가 검증. zod 는 형식·길이만.
 */
export const RegisterOrderDataReqSchema = z.object({
  userId: z.string().min(1),
  custCd: z.string().min(1),
  /** 집하 희망일 (YYYYMMDD) */
  takeDt: z.string().regex(/^\d{8}$/, 'takeDt는 YYYYMMDD 8자리'),

  // 발송인 정보 (셀러 logen_credentials 에서 주입)
  sndCustNm: z.string().min(1).max(50),
  sndCustAddr: z.string().min(1).max(200),
  sndTelNo: z.string().min(1).max(20),

  // 수취인 정보 (주문에서)
  rcvCustNm: z.string().min(1).max(50),
  rcvCustAddr: z.string().min(1).max(200),
  rcvTelNo: z.string().min(1).max(20),

  /** 운임 구분 — 'C'(착불) | 'S'(선불) 등. PRD §6 OQ-V2-04 확정 전까지 free string. */
  fareTy: z.string().min(1).max(2),
  /** 수량 */
  qty: z.number().int().min(1).max(9999),
  /** 운임 (원) */
  dlvFare: z.number().int().min(0),

  /** 주문 식별자 (셀러측 PK). 응답으로 echo 됨. */
  fixTakeNo: z.string().min(1).max(50),
  /** 사전 채번된 운송장번호 */
  slipNo: z.string().min(1).max(20),

  /** 품목명 (선택) */
  goodsNm: z.string().max(100).optional(),
  /** 비고 (선택) */
  remark: z.string().max(200).optional(),
})
export type RegisterOrderDataReq = z.infer<typeof RegisterOrderDataReqSchema>

export const RegisterOrderDataResSchema = LogenResultMetaSchema.extend({
  fixTakeNo: z.string().optional(),
  slipNo: z.string().optional(),
})
export type RegisterOrderDataRes = z.infer<typeof RegisterOrderDataResSchema>

export const RegisterOrderDataResultSchema = z.object({
  fixTakeNo: z.string().min(1),
  resultCd: z.string().min(1),
})
export type RegisterOrderDataResult = z.infer<typeof RegisterOrderDataResultSchema>

// ─────────────────────────────────────────────
// 3) outSlipPrintPop — 운송장 출력 팝업 URL 빌더
//    (GET 호출, 응답 = HTML 팝업. 본 SDK 는 URL 만 빌드 후 브라우저에서 open.)
// ─────────────────────────────────────────────

export const BuildPrintPopupUrlReqSchema = z.object({
  /** 출력 대상 집하일자 (YYYYMMDD) */
  takeDt: z.string().regex(/^\d{8}$/, 'takeDt는 YYYYMMDD 8자리'),
})
export type BuildPrintPopupUrlReq = z.infer<typeof BuildPrintPopupUrlReqSchema>

// ─────────────────────────────────────────────
// 4) inquirySlipNoMulti — 출력 송장번호 재조회 (fallback)
// ─────────────────────────────────────────────

export const InquirySlipNoMultiReqSchema = z.object({
  slipNos: z.array(z.string().min(1)).min(1).max(100),
})
export type InquirySlipNoMultiReq = z.infer<typeof InquirySlipNoMultiReqSchema>

const InquirySlipNoMultiItemSchema = z.object({
  slipNo: z.string().min(1),
  /** 출력 상태 — 'Y' / 'N' / 'PRINTED' 등 환경에 따라 다름. 형식만 검증. */
  status: z.string().min(1),
})

export const InquirySlipNoMultiResSchema = LogenResultMetaSchema.extend({
  // 응답 형식이 환경에 따라 list / data / items 중 하나일 수 있어 모두 수용.
  list: z.array(InquirySlipNoMultiItemSchema).optional(),
  data: z.array(InquirySlipNoMultiItemSchema).optional(),
  items: z.array(InquirySlipNoMultiItemSchema).optional(),
})
export type InquirySlipNoMultiRes = z.infer<typeof InquirySlipNoMultiResSchema>

export const InquirySlipNoMultiResultSchema = z.object({
  slipNo: z.array(z.string().min(1)),
  status: z.array(z.string().min(1)),
})
export type InquirySlipNoMultiResult = z.infer<typeof InquirySlipNoMultiResultSchema>

// ─────────────────────────────────────────────
// verify-credential Edge Function 응답 — FE / Edge 공유
// ─────────────────────────────────────────────

export const LogenVerifyRequestSchema = z.object({
  /** Logen 연동업체코드 */
  userId: z.string().min(1).max(50),
  /** Logen 거래처코드 */
  custCd: z.string().min(1).max(50),
})
export type LogenVerifyRequest = z.infer<typeof LogenVerifyRequestSchema>

export const LogenVerifyResponseSchema = z.object({
  status: z.enum(['active', 'unauthorized', 'error']),
  verifiedAt: z.string(),
  correlationId: z.string(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
})
export type LogenVerifyResponse = z.infer<typeof LogenVerifyResponseSchema>
