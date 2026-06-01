/**
 * 박스(수량 구간) 배송비 — Deno 의존 없는 순수 로직 (esm-category.ts 패턴).
 *
 * 스펙: docs/superpowers/specs/2026-06-01-quantity-tiered-shipping-design.md §3.
 *   - 입력 = 박스 모델 { qtyPerBox: N, feePerBox: M } → k번째 박스 = k×M.
 *   - expandBoxToTiers 가 { minQty, maxQty|null, fee }[] 생성, 각 어댑터가 마켓 포맷 변환.
 *
 * wiring 상태 (옵션 A, 2026-06-01):
 *   - 11번가: elevenStBoxToFields → eleven-st-map.ts 에서 호출(wired).
 *   - 쿠팡:   coupangBoxFallback → coupang.ts 에서 호출(wired, 미지원 fallback).
 *   - 네이버: naverBoxToDeliveryFee → 어댑터 stub 이라 미wiring(C7/C3 real 트랙).
 *   - ESM:    esmBoxToDetails → 조회형 모델 충돌 + §8.2 미검증이라 미wiring(C3).
 *
 * type-only import 만 사용(런타임 의존 0) → Vitest 직접 import 가능.
 */

/** 박스 모델 입력. zod ShippingBoxSchema(z.number().int()) 와 동형 — 둘 다 음 아닌 정수. */
export interface BoxModel {
  qtyPerBox: number
  feePerBox: number
}

/** 전개된 수량 구간. maxQty=null = open-ended(이상). */
export interface ShippingTier {
  minQty: number
  maxQty: number | null
  fee: number
}

/** 10원 단위 내림 (마켓 공통: 판매가/배송비 10원 단위). 음수/비유한 → 0. */
function floorTo10(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n / 10) * 10
}

/**
 * 박스 모델 → 수량 구간 배열. k=1..maxTiers, k번째 박스 = k×feePerBox.
 * 마지막 구간은 open-ended(maxQty=null).
 */
export function expandBoxToTiers(box: BoxModel, maxTiers = 10): ShippingTier[] {
  if (!Number.isInteger(box.qtyPerBox) || box.qtyPerBox < 1) {
    throw new Error(`expandBoxToTiers: qtyPerBox must be >=1 (got ${box.qtyPerBox})`)
  }
  if (!Number.isInteger(box.feePerBox) || box.feePerBox < 0) {
    throw new Error(`expandBoxToTiers: feePerBox must be a non-negative integer (got ${box.feePerBox})`)
  }
  const n = box.qtyPerBox
  const m = box.feePerBox
  // maxTiers 비유한(NaN/Infinity) 방어: 기본 10. NaN → 빈 배열 → 11번가 빈 '^'-join 사고 차단.
  const count = Number.isFinite(maxTiers) ? Math.max(1, Math.floor(maxTiers)) : 10
  const tiers: ShippingTier[] = []
  for (let k = 1; k <= count; k++) {
    tiers.push({
      minQty: (k - 1) * n + 1,
      maxQty: k === count ? null : k * n,
      fee: k * m,
    })
  }
  return tiers
}

// ── 11번가 (dlvCstInstBasiCd=04, 최대 10박스) ──────────────────────────────
export interface ElevenStBoxFields {
  dlvCstInstBasiCd: '04'
  /** 각 구간 하한 "1^13^25^…" (K개) */
  dlvCnt1: string
  /** 각 구간 상한 "12^24^…" (K-1개, 마지막 open-ended 제외) */
  dlvCnt2: string
  /** 각 구간 배송비 "2500^5000^…" (K개, 10원 단위) */
  dlvCst3: string
}

export function elevenStBoxToFields(box: BoxModel): ElevenStBoxFields {
  const tiers = expandBoxToTiers(box, 10)
  return {
    dlvCstInstBasiCd: '04',
    dlvCnt1: tiers.map((t) => String(t.minQty)).join('^'),
    dlvCnt2: tiers
      .filter((t) => t.maxQty !== null)
      .map((t) => String(t.maxQty))
      .join('^'),
    dlvCst3: tiers.map((t) => String(floorTo10(t.fee))).join('^'),
  }
}

// ── 쿠팡 (미지원 → 박스당 단일 + 경고) ────────────────────────────────────
export interface BoxWarning {
  code: 'shipping_tier_unsupported'
  message: string
}
export interface CoupangBoxFallback {
  shippingFee: number
  warning: BoxWarning
}

export function coupangBoxFallback(box: BoxModel): CoupangBoxFallback {
  const fee = floorTo10(box.feePerBox)
  return {
    shippingFee: fee,
    warning: {
      code: 'shipping_tier_unsupported',
      message: `쿠팡은 수량 구간 배송비를 지원하지 않아 박스당 ${fee.toLocaleString()}원 단일 적용됩니다. 2박스 이상 주문은 배송비가 실제보다 적게 청구될 수 있습니다.`,
    },
  }
}

// ── 네이버 (변환기 — 미wiring) ────────────────────────────────────────────
/** §8.2: 수량별 enum 리터럴 문자열은 C3 real 호출로 확정. 현재는 구조 best-guess. */
export const NAVER_QTY_FEE_TYPE = 'REPEAT' // TODO(C3): apicenter 실 enum 리터럴 확인
export interface NaverDeliveryFee {
  deliveryFeeType: string
  baseFee: number
  repeatQuantity: number
}
export function naverBoxToDeliveryFee(box: BoxModel): NaverDeliveryFee {
  return {
    deliveryFeeType: NAVER_QTY_FEE_TYPE,
    baseFee: floorTo10(box.feePerBox),
    repeatQuantity: box.qtyPerBox,
  }
}

// ── ESM (변환기 — 미wiring, 최대 5단계) ───────────────────────────────────
/** §8.2: FeeAmnt 가 총액 vs 할증분, 카테고리 상한 충돌은 C3 real 검증. */
export interface EsmEachDetail {
  Condition: number
  FeeAmnt: number
}
export interface EsmBoxEach {
  feeType: '4'
  details: EsmEachDetail[]
}
export function esmBoxToDetails(box: BoxModel): EsmBoxEach {
  const tiers = expandBoxToTiers(box, 5)
  return {
    feeType: '4',
    details: tiers.map((t) => ({ Condition: t.minQty, FeeAmnt: floorTo10(t.fee) })),
  }
}
