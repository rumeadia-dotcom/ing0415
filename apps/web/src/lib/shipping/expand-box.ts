/** 박스 모델 → 수량 구간 (Edge box-shipping.ts 의 web 프리뷰 복제). */
export interface BoxModel {
  qtyPerBox: number
  feePerBox: number
}
export interface ShippingTier {
  minQty: number
  maxQty: number | null
  fee: number
}

export function expandBoxToTiers(box: BoxModel, maxTiers = 4): ShippingTier[] {
  if (!Number.isInteger(box.qtyPerBox) || box.qtyPerBox < 1) return []
  if (!Number.isInteger(box.feePerBox) || box.feePerBox < 0) return []
  const count = Number.isFinite(maxTiers) ? Math.max(1, Math.floor(maxTiers)) : 4
  const tiers: ShippingTier[] = []
  for (let k = 1; k <= count; k++) {
    tiers.push({
      minQty: (k - 1) * box.qtyPerBox + 1,
      maxQty: k === count ? null : k * box.qtyPerBox,
      fee: k * box.feePerBox,
    })
  }
  return tiers
}

/** "1~12개 2,500원 · 13~24개 5,000원 · 25개 이상 7,500원" */
export function describeTiers(box: BoxModel, maxTiers = 4): string {
  const tiers = expandBoxToTiers(box, maxTiers)
  if (tiers.length === 0) return ''
  return tiers
    .map((t) =>
      t.maxQty === null
        ? `${t.minQty}개 이상 ${t.fee.toLocaleString()}원`
        : `${t.minQty}~${t.maxQty}개 ${t.fee.toLocaleString()}원`,
    )
    .join(' · ')
}
