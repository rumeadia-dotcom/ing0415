import type { ShippingConfig } from '@/lib/schemas/shipping-config'
import type { MarketId } from '@/lib/schemas/common'
import { ko } from '@/locales/ko'

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

/**
 * ShippingConfig + marketId → 해당 마켓에 적용될 배송비 한 줄 요약.
 * Step4 미리보기 배송비 섹션에서 사용한다 (클라이언트 사이드, 서버 의존 없음).
 *
 * - quantity_tiered + box: 11번가 = 구간 그대로, 쿠팡 = 단일 플래그, 나머지 = 단일 안내
 * - 나머지 feeType: 전 마켓 동일 요약
 */
export function describeShippingForMarket(config: ShippingConfig, marketId: MarketId): string {
  const { feeType, baseFee, freeThreshold, box } = config
  const p = ko.register.shipping.preview

  if (feeType === 'quantity_tiered' && box != null) {
    if (marketId === '11st') {
      return p.tieredEleven(describeTiers(box, 4))
    }
    if (marketId === 'coupang') {
      return p.tieredCoupang(box.feePerBox)
    }
    // naver / gmarket / auction — 구간 미지원, 단일 feePerBox 적용 안내
    return p.tieredOther(box.feePerBox)
  }

  switch (feeType) {
    case 'free':
      return p.free
    case 'paid':
      return p.paid(baseFee)
    case 'conditional_free':
      return p.conditionalFree(freeThreshold ?? 0)
    case 'charge_on_delivery':
      return p.chargeOnDelivery
    default:
      return p.free
  }
}
