/**
 * orders + 자격증명 → registerOrderData payload 변환.
 *
 * - 1주문 : 1 slipNo 매핑. 매핑은 호출측 (process.ts) 에서 인덱스 기반으로 보장.
 */

import type {
  LogenCredential,
  OrderForRegister,
  RegisterOrderDataPayload,
} from './types.ts'

/** YYYYMMDD (KST). 로젠 takeDt 포맷. */
export function todayYYYYMMDD(now: Date = new Date()): string {
  // KST = UTC+9. 운영 환경(UTC) 가정.
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000
  const k = new Date(kstMs)
  const y = k.getUTCFullYear()
  const m = String(k.getUTCMonth() + 1).padStart(2, '0')
  const d = String(k.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export function buildRegisterPayload(args: {
  credential: LogenCredential
  order: OrderForRegister
  slipNo: string
  takeDt?: string
}): RegisterOrderDataPayload {
  const { credential, order, slipNo } = args
  const takeDt = args.takeDt ?? todayYYYYMMDD()
  return {
    userId: credential.userId,
    custCd: credential.custCd,
    takeDt,
    sndCustNm: credential.sender.name,
    sndCustAddr: credential.sender.address,
    sndTelNo: credential.sender.phone,
    rcvCustNm: order.receiver_name,
    rcvCustAddr: order.receiver_address,
    rcvTelNo: order.receiver_phone,
    fareTy: credential.fare.fareTy,
    qty: order.quantity,
    dlvFare: credential.fare.dlvFare,
    fixTakeNo: order.id,
    slipNo,
  }
}
