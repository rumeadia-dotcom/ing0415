/**
 * 로젠택배 OpenAPI 타입 정의 (logen-register-shipment 전용).
 *
 * 마스터:
 *   - docs/spec/PRD-v2-shipping.md §2.2 / §3 (API 명세)
 *
 * 비고:
 *   - PR3 가 본 모듈을 `_shared/logen/` 으로 끌어올려 logen-verify-credential / outSlipPrintPop /
 *     setShipInfo 까지 공유 가능하게 리팩터 예정. 그 때까지 본 PR 내부에만 존재.
 *   - 로젠 응답은 마켓 API 변덕에 대비해 모두 zod 로 런타임 검증.
 */

import { z } from 'npm:zod@3.23.8'

/** 발송인 정보 (logen_credentials 에 셀러가 사전 등록한 값) */
export interface LogenSender {
  readonly name: string
  readonly address: string
  readonly phone: string
}

/** 운임 정보 — PRD-v2 OQ-V2-04 (계약 시 확정값). 기본 'C'(착불) / 0. */
export interface LogenFareConfig {
  /** 운임 구분: 'C'(착불) | 'P'(선불) | 'B'(신용) */
  readonly fareTy: string
  /** 운임 (원). 0 이면 무료/계약에 따라 산정. */
  readonly dlvFare: number
}

/** 자격증명 — Edge Function 진입 후 logen_credentials 에서 복호. */
export interface LogenCredential {
  readonly userId: string
  readonly custCd: string
  readonly sender: LogenSender
  readonly fare: LogenFareConfig
}

// ── getSlipNo ───────────────────────────────────────────────────────

export const SlipNoResponseSchema = z.object({
  startSlipNo: z.string().min(1),
  closeSlipNo: z.string().min(1),
  // 일부 환경에서는 slipNo 배열을 직접 내려준다. 누락 시 start/close 범위에서 산출.
  slipNo: z.array(z.string()).optional(),
})

export type SlipNoResponse = z.infer<typeof SlipNoResponseSchema>

// ── registerOrderData ───────────────────────────────────────────────

/**
 * registerOrderData 요청 — 주문 1건 분.
 *
 * 필드명은 로젠 OpenAPI 그대로(camelCase / 영문 약어) 유지.
 * 로젠 측 변경 시 본 인터페이스가 단일 출처.
 */
export interface RegisterOrderDataPayload {
  readonly userId: string
  readonly custCd: string
  /** 집하 희망일 (YYYYMMDD) — 본 함수는 today (KST) 고정. */
  readonly takeDt: string

  readonly sndCustNm: string
  readonly sndCustAddr: string
  readonly sndTelNo: string

  readonly rcvCustNm: string
  readonly rcvCustAddr: string
  readonly rcvTelNo: string

  readonly fareTy: string
  readonly qty: number
  readonly dlvFare: number

  /** 주문 ID (orders.id) — fixTakeNo 로 echo back 됨. */
  readonly fixTakeNo: string
  /** getSlipNo 로 채번한 운송장번호 (1:1). */
  readonly slipNo: string
}

/**
 * registerOrderData 응답 — resultCd 정상은 '0000' / 'SUCCESS' 류.
 * 로젠 측 비표준 응답에 대비해 두 케이스 모두 수용.
 */
export const RegisterOrderDataResponseSchema = z.object({
  fixTakeNo: z.string().min(1),
  resultCd: z.string().min(1),
  resultMsg: z.string().optional(),
})

export type RegisterOrderDataResponse = z.infer<
  typeof RegisterOrderDataResponseSchema
>

/** 로젠이 성공으로 간주하는 resultCd 화이트리스트. */
export const LOGEN_SUCCESS_CODES = new Set(['0000', '00', 'SUCCESS', 'OK'])

export function isLogenSuccess(resultCd: string): boolean {
  return LOGEN_SUCCESS_CODES.has(resultCd.trim().toUpperCase()) ||
    LOGEN_SUCCESS_CODES.has(resultCd.trim())
}

// ── 주문 입력 (DB → 로젠 변환 입력) ─────────────────────────────────

/** orders 테이블에서 읽어와 registerOrderData 페이로드로 변환할 최소 필드. */
export interface OrderForRegister {
  readonly id: string
  readonly receiver_name: string
  readonly receiver_address: string
  readonly receiver_phone: string
  readonly quantity: number
}
