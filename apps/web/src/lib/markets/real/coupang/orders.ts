/**
 * 쿠팡 Wing OpenAPI — fetchOrders + submitTracking (v2 확장).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1, §6.4
 *
 * 엔드포인트:
 *   - GET /v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets?status=ACCEPT
 *   - PUT /v2/providers/openapi/apis/api/v4/vendors/{vendorId}/orders/{shipmentBoxId}/ordersheets/shipments
 *
 * 인증: HMAC-SHA256 (credential kind = 'hmac'). authenticate() 후 인스턴스 cred
 *       또는 명시 인자 credential 어느 쪽이든 받는다.
 *
 * 중요 제약:
 *   - accessKey / secretKey / vendorId 는 절대 로그 금지.
 *   - PII 보호 — logger redact() 마스킹 의존.
 *   - 마켓 정상 거부 (예: 이미 발송됨) → ok=false 반환.
 */

import { z } from 'zod'
import { MarketError } from '../../errors'
import {
  FetchOrdersInputSchema,
  MarketOrderSchema,
  MarketSubmitTrackingResultSchema,
  SubmitTrackingInputSchema,
  type FetchOrdersInput,
  type MarketOrder,
  type MarketOrderStatus,
  type MarketSubmitTrackingResult,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'
import { buildCoupangSignature } from './hmac'
import { COUPANG_API_BASE } from './index'

const MARKET = 'coupang' as const
const DEFAULT_TIMEOUT_MS = 15_000

// ─────────────────────────────────────────────
// Wing OpenAPI 응답 스키마
// ─────────────────────────────────────────────

const CoupangOrderItemEntrySchema = z.object({
  vendorItemName: z.string().optional().default(''),
  shippingCount: z.number().int().nonnegative().optional().default(1),
  orderPrice: z.number().int().nonnegative().optional().default(0),
})

const CoupangOrderEntrySchema = z.object({
  shipmentBoxId: z.union([z.string(), z.number()]),
  orderId: z.union([z.string(), z.number()]).optional(),
  ordererName: z.string().optional().default(''),
  receiverName: z.string().optional().default(''),
  receiverAddr1: z.string().optional().default(''),
  receiverAddr2: z.string().optional().default(''),
  receiverPhoneNumber: z.string().optional().default(''),
  orderItems: z.array(CoupangOrderItemEntrySchema).optional().default([]),
  status: z.string().optional().default('ACCEPT'),
  orderedAt: z.string().optional(),
})

const CoupangOrderListResponseSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
  data: z.array(CoupangOrderEntrySchema).optional(),
})

const CoupangShipmentResponseSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
  data: z
    .object({
      resultCode: z.string().optional(),
      resultMessage: z.string().optional(),
    })
    .optional(),
})

// ─────────────────────────────────────────────
// credential 추출
// ─────────────────────────────────────────────

export interface CoupangCredPayload {
  accessKey: string
  secretKey: string
  vendorId: string
}

export function extractCoupangCredPayload(
  credential: StoredCredential | undefined,
): CoupangCredPayload {
  if (!credential || credential.kind !== 'hmac') {
    throw new MarketError(
      'unauthorized',
      '쿠팡 fetchOrders: hmac StoredCredential 필요',
      { market: MARKET },
    )
  }
  return {
    accessKey: credential.payload.accessKey,
    secretKey: credential.payload.secretKey,
    vendorId: credential.payload.vendorId,
  }
}

export function normalizeCoupangStatus(raw: string): MarketOrderStatus {
  switch (raw) {
    case 'ACCEPT':
    case 'INSTRUCT':
      return 'new_pay'
    case 'DEPARTURE':
      return 'dispatched'
    case 'DELIVERING':
      return 'delivering'
    case 'FINAL_DELIVERY':
    case 'NONE_TRACKING':
      return 'delivered'
    case 'CANCEL':
    case 'CANCELED':
      return 'cancelled'
    case 'RETURNS':
      return 'returned'
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

function httpStatusToMarketError(
  status: number,
  message: string,
  correlationId: string,
): MarketError {
  if (status === 401 || status === 403) {
    return new MarketError('unauthorized', `쿠팡 인증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 429) {
    return new MarketError('rate_limit', '쿠팡 API rate limit', {
      market: MARKET,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError('server', `쿠팡 서버 오류 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 400 || status === 422) {
    return new MarketError('validation', `쿠팡 검증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  return new MarketError(
    'unknown',
    `쿠팡 API 오류 (${status}) correlationId=${correlationId}`,
    {
      market: MARKET,
      status,
      marketErrorMessage: message,
    },
  )
}

async function coupangFetchSigned(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, string>
  accessKey: string
  secretKey: string
  body?: unknown
  correlationId: string
  timeoutMs?: number
}): Promise<Response> {
  const {
    method,
    path,
    query,
    accessKey,
    secretKey,
    body,
    correlationId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  const queryString = query
    ? '?' +
      Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : ''

  // 쿠팡 HMAC 서명은 path 만 사용 (query 미포함이 Wing 표준 — buildCoupangSignature 정책).
  const { authorization } = await buildCoupangSignature({
    method,
    path,
    accessKey,
    secretKey,
  })

  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(`${COUPANG_API_BASE}${path}${queryString}`, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: authorization,
        'X-Correlation-Id': correlationId,
      },
      body: body !== undefined ? JSON.stringify(body) : null,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketError('network', '쿠팡 API 요청 timeout', {
        market: MARKET,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    throw new MarketError('network', '쿠팡 API 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }
}

// ─────────────────────────────────────────────
// fetchOrders — GET ordersheets?status=ACCEPT
// ─────────────────────────────────────────────

export async function coupangFetchOrders(
  input: FetchOrdersInput,
  credential: StoredCredential | undefined,
): Promise<MarketOrder[]> {
  const parsedInput = FetchOrdersInputSchema.safeParse(input)
  if (!parsedInput.success) {
    throw new MarketError(
      'validation',
      `쿠팡 fetchOrders 입력 형식 오류 — ${parsedInput.error.message}`,
      { market: MARKET, cause: parsedInput.error },
    )
  }

  const cred = extractCoupangCredPayload(credential)
  const correlationId = crypto.randomUUID()

  const query: Record<string, string> = { status: 'ACCEPT' }
  if (parsedInput.data.since) query.createdAtFrom = parsedInput.data.since
  if (parsedInput.data.until) query.createdAtTo = parsedInput.data.until

  const path = `/v2/providers/openapi/apis/api/v4/vendors/${encodeURIComponent(
    cred.vendorId,
  )}/ordersheets`

  const response = await coupangFetchSigned({
    method: 'GET',
    path,
    query,
    accessKey: cred.accessKey,
    secretKey: cred.secretKey,
    correlationId,
  })

  const text = await response.text()
  if (!response.ok) {
    throw httpStatusToMarketError(response.status, text, correlationId)
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new MarketError('server', '쿠팡 주문 응답 JSON 파싱 실패', {
      market: MARKET,
      status: response.status,
    })
  }

  const parsed = CoupangOrderListResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new MarketError('server', '쿠팡 주문 응답 스키마 불일치', {
      market: MARKET,
      cause: parsed.error,
    })
  }

  const items = parsed.data.data ?? []
  const orders: MarketOrder[] = items.map((item) => {
    const addr = [item.receiverAddr1, item.receiverAddr2]
      .filter((s) => s.length > 0)
      .join(' ')
    const first = item.orderItems[0]
    const totalAmount = item.orderItems.reduce(
      (sum, entry) => sum + entry.orderPrice * entry.shippingCount,
      0,
    )

    const order: MarketOrder = {
      market: MARKET,
      externalOrderId: String(item.shipmentBoxId),
      buyerName: item.ordererName.length > 0 ? item.ordererName : '미상',
      receiverName: item.receiverName.length > 0 ? item.receiverName : '미상',
      receiverAddress: addr.length > 0 ? addr : '주소 없음',
      receiverPhone:
        item.receiverPhoneNumber.length > 0
          ? item.receiverPhoneNumber
          : '연락처 없음',
      productName:
        first && first.vendorItemName.length > 0
          ? first.vendorItemName
          : '상품명 없음',
      quantity: first ? first.shippingCount : 1,
      orderAmount: totalAmount,
      status: normalizeCoupangStatus(item.status),
      paidAt: normalizeIsoOffset(item.orderedAt),
    }
    return MarketOrderSchema.parse(order)
  })

  return orders
}

// ─────────────────────────────────────────────
// submitTracking — PUT /orders/{shipmentBoxId}/ordersheets/shipments
// ─────────────────────────────────────────────

export async function coupangSubmitTracking(
  input: SubmitTrackingInput,
  credential: StoredCredential | undefined,
): Promise<MarketSubmitTrackingResult> {
  const parsedInput = SubmitTrackingInputSchema.safeParse(input)
  if (!parsedInput.success) {
    throw new MarketError(
      'validation',
      `쿠팡 submitTracking 입력 형식 오류 — ${parsedInput.error.message}`,
      { market: MARKET, cause: parsedInput.error },
    )
  }

  const cred = extractCoupangCredPayload(credential)
  const correlationId = crypto.randomUUID()

  // 쿠팡 deliveryCompanyCode: 'LOGEN' (Wing API 표준 코드).
  const body = {
    vendorId: cred.vendorId,
    shipmentBoxId: parsedInput.data.externalOrderId,
    deliveryCompanyCode: parsedInput.data.carrierCode, // 'LOGEN'
    invoiceNumber: parsedInput.data.waybillNumber,
  }

  const path = `/v2/providers/openapi/apis/api/v4/vendors/${encodeURIComponent(
    cred.vendorId,
  )}/orders/${encodeURIComponent(parsedInput.data.externalOrderId)}/ordersheets/shipments`

  const response = await coupangFetchSigned({
    method: 'PUT',
    path,
    accessKey: cred.accessKey,
    secretKey: cred.secretKey,
    body,
    correlationId,
  })

  const text = await response.text()

  if (!response.ok) {
    if (response.status === 400 || response.status === 422) {
      let parsedBody: { message?: string; code?: string } = {}
      try {
        parsedBody = JSON.parse(text) as { message?: string; code?: string }
      } catch {
        // fallthrough
      }
      return MarketSubmitTrackingResultSchema.parse({
        ok: false,
        errorCode: parsedBody.code ?? `http_${response.status}`,
        errorMessage:
          parsedBody.message ?? `쿠팡 발송 처리 거부 (${response.status})`,
      })
    }
    throw httpStatusToMarketError(response.status, text, correlationId)
  }

  let json: unknown = {}
  try {
    json = text.length > 0 ? JSON.parse(text) : {}
  } catch {
    throw new MarketError('server', '쿠팡 발송 응답 JSON 파싱 실패', {
      market: MARKET,
      status: response.status,
    })
  }

  const parsed = CoupangShipmentResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new MarketError('server', '쿠팡 발송 응답 스키마 불일치', {
      market: MARKET,
      cause: parsed.error,
    })
  }

  // 쿠팡은 응답 code "200" / data.resultCode "SUCCESS" 등 다양. 200 OK 면 성공.
  // data 의 resultCode 가 명시적으로 실패면 ok=false.
  const resultCode = parsed.data.data?.resultCode
  if (resultCode !== undefined && resultCode !== 'SUCCESS' && resultCode !== '0') {
    return MarketSubmitTrackingResultSchema.parse({
      ok: false,
      errorCode: resultCode,
      errorMessage:
        parsed.data.data?.resultMessage ?? parsed.data.message ?? '쿠팡 발송 처리 실패',
    })
  }

  return MarketSubmitTrackingResultSchema.parse({
    ok: true,
    dispatchId: String(parsedInput.data.externalOrderId),
  })
}
