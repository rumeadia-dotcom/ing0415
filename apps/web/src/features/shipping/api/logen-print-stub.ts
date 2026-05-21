/**
 * 로젠 운송장 출력 팝업 URL 빌더 — PR3 임시 stub.
 *
 * 정식 위치: `apps/web/src/lib/logen/client.ts` (PR3 머지 시 본 파일 제거 + 해당 모듈 import 로 교체).
 *
 * 근거:
 *  - user_flow-v2-shipping.md n52 (운송장 출력 팝업 trigger)
 *  - PRD-v2-shipping.md §2.3.1 (outSlipPrintPop)
 */

interface BuildOutSlipPrintPopUrlInput {
  /** 로젠에 등록된 운송장 번호 배열. 1건 이상 필수. */
  waybillNumbers: readonly string[]
}

/**
 * 로젠 outSlipPrintPop 팝업 URL 을 생성한다.
 *
 * Stub 사양: PR3 가 진짜 구현으로 교체할 때 동일 시그니처 유지.
 *  - 입력 비면 throw.
 *  - 결과는 동기 string.
 */
export function buildOutSlipPrintPopUrl({ waybillNumbers }: BuildOutSlipPrintPopUrlInput): string {
  if (waybillNumbers.length === 0) {
    throw new Error('출력할 운송장 번호가 없습니다.')
  }
  // STUB: PR3 구현 시 실제 로젠 endpoint + 인증 토큰 흐름으로 교체.
  const joined = waybillNumbers.join(',')
  return `about:blank#logen-stub?waybills=${encodeURIComponent(joined)}`
}
