/**
 * ESM (G마켓·옥션) 공용 fetchOrders + submitTracking (v2 확장).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - docs/architecture/v1/features/esm.md
 *   - PRD.md §6.1, §6.4
 *
 * ESM 공식 order-shipping API (esm-api/order-shipping/67.md, /70.md):
 *   - 주문조회 : POST https://sa2.esmplus.com/shipping/v1/Order/RequestOrders
 *   - 발송처리 : POST https://sa2.esmplus.com/shipping/v1/Delivery/ShippingInfo
 *   ※ 상품/카테고리 API(/item/v1) 와 base path 가 다르다 (/shipping/v1).
 *
 * 인증: ESM JWT HS256 (credential kind = 'esm_jwt'). G·A 가 동일 base 사용, site 분기.
 *
 * 중요 제약:
 *   - masterId / secretKey / PII(BuyerName / ReceiverName / DelFullAddress / HpNo)
 *     절대 로그 금지.
 *   - submitTracking 마켓 정상 거부(검증 실패 / 이미 발송) → ok=false 반환 (throw 아님).
 */

import { z } from 'zod'
import { MarketError } from '../../errors'
import {
  FetchOrdersInputSchema,
  MarketOrderSchema,
  MarketSubmitTrackingResultSchema,
  SubmitTrackingInputSchema,
  type FetchOrdersInput,
  type MarketId,
  type MarketOrder,
  type MarketOrderStatus,
  type MarketSubmitTrackingResult,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'
import { buildEsmJwt } from './jwt'

const DEFAULT_TIMEOUT_MS = 15_000

/** 주문/배송 API base (상품 API /item/v1 와 다름). esm-api/order-shipping/67.md */
export const ESM_SHIPPING_API_BASE = 'https://sa2.esmplus.com/shipping/v1'

/** site → siteType (RequestOrders body). 옥션='A'→1, G마켓='G'→2. (67.md) */
function siteToSiteType(site: 'G' | 'A'): 1 | 2 {
  return site === 'A' ? 1 : 2
}

/**
 * 택배사 코드 매핑 (esm-api/product/142.md). v2 MVP 는 LOGEN(로젠택배=10003) 단일.
 */
const ESM_CARRIER_CODE: Record<string, number> = {
  LOGEN: 10003,
}

// ─────────────────────────────────────────────
// ESM 응답 스키마 (실제 spec — PascalCase)
// ─────────────────────────────────────────────

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
    OrderAmount: z.union([z.string(), z.number()]).nullish(),
    OrderDate: z.string().nullish(),
    PayDate: z.string().nullish(),
  })
  .passthrough()

const EsmOrderListResponseSchema = z.object({
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

const EsmShipResponseSchema = z.object({
  /** 성공: 0 (int) 또는 "Success" (string) — 문서 표기 혼재. union 수용. */
  ResultCode: z.union([z.number().int(), z.string()]).optional(),
  Message: z.string().nullish(),
  Data: z
    .object({
      OrderNo: z.union([z.string(), z.number()]).optional(),
    })
    .nullish(),
})

type EsmOrderEntry = z.infer<typeof EsmOrderEntrySchema>

/** ResultCode 가 성공(0 / "0" / "Success")인지 판정. */
function isEsmSuccessCode(code: number | string | undefined): boolean {
  if (code === undefined) return false
  if (typeof code === 'number') return code === 0
  return code === '0' || code.toLowerCase() === 'success'
}

// ─────────────────────────────────────────────
// credential 추출
// ─────────────────────────────────────────────

export interface EsmCredPayload {
  masterId: string
  secretKey: string
  sellerId: string
  site: 'G' | 'A'
}

export function extractEsmCredPayload(
  credential: StoredCredential | undefined,
  expectedSite: 'G' | 'A',
  market: MarketId,
): EsmCredPayload {
  if (!credential || credential.kind !== 'esm_jwt') {
    throw new MarketError(
      'unauthorized',
      `ESM(${market}) fetchOrders: esm_jwt StoredCredential 필요`,
      { market },
    )
  }
  if (credential.payload.site !== expectedSite) {
    throw new MarketError(
      'validation',
      `ESM(${market}) site 불일치 — 어댑터=${expectedSite}, 자격증명=${credential.payload.site}`,
      { market },
    )
  }
  return {
    masterId: credential.payload.masterId,
    secretKey: credential.payload.secretKey,
    sellerId: credential.payload.sellerId,
    site: credential.payload.site,
  }
}

// ─────────────────────────────────────────────
// status 정규화 — OrderStatus int (67.md)
//   1 신규주문 / 2 발송대기중 → new_pay
//   3 배송중 → delivering
//   4 배송완료 / 5 구매결정완료 → delivered
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

function normalizeIsoOffset(raw: string | undefined): string {
  if (!raw) return '1970-01-01T00:00:00+00:00'
  if (/[+-]\d{2}:\d{2}$/.test(raw)) return raw
  if (raw.endsWith('Z')) return raw.replace(/Z$/, '+00:00')
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '1970-01-01T00:00:00+00:00'
  return d.toISOString().replace(/Z$/, '+00:00')
}

function parseOrderAmount(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.trunc(n))
}

function resolveAddress(entry: EsmOrderEntry): string {
  const full = entry.DelFullAddress?.trim()
  if (full) return full
  const front = entry.DelFrontAddress?.trim() ?? ''
  const back = entry.DelBackAddress?.trim() ?? ''
  const joined = `${front} ${back}`.trim()
  return joined.length > 0 ? joined : '주소 없음'
}

function resolvePhone(entry: EsmOrderEntry): string {
  const hp = entry.HpNo?.trim()
  if (hp) return hp
  const tel = entry.TelNo?.trim()
  return tel && tel.length > 0 ? tel : '연락처 없음'
}

// ─────────────────────────────────────────────
// HTTP 상태 → MarketError 매핑
// ─────────────────────────────────────────────

function httpStatusToMarketError(
  market: MarketId,
  status: number,
  message: string,
  correlationId: string,
): MarketError {
  if (status === 401 || status === 403) {
    return new MarketError('unauthorized', `ESM 인증 실패 (${status})`, {
      market,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 429) {
    return new MarketError('rate_limit', 'ESM API rate limit', {
      market,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError('server', `ESM 서버 오류 (${status})`, {
      market,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 400 || status === 422) {
    return new MarketError('validation', `ESM 검증 실패 (${status})`, {
      market,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  return new MarketError(
    'unknown',
    `ESM API 오류 (${status}) correlationId=${correlationId}`,
    {
      market,
      status,
      marketErrorMessage: message,
    },
  )
}

async function esmFetchSigned(opts: {
  market: MarketId
  method: 'GET' | 'POST' | 'PUT'
  path: string
  cred: EsmCredPayload
  body?: unknown
  correlationId: string
  timeoutMs?: number
}): Promise<Response> {
  const {
    market,
    method,
    path,
    cred,
    body,
    correlationId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  const { token } = await buildEsmJwt({
    masterId: cred.masterId,
    secretKey: cred.secretKey,
    site: cred.site,
    sellerId: cred.sellerId,
  })

  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(`${ESM_SHIPPING_API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `Bearer ${token}`,
        'X-Correlation-Id': correlationId,
      },
      body: body !== undefined ? JSON.stringify(body) : null,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketError('network', 'ESM API 요청 timeout', {
        market,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    throw new MarketError('network', 'ESM API 네트워크 오류', {
      market,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }
}

// ─────────────────────────────────────────────
// 요청 body 빌더
// ─────────────────────────────────────────────

/** 분단위 'YYYY-MM-DD hh:mm' (ESM RequestOrders date 형식). */
function toEsmDateParam(iso: string | undefined, fallbackIso: string): string {
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

function buildEsmOrderListBody(opts: {
  site: 'G' | 'A'
  since?: string | undefined
  until?: string | undefined
}) {
  const now = new Date()
  const defaultUntil = now.toISOString()
  const defaultSince = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString()
  return {
    siteType: siteToSiteType(opts.site),
    orderStatus: 1, // 결제완료 (주문 확인전) — 발송 대기 신규 주문
    requestDateType: 2, // 결제완료일 기준
    requestDateFrom: toEsmDateParam(opts.since, defaultSince),
    requestDateTo: toEsmDateParam(opts.until, defaultUntil),
    pageIndex: 1,
    pageSize: 100,
  }
}

function nowEsmShippingDate(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '').replace(/Z$/, '')
}

// ─────────────────────────────────────────────
// fetchOrders — ESM 주문조회 (POST /Order/RequestOrders, site 분기)
// ─────────────────────────────────────────────

export async function esmFetchOrders(opts: {
  market: MarketId
  site: 'G' | 'A'
  input: FetchOrdersInput
  credential: StoredCredential | undefined
}): Promise<MarketOrder[]> {
  const { market, site, input, credential } = opts

  const parsedInput = FetchOrdersInputSchema.safeParse(input)
  if (!parsedInput.success) {
    throw new MarketError(
      'validation',
      `ESM(${market}) fetchOrders 입력 형식 오류 — ${parsedInput.error.message}`,
      { market, cause: parsedInput.error },
    )
  }

  const cred = extractEsmCredPayload(credential, site, market)
  const correlationId = crypto.randomUUID()

  const body = buildEsmOrderListBody({
    site,
    since: parsedInput.data.since,
    until: parsedInput.data.until,
  })

  const response = await esmFetchSigned({
    market,
    method: 'POST',
    path: '/Order/RequestOrders',
    cred,
    body,
    correlationId,
  })

  const text = await response.text()
  if (!response.ok) {
    throw httpStatusToMarketError(market, response.status, text, correlationId)
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new MarketError('server', 'ESM 주문 응답 JSON 파싱 실패', {
      market,
      status: response.status,
    })
  }

  const parsed = EsmOrderListResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new MarketError('server', 'ESM 주문 응답 스키마 불일치', {
      market,
      cause: parsed.error,
    })
  }

  // ResultCode != 0 → 마켓 검증 실패 (조회기간 초과 등, Error Code 3000).
  if (parsed.data.ResultCode !== undefined && parsed.data.ResultCode !== 0) {
    throw new MarketError(
      'validation',
      `ESM(${market}) 주문조회 거부: ${parsed.data.Message ?? '알 수 없는 오류'}`,
      {
        market,
        marketErrorCode: String(parsed.data.ResultCode),
        ...(parsed.data.Message
          ? { marketErrorMessage: parsed.data.Message }
          : {}),
      },
    )
  }

  const items = parsed.data.Data?.RequestOrders ?? []
  const orders: MarketOrder[] = items.map((item) => {
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

  return orders
}

// ─────────────────────────────────────────────
// submitTracking — ESM 발송처리 (POST /Delivery/ShippingInfo, site 분기)
// ─────────────────────────────────────────────

export async function esmSubmitTracking(opts: {
  market: MarketId
  site: 'G' | 'A'
  input: SubmitTrackingInput
  credential: StoredCredential | undefined
}): Promise<MarketSubmitTrackingResult> {
  const { market, site, input, credential } = opts

  const parsedInput = SubmitTrackingInputSchema.safeParse(input)
  if (!parsedInput.success) {
    throw new MarketError(
      'validation',
      `ESM(${market}) submitTracking 입력 형식 오류 — ${parsedInput.error.message}`,
      { market, cause: parsedInput.error },
    )
  }

  const cred = extractEsmCredPayload(credential, site, market)
  const correlationId = crypto.randomUUID()

  const deliveryCompanyCode = ESM_CARRIER_CODE[parsedInput.data.carrierCode]
  if (deliveryCompanyCode === undefined) {
    return MarketSubmitTrackingResultSchema.parse({
      ok: false,
      errorCode: 'unsupported_carrier',
      errorMessage: `ESM(${market}) 지원하지 않는 택배사: ${parsedInput.data.carrierCode}`,
    })
  }

  const body = {
    OrderNo: parsedInput.data.externalOrderId,
    ShippingDate: nowEsmShippingDate(),
    DeliveryCompanyCode: deliveryCompanyCode,
    InvoiceNo: parsedInput.data.waybillNumber,
  }

  const response = await esmFetchSigned({
    market,
    method: 'POST',
    path: '/Delivery/ShippingInfo',
    cred,
    body,
    correlationId,
  })

  const text = await response.text()

  if (!response.ok) {
    // 4xx (400/422) — 마켓 검증 거부. ok=false 흡수 (부분 실패 패턴).
    if (response.status === 400 || response.status === 422) {
      let parsedBody: { Message?: string; ResultCode?: number | string } = {}
      try {
        parsedBody = JSON.parse(text) as {
          Message?: string
          ResultCode?: number | string
        }
      } catch {
        // fallthrough
      }
      return MarketSubmitTrackingResultSchema.parse({
        ok: false,
        errorCode:
          parsedBody.ResultCode !== undefined
            ? String(parsedBody.ResultCode)
            : `http_${response.status}`,
        errorMessage:
          parsedBody.Message ??
          `ESM(${market}) 발송 처리 거부 (${response.status})`,
      })
    }
    throw httpStatusToMarketError(market, response.status, text, correlationId)
  }

  let json: unknown = {}
  try {
    json = text.length > 0 ? JSON.parse(text) : {}
  } catch {
    throw new MarketError('server', 'ESM 발송 응답 JSON 파싱 실패', {
      market,
      status: response.status,
    })
  }

  const parsed = EsmShipResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new MarketError('server', 'ESM 발송 응답 스키마 불일치', {
      market,
      cause: parsed.error,
    })
  }

  // ResultCode 0 / "Success" → 성공. 그 외(3000 등) → 정상 거부(ok=false).
  if (!isEsmSuccessCode(parsed.data.ResultCode)) {
    return MarketSubmitTrackingResultSchema.parse({
      ok: false,
      errorCode:
        parsed.data.ResultCode !== undefined
          ? String(parsed.data.ResultCode)
          : 'esm_ship_failed',
      errorMessage: parsed.data.Message ?? `ESM(${market}) 발송 처리 실패`,
    })
  }

  return MarketSubmitTrackingResultSchema.parse({
    ok: true,
    ...(parsed.data.Data?.OrderNo !== undefined
      ? { dispatchId: String(parsed.data.Data.OrderNo) }
      : {}),
  })
}
