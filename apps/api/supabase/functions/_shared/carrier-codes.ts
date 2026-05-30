/**
 * Cross-market 택배사 코드 단일 소스 (PR-6, `features/11st.md` §8-3 / `market-adapter.md` §9.7).
 *
 * 마스터: docs/architecture/v1/features/11st.md §8 / cross-cutting/market-adapter.md §9.7
 *
 * 배경: 마켓마다 택배사 코드 체계가 다르다 —
 *   11번가 `dlvEtprsCd`(00034=CJ/00002=로젠…) · ESM `DeliveryCompanyCode`(10003=로젠, 숫자) ·
 *   쿠팡/네이버 `deliveryCompanyCode`(영문 코드 'LOGEN' 그대로).
 * PR-5 이전에는 11번가 어댑터(`ELEVEN_ST_CARRIER_CODES`)·ESM 어댑터(`ESM_CARRIER_CODE`)가
 * 각자 내부 맵을 들고 있어 동일 관심사가 분산됐다. 본 모듈이 **내부 `CarrierCode` enum →
 * 마켓별 코드 매핑** 단일 소스다. 각 어댑터는 본 모듈을 참조만 한다.
 *
 * 순수 모듈 — Deno/Node 의존 없음. Web(`apps/web/src/lib/markets/carrier-codes.ts`) 미러.
 *
 * ⚠️ v1 내부 운송장 도메인(`orders.carrier_code`)은 `LOGEN` 단일 default 다(`schemas/orders.ts`).
 *   다중 택배사 진입은 v2 — 본 enum 은 향후 확장에 대비해 주요 택배사를 미리 매핑해 둔다.
 */

/**
 * 내부 표준 택배사 코드 (마켓 비종속). 셀러 입력/운송장 도메인이 쓰는 canonical 값.
 * 이 키가 마켓별 코드로 변환되는 진입점이다.
 */
export const CARRIER_CODES = [
  'LOGEN', // 로젠택배 (v1 default)
  'CJ', // CJ대한통운
  'HANJIN', // 한진택배
  'LOTTE', // 롯데(현대)택배
  'EPOST', // 우체국택배/등기
  'HABDONG', // 합동택배
  'KYUNGDONG', // 경동택배
  'DAESIN', // 대신택배
  'CHUNIL', // 천일택배
  'ETC', // 기타
] as const

export type CarrierCode = (typeof CARRIER_CODES)[number]

/** v1 내부 운송장 도메인 default (`orders.carrier_code`). */
export const DEFAULT_CARRIER_CODE: CarrierCode = 'LOGEN'

export function isCarrierCode(v: string): v is CarrierCode {
  return (CARRIER_CODES as readonly string[]).includes(v)
}

/** 입력 문자열을 내부 CarrierCode 로 정규화 (대문자 매칭). 미지원이면 undefined. */
export function normalizeCarrierCode(raw: string): CarrierCode | undefined {
  const key = raw.trim().toUpperCase()
  return isCarrierCode(key) ? key : undefined
}

// ─────────────────────────────────────────────
// 마켓별 코드 매핑 테이블
//   각 마켓이 "내부 CarrierCode → 해당 마켓 코드" 를 들고 있다. 미매핑 키는 누락(undefined)
//   → 호출측 어댑터가 'unsupported_carrier' validation 으로 처리(코드 날조 금지).
// ─────────────────────────────────────────────

/**
 * 11번가 `dlvEtprsCd` (발송처리 1888 path variable enum).
 * 출처: `11st-api/order/dispatch-1888.md`.
 */
export const ELEVEN_ST_CARRIER_CODES: Readonly<Record<CarrierCode, string>> = {
  LOGEN: '00002', // 로젠택배
  CJ: '00034', // CJ대한통운
  HANJIN: '00011', // 한진택배
  LOTTE: '00012', // 롯데(현대)택배
  EPOST: '00007', // 우체국택배/등기
  HABDONG: '00035', // 합동택배
  KYUNGDONG: '00026', // 경동택배
  DAESIN: '00021', // 대신택배
  CHUNIL: '00027', // 천일택배
  ETC: '00099', // 기타
}

/**
 * ESM(G마켓·옥션) `DeliveryCompanyCode` (숫자). v2 MVP 확보 범위는 로젠뿐 —
 * 나머지는 미확보(코드 날조 금지)라 누락. 출처: `esm-api/product/142.md`.
 */
export const ESM_CARRIER_CODES: Readonly<Partial<Record<CarrierCode, number>>> = {
  LOGEN: 10003,
}

// ─────────────────────────────────────────────
// 마켓별 변환 함수 (순수)
// ─────────────────────────────────────────────

/**
 * 내부 carrierCode → 11번가 `dlvEtprsCd`. 미매핑이면 undefined.
 * 입력은 내부 enum 키(대소문자 무관) 가정. 비-enum 문자열도 정규화 시도.
 */
export function toElevenStCarrierCode(carrierCode: string): string | undefined {
  const code = normalizeCarrierCode(carrierCode)
  return code ? ELEVEN_ST_CARRIER_CODES[code] : undefined
}

/** 내부 carrierCode → ESM `DeliveryCompanyCode`(숫자). 미매핑이면 undefined. */
export function toEsmCarrierCode(carrierCode: string): number | undefined {
  const code = normalizeCarrierCode(carrierCode)
  return code ? ESM_CARRIER_CODES[code] : undefined
}
