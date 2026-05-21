import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  OrderDetailSchema,
  OrderSummarySchema,
  OrdersFilterSchema,
  OrdersSummarySchema,
  type OrderDetail,
  type OrderSummary,
  type OrdersFilter,
  type OrdersSummary,
} from '@/lib/schemas/orders'

/**
 * orders 도메인 데이터 fetcher.
 *
 * 마스터: docs/architecture/v1/features/orders.md §3 (PR2 신설 예정).
 * 호출 표면:
 *  - `list_orders(...)` RPC → 목록 (keyset cursor)
 *  - `get_order(p_order_id)` RPC → 상세 (jsonb 단일)
 *  - `orders_with_dispatch_summary` view → 오늘 요약
 *  - `manual_resolve_waybill(p_order_id, p_waybill_number, p_note)` RPC → 수동처리 mutation
 *
 * 본 PR 은 PR2 (백엔드 RPC + RLS) 머지 전 프론트 진입을 위해 wrapper 만 정의.
 * 실제 RPC 시그니처는 PR2 와 합쳐질 때 동기화.
 */

// ─────────────────────────────────────────────
// list_orders raw row (snake_case)
// ─────────────────────────────────────────────
const RawOrderRowSchema = z.object({
  id: z.string().uuid(),
  external_order_id: z.string(),
  market_id: z.string(),
  product_name: z.string(),
  buyer_masked_name: z.string(),
  shipping_status: z.string(),
  market_dispatch_status: z.string(),
  waybill_number: z.string().nullable(),
  ordered_at: z.string(),
  updated_at: z.string(),
  total_count: z.number().int().nonnegative(),
})

export interface OrdersListPage {
  items: OrderSummary[]
  totalCount: number
  nextCursor: { cursor: string; cursorId: string } | null
}

export async function fetchOrdersList(filter: OrdersFilter): Promise<OrdersListPage> {
  const supabase = getSupabase()
  const safe = OrdersFilterSchema.parse(filter)

  const { data, error } = await supabase.rpc('list_orders', {
    p_market_id: safe.marketId ?? null,
    p_status: safe.status ?? null,
    p_from: safe.from ?? null,
    p_to: safe.to ?? null,
    p_q: safe.q ?? null,
    p_limit: safe.pageSize,
    p_cursor: safe.cursor ?? null,
    p_cursor_id: safe.cursorId ?? null,
  })
  if (error) {
    logger.warn({ err: error.message }, 'list_orders failed')
    throw error
  }

  const rawRows = z.array(RawOrderRowSchema).parse(data ?? [])
  const items = rawRows.map(mapOrderRow)
  const totalCount = rawRows[0]?.total_count ?? 0
  const last = rawRows[rawRows.length - 1]
  const nextCursor =
    last && rawRows.length >= safe.pageSize
      ? { cursor: last.ordered_at, cursorId: last.id }
      : null

  return { items, totalCount, nextCursor }
}

function mapOrderRow(row: z.infer<typeof RawOrderRowSchema>): OrderSummary {
  return OrderSummarySchema.parse({
    id: row.id,
    externalOrderId: row.external_order_id,
    marketId: row.market_id,
    productName: row.product_name,
    buyerMaskedName: row.buyer_masked_name,
    shippingStatus: row.shipping_status,
    marketDispatchStatus: row.market_dispatch_status,
    waybillNumber: row.waybill_number,
    orderedAt: row.ordered_at,
    updatedAt: row.updated_at,
  })
}

// ─────────────────────────────────────────────
// get_order → 상세
// ─────────────────────────────────────────────
function remapOrderDetail(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const r = raw as Record<string, unknown>
  const order = r['order']
  if (typeof order !== 'object' || order === null) return raw
  const o = order as Record<string, unknown>
  return {
    order: {
      id: o['id'],
      sellerId: o['seller_id'],
      externalOrderId: o['external_order_id'],
      marketId: o['market_id'],
      productName: o['product_name'],
      productOption: o['product_option'],
      quantity: o['quantity'],
      buyerMaskedName: o['buyer_masked_name'],
      buyerMaskedPhone: o['buyer_masked_phone'],
      shippingAddressMasked: o['shipping_address_masked'],
      shippingStatus: o['shipping_status'],
      marketDispatchStatus: o['market_dispatch_status'],
      waybillNumber: o['waybill_number'],
      logenErrorMessage: o['logen_error_message'],
      orderedAt: o['ordered_at'],
      collectedAt: o['collected_at'],
      logenRegisteredAt: o['logen_registered_at'],
      waybillPrintedAt: o['waybill_printed_at'],
      trackingSubmittedAt: o['tracking_submitted_at'],
      updatedAt: o['updated_at'],
    },
  }
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('get_order', { p_order_id: orderId })
  if (error) {
    logger.warn({ err: error.message, orderId }, 'get_order failed')
    throw error
  }
  if (data === null || data === undefined) return null
  return OrderDetailSchema.parse(remapOrderDetail(data))
}

// ─────────────────────────────────────────────
// orders_with_dispatch_summary view → 오늘 요약
// ─────────────────────────────────────────────
const RawSummarySchema = z.object({
  new_orders_count: z.number().int().nonnegative(),
  logen_registered_count: z.number().int().nonnegative(),
  waybill_pending_count: z.number().int().nonnegative(),
  dispatch_submitted_count: z.number().int().nonnegative(),
  by_market: z
    .array(
      z.object({
        market_id: z.string(),
        new_orders_count: z.number().int().nonnegative(),
        pending_count: z.number().int().nonnegative(),
      }),
    )
    .nullable(),
})

export async function fetchOrdersSummary(): Promise<OrdersSummary> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('orders_with_dispatch_summary')
    .select('*')
    .maybeSingle()

  if (error) {
    logger.warn({ err: error.message }, 'orders_with_dispatch_summary failed')
    throw error
  }
  const raw = RawSummarySchema.parse(
    data ?? {
      new_orders_count: 0,
      logen_registered_count: 0,
      waybill_pending_count: 0,
      dispatch_submitted_count: 0,
      by_market: [],
    },
  )
  return OrdersSummarySchema.parse({
    newOrdersCount: raw.new_orders_count,
    logenRegisteredCount: raw.logen_registered_count,
    waybillPendingCount: raw.waybill_pending_count,
    dispatchSubmittedCount: raw.dispatch_submitted_count,
    byMarket: (raw.by_market ?? []).map((m) => ({
      marketId: m.market_id,
      newOrdersCount: m.new_orders_count,
      pendingCount: m.pending_count,
    })),
  })
}

// ─────────────────────────────────────────────
// manual_resolve_waybill mutation
// ─────────────────────────────────────────────
export interface ManualResolveResult {
  orderId: string
  waybillNumber: string
}

export async function manualResolveWaybill(input: {
  orderId: string
  waybillNumber: string
  note?: string | undefined
}): Promise<ManualResolveResult> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('manual_resolve_waybill', {
    p_order_id: input.orderId,
    p_waybill_number: input.waybillNumber,
    p_note: input.note ?? null,
  })
  if (error) {
    logger.warn(
      { err: error.message, orderId: input.orderId },
      'manual_resolve_waybill failed',
    )
    throw error
  }
  const Resp = z.object({
    order_id: z.string().uuid(),
    waybill_number: z.string(),
  })
  const parsed = Resp.parse(data)
  return {
    orderId: parsed.order_id,
    waybillNumber: parsed.waybill_number,
  }
}

// ─────────────────────────────────────────────
// Query Key 팩토리
// ─────────────────────────────────────────────
export const ordersQueryKeys = {
  all: ['orders'] as const,
  summary: () => ['orders', 'summary'] as const,
  list: (filter: OrdersFilter) => ['orders', 'list', serializeFilterKey(filter)] as const,
  detail: (orderId: string) => ['orders', 'detail', orderId] as const,
}

function serializeFilterKey(filter: OrdersFilter): string {
  return [
    `market:${filter.marketId ?? ''}`,
    `status:${filter.status ?? ''}`,
    `from:${filter.from ?? ''}`,
    `to:${filter.to ?? ''}`,
    `q:${filter.q ?? ''}`,
    `pageSize:${filter.pageSize}`,
  ].join('|')
}
