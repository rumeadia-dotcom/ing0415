/**
 * ESM (G마켓·옥션) 주문조회·발송처리 순수 헬퍼 (Edge Function / Deno 측).
 *
 * 프론트엔드 미러:
 *   apps/web/src/lib/markets/real/esm/orders.ts (tested ground truth)
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - docs/architecture/v1/features/esm.md
 *   - PRD.md §6.1 (주문 자동 수집), §6.4 (송장 제출)
 *
 * ESM 공식 order-shipping API (esm-api/order-shipping/67.md, /70.md):
 *   - 주문조회   : POST https://sa2.esmplus.com/shipping/v1/Order/RequestOrders
 *   - 발송처리   : POST https://sa2.esmplus.com/shipping/v1/Delivery/ShippingInfo
 *   ※ 상품/카테고리 API(/item/v1) 와 base path 가 다르다 (/shipping/v1).
 *
 * 본 파일은 외부 호출 없는 순수 헬퍼만 둔다 (zod 스키마 / status 정규화 / 매핑 /
 * 요청 body 빌드). 실 HTTP 호출은 esm-shared.ts 의 esmFetch (JWT + gateway) 가 담당.
 *
 * 보안 강제:
 *   - PII (BuyerName / ReceiverName / DelFullAddress / HpNo / TelNo) 는 로그 금지.
 *     본 파일은 로깅 자체를 하지 않는다 (순수 변환).
 *   - 마켓 raw status (int 1~5) 는 normalizeEsmStatus 로 정규화 enum 변환.
 */

import { z } from 'npm:zod@3.23.8'
import type { MarketId } from '../schemas.ts'
import {
  MarketOrderSchema,
  normalizeIsoOffset,
  type MarketOrder,
  type MarketOrderStatus,
} from '../market-orders.ts'

// ─────────────────────────────────────────────
// 상수 — ESM order-shipping API
// ─────────────────────────────────────────────

/** 주문/배송 API base (상품 API /item/v1 와 다름). esm-api/order-shipping/67.md */
export const ESM_SHIPPING_API_BASE = 'https://sa2.esmplus.com/shipping/v1'

/** site → siteType (RequestOrders body). 옥션='A'→1, G마켓='G'→2. (67.md) */
export function siteToSiteType(site: 'G' | 'A'): 1 | 2 {
  return site === 'A' ? 1 : 2
}

/**
 * 택배사 코드 매핑 (esm-api/product/142.md 택배사 리스트).
 * v2 MVP 는 LOGEN(로젠택배=10003) 단일. SubmitTrackingInputSchema 가 carrierCode 를
 * 'LOGEN' 으로 제약하므로, 미지원 코드는 발생하지 않지만 방어적으로 매핑한다.
 */
export const ESM_CARRIER_CODE: Record<string, number> = {
  LOGEN: 10003,
}

// ─────────────────────────────────────────────
// 주문조회 응답 스키마 (POST /Order/RequestOrders) — 67.md
// ─────────────────────────────────────────────

/** 주문 1건 (Data.RequestOrders[]). 사용 필드만 명시, 나머지는 passthrough 로 무시. */
const EsmOrderEntrySchema = z
  .object({
    OrderNo: z.union([z.string(), z.number()]),
    OrderStatus: z.number().int().optional(),
    BuyerName: z.string().nullish(),
    ReceiverName: z.string().nullish(),
    ZipCode: z.string().nullish(),
    DelFullAddress: z.string().nullish(),
    DelFrontAddress: z.string().nullish(),
    DelBackAddress: z.string().nullish(),
    HpNo: z.string().nullish(),
    TelNo: z.string().nullish(),
    GoodsName: z.string().nullish(),
    ContrAmount: z.number().int().nonnegative().nullish(),
    /** 금액류는 "6800.0000" 형태 문자열. number 로도 올 수 있어 union. */
    OrderAmount: z.union([z.string(), z.number()]).nullish(),
    OrderDate: z.string().nullish(),
    PayDate: z.string().nullish(),
  })
  .passthrough()

export const EsmOrderListResponseSchema = z.object({
  /** 성공 = 0 (int). 실패 시 Error Code 참고. */
  ResultCode: z.number().int().optional(),
  Message: z.string().nullish(),
  Data: z
    .object({
      SiteType: z.number().int().optional(),
      TotalCount: z.number().int().optional(),
      SellerId: z.string().nullish(),
      RequestOrders: z.array(EsmOrderEntrySchema).nullish(),
    })
    .nullish(),
})

export type EsmOrderListResponse = z.infer<typeof EsmOrderListResponseSchema>
type EsmOrderEntry = z.infer<typeof EsmOrderEntrySchema>

// ─────────────────────────────────────────────
// 발송처리 응답 스키마 (POST /Delivery/ShippingInfo) — 70.md
// ─────────────────────────────────────────────

export const EsmShipResponseSchema = z.object({
  /** 성공: 0 (int) 또는 "Success" (string) — 문서 표기가 혼재. union 으로 수용. */
  ResultCode: z.union([z.number().int(), z.string()]).optional(),
  Message: z.string().nullish(),
  Data: z
    .object({
      OrderNo: z.union([z.string(), z.number()]).optional(),
    })
    .nullish(),
})

export type EsmShipResponse = z.infer<typeof EsmShipResponseSchema>

/** ResultCode 가 성공(0 / "0" / "Success")인지 판정. */
export function isEsmSuccessCode(code: number | string | undefined): boolean {
  if (code === undefined) return false
  if (typeof code === 'number') return code === 0
  return code === '0' || code.toLowerCase() === 'success'
}

// ─────────────────────────────────────────────
// status 정규화 — OrderStatus int (67.md)
//   1 : 신규주문 (결제완료, 발송 대기)        → new_pay
//   2 : 발송대기중 (주문확인 완료, 발송 대기) → new_pay
//   3 : 배송중 (발송처리건)                   → delivering
//   4 : 배송완료                              → delivered
//   5 : 구매결정완료                          → delivered
// ─────────────────────────────────────────────

export function normalizeEsmStatus(raw: number | undefined): MarketOrderStatus {
  switch (raw) {
    case 1:
    case 2:
      return 'new_pay'
    case 3:
      return 'delivering'
    case 4:
    case 5:
      return 'delivered'
    default:
      return 'unknown'
  }
}

// ─────────────────────────────────────────────
// 주문 금액 파싱 — "6800.0000" → 6800 (정수)
// ─────────────────────────────────────────────

function parseOrderAmount(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.trunc(n))
}

/** 주소 fallback — DelFullAddress 우선, 없으면 Front+Back 조합. */
function resolveAddress(entry: EsmOrderEntry): string {
  const full = entry.DelFullAddress?.trim()
  if (full) return full
  const front = entry.DelFrontAddress?.trim() ?? ''
  const back = entry.DelBackAddress?.trim() ?? ''
  const joined = `${front} ${back}`.trim()
  return joined.length > 0 ? joined : '주소 없음'
}

/** 수령인 연락처 — HpNo(휴대폰) 우선, 없으면 TelNo. 안심번호 미부과 시 null 가능. */
function resolvePhone(entry: EsmOrderEntry): string {
  const hp = entry.HpNo?.trim()
  if (hp) return hp
  const tel = entry.TelNo?.trim()
  return tel && tel.length > 0 ? tel : '연락처 없음'
}

// ─────────────────────────────────────────────
// 응답 → MarketOrder[] 매핑 (순수)
// ─────────────────────────────────────────────

export function mapEsmOrders(
  items: EsmOrderEntry[],
  market: MarketId,
): MarketOrder[] {
  return items.map((item) => {
    const buyer = item.BuyerName?.trim()
    const receiver = item.ReceiverName?.trim()
    const goods = item.GoodsName?.trim()
    const qty = item.ContrAmount ?? 0
    const order: MarketOrder = {
      market,
      externalOrderId: String(item.OrderNo),
      buyerName: buyer && buyer.length > 0 ? buyer : '미상',
      receiverName: receiver && receiver.length > 0 ? receiver : '미상',
      receiverAddress: resolveAddress(item),
      receiverPhone: resolvePhone(item),
      productName: goods && goods.length > 0 ? goods : '상품명 없음',
      quantity: qty > 0 ? qty : 1,
      orderAmount: parseOrderAmount(item.OrderAmount),
      status: normalizeEsmStatus(item.OrderStatus),
      paidAt: normalizeIsoOffset(item.PayDate ?? undefined),
      ...(item.OrderDate
        ? { orderedAt: normalizeIsoOffset(item.OrderDate) }
        : {}),
    }
    return MarketOrderSchema.parse(order)
  })
}

// ─────────────────────────────────────────────
// 요청 body 빌더 (순수)
// ─────────────────────────────────────────────

export interface EsmOrderListRequestBody {
  siteType: 1 | 2
  /** 1 : 결제완료(주문 확인전). 발송 대기 신규 주문 조회 기본값. */
  orderStatus: number
  /** 2 : 결제완료일 기준 조회. */
  requestDateType: number
  requestDateFrom: string
  requestDateTo: string
  pageIndex: number
  pageSize: number
}

/** 분단위 'YYYY-MM-DD hh:mm' (ESM RequestOrders date 형식). ISO → 변환. */
export function toEsmDateParam(iso: string | undefined, fallbackIso: string): string {
  const source = iso ?? fallbackIso
  const d = new Date(source)
  const base = Number.isNaN(d.getTime()) ? new Date(fallbackIso) : d
  const yyyy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(base.getUTCDate()).padStart(2, '0')
  const hh = String(base.getUTCHours()).padStart(2, '0')
  const mi = String(base.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

export function buildEsmOrderListBody(opts: {
  site: 'G' | 'A'
  since?: string
  until?: string
  pageIndex?: number
  pageSize?: number
}): EsmOrderListRequestBody {
  const now = new Date()
  const defaultUntil = now.toISOString()
  // 기본 조회기간: 최근 7일.
  const defaultSince = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString()
  return {
    siteType: siteToSiteType(opts.site),
    orderStatus: 1, // 결제완료 (주문 확인전) — 발송 대기 신규 주문
    requestDateType: 2, // 결제완료일 기준
    requestDateFrom: toEsmDateParam(opts.since, defaultSince),
    requestDateTo: toEsmDateParam(opts.until, defaultUntil),
    pageIndex: opts.pageIndex ?? 1,
    pageSize: opts.pageSize ?? 100,
  }
}

export interface EsmShipInfoRequestBody {
  OrderNo: string
  ShippingDate: string
  DeliveryCompanyCode: number
  InvoiceNo: string
}

/** 발송일시 — 호출 시점 (YYYY-MM-DDThh:mm:ss, 2일 이내 요건). */
export function nowEsmShippingDate(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '').replace(/Z$/, '')
}

export function buildEsmShipInfoBody(opts: {
  externalOrderId: string
  waybillNumber: string
  carrierCode: string
  shippingDate?: string
}): EsmShipInfoRequestBody {
  const code = ESM_CARRIER_CODE[opts.carrierCode]
  if (code === undefined) {
    throw new Error(`지원하지 않는 택배사 코드: ${opts.carrierCode}`)
  }
  return {
    OrderNo: opts.externalOrderId,
    ShippingDate: opts.shippingDate ?? nowEsmShippingDate(),
    DeliveryCompanyCode: code,
    InvoiceNo: opts.waybillNumber,
  }
}
