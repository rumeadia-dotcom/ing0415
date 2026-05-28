/**
 * 쿠팡 Wing OpenAPI — fetchOrders + submitTracking (v2 확장).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1, §6.4
 *
 * 엔드포인트:
 *   - GET /v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets?status=ACCEPT
 *     (v4 → v5 마이그레이션 — 응답이 nested orderer/receiver/Money 객체 형태로 변경됨;
 *      v4 flat shape 도 fallback 으로 수용)
 *   - POST /v2/providers/openapi/apis/api/v4/vendors/{vendorId}/orders/invoices
 *     (구버전 PUT /orders/{shipmentBoxId}/ordersheets/shipments → 공식 docs 의
 *      POST /orders/invoices 로 정정; body 가 orderSheetInvoiceApplyDtos 배열 구조)
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

/**
 * 쿠팡 Money 객체 — v5 부터 가격 필드가 { currencyCode, units, nanos } nested 로 변경.
 * v4 의 scalar number 도 mapCoupangOrderPrice 에서 fallback 처리.
 */
const CoupangMoneySchema = z.object({
  currencyCode: z.string().optional().default('KRW'),
  units: z.number().optional().default(0),
  nanos: z.number().optional().default(0),
})

const CoupangOrderItemEntrySchema = z.object({
  vendorItemName: z.string().optional().default(''),
  vendorItemId: z.number().optional(),
  shippingCount: z.number().int().nonnegative().optional().default(1),
  // v5: orderPrice 가 Money 객체 / v4: scalar number → union 으로 둘 다 수용.
  orderPrice: z.union([CoupangMoneySchema, z.number()]).optional(),
})

// v5 nested orderer / receiver — optional 로 두어 v4 flat 필드도 함께 수용.
const CoupangOrdererSchema = z.object({
  name: z.string().optional().default(''),
  safeNumber: z.string().optional().default(''),
  ordererNumber: z.string().nullable().optional(),
})

const CoupangReceiverSchema = z.object({
  name: z.string().optional().default(''),
  safeNumber: z.string().optional().default(''),
  receiverNumber: z.string().nullable().optional(),
  addr1: z.string().optional().default(''),
  addr2: z.string().optional().default(''),
})

const CoupangOrderEntrySchema = z.object({
  shipmentBoxId: z.union([z.string(), z.number()]),
  orderId: z.union([z.string(), z.number()]).optional(),
  // v5 nested
  orderer: CoupangOrdererSchema.optional(),
  receiver: CoupangReceiverSchema.optional(),
  paidAt: z.string().optional(),
  // v4 flat (하위호환)
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
  nextToken: z.string().optional(),
})

/**
 * v5 Money 객체 또는 v4 scalar number 를 KRW 정수로 정규화.
 * v5: units 가 정수 부분 (KRW 는 nanos 무시).
 */
function moneyToKrw(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'units' in value) {
    const units = (value as { units?: number }).units
    return typeof units === 'number' ? units : 0
  }
  return 0
}

/**
 * 송장 업로드 응답 — v4 /orders/invoices.
 *
 * 공식 응답:
 *   {
 *     code: 200 | "200",
 *     message: "OK",
 *     data: {
 *       responseCode: 0 (SUCCESS) | 1 (PARTIAL_ERROR) | 99 (FAILED),
 *       responseMessage: "SUCCESS" | ...,
 *       responseList: [{ shipmentBoxId, succeed, resultCode: 'OK'|..., resultMessage, retryRequired }]
 *     }
 *   }
 */
const CoupangShipmentResponseListEntrySchema = z.object({
  shipmentBoxId: z.union([z.string(), z.number()]).optional(),
  succeed: z.boolean().optional(),
  resultCode: z.string().optional(),
  resultMessage: z.string().nullable().optional(),
  retryRequired: z.boolean().optional(),
})

const CoupangShipmentResponseSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
  data: z
    .object({
      // v4 /orders/invoices 신규 shape
      responseCode: z.union([z.number(), z.string()]).optional(),
      responseMessage: z.string().optional(),
      responseList: z.array(CoupangShipmentResponseListEntrySchema).optional(),
      // 하위호환 (구 /ordersheets/shipments 단건 응답)
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

  const path = `/v2/providers/openapi/apis/api/v5/vendors/${encodeURIComponent(
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
    // v5 nested orderer/receiver 우선, 없으면 v4 flat 필드 fallback.
    const ordererName = item.orderer?.name ?? item.ordererName
    const receiverName = item.receiver?.name ?? item.receiverName
    const receiverAddr1 = item.receiver?.addr1 ?? item.receiverAddr1
    const receiverAddr2 = item.receiver?.addr2 ?? item.receiverAddr2
    const receiverPhone =
      item.receiver?.safeNumber ||
      item.receiver?.receiverNumber ||
      item.receiverPhoneNumber
    const paidAtRaw = item.paidAt ?? item.orderedAt

    const addr = [receiverAddr1, receiverAddr2]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' ')
    const first = item.orderItems[0]
    const totalAmount = item.orderItems.reduce(
      (sum, entry) => sum + moneyToKrw(entry.orderPrice) * entry.shippingCount,
      0,
    )

    const order: MarketOrder = {
      market: MARKET,
      externalOrderId: String(item.shipmentBoxId),
      buyerName: ordererName && ordererName.length > 0 ? ordererName : '미상',
      receiverName: receiverName && receiverName.length > 0 ? receiverName : '미상',
      receiverAddress: addr.length > 0 ? addr : '주소 없음',
      receiverPhone:
        receiverPhone && receiverPhone.length > 0 ? receiverPhone : '연락처 없음',
      productName:
        first && first.vendorItemName.length > 0
          ? first.vendorItemName
          : '상품명 없음',
      quantity: first ? first.shippingCount : 1,
      orderAmount: totalAmount,
      status: normalizeCoupangStatus(item.status),
      paidAt: normalizeIsoOffset(paidAtRaw),
    }
    return MarketOrderSchema.parse(order)
  })

  return orders
}

// ─────────────────────────────────────────────
// submitTracking — POST /orders/invoices
//
// 공식 docs (Zendesk article 360033793014, 2026-05-28 추출):
//   POST /v2/providers/openapi/apis/api/v4/vendors/{vendorId}/orders/invoices
//   body: {
//     vendorId, orderSheetInvoiceApplyDtos: [{ shipmentBoxId, orderId,
//       vendorItemId, deliveryCompanyCode, invoiceNumber, splitShipping,
//       preSplitShipped, estimatedShippingDate }]
//   }
//
// 한계: SubmitTrackingInputSchema 에 orderId / vendorItemId 가 없음. v1 MVP 의
// SubmitTrackingInput 은 externalOrderId(=shipmentBoxId) / waybillNumber /
// carrierCode 만 보유 — 쿠팡 v4 invoices 가 요구하는 orderId / vendorItemId 는
// 별도 PR 에서 SubmitTrackingInput 확장 후 채워야 한다. 현재 PR 은 path /
// method / body 구조만 정정하고 누락 필드는 0 으로 보낸다 (마켓이 거부하면
// ok=false 반환).
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
  // shipmentBoxId 는 Number 가 표준이지만 SubmitTrackingInput 은 string —
  // Number 변환 후 NaN 이면 fallback 으로 string 그대로 (마켓에서 거부).
  const shipmentBoxIdNum = Number(parsedInput.data.externalOrderId)
  const body = {
    vendorId: cred.vendorId,
    orderSheetInvoiceApplyDtos: [
      {
        shipmentBoxId: Number.isFinite(shipmentBoxIdNum)
          ? shipmentBoxIdNum
          : parsedInput.data.externalOrderId,
        // SubmitTrackingInput 미보유 필드 — schema 확장 후 채울 것 (별도 PR).
        orderId: 0,
        vendorItemId: 0,
        deliveryCompanyCode: parsedInput.data.carrierCode, // 'LOGEN'
        invoiceNumber: parsedInput.data.waybillNumber,
        splitShipping: false,
        preSplitShipped: false,
        estimatedShippingDate: '',
      },
    ],
  }

  const path = `/v2/providers/openapi/apis/api/v4/vendors/${encodeURIComponent(
    cred.vendorId,
  )}/orders/invoices`

  const response = await coupangFetchSigned({
    method: 'POST',
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

  // v4 /orders/invoices 응답: data.responseList[0].succeed + resultCode='OK' 면 성공.
  // PARTIAL_ERROR / FAILED 또는 succeed=false → ok=false.
  const list = parsed.data.data?.responseList ?? []
  const firstEntry = list[0]
  if (firstEntry !== undefined) {
    if (firstEntry.succeed === false) {
      return MarketSubmitTrackingResultSchema.parse({
        ok: false,
        errorCode: firstEntry.resultCode ?? 'COUPANG_SHIPMENT_FAILED',
        errorMessage:
          firstEntry.resultMessage ??
          parsed.data.data?.responseMessage ??
          parsed.data.message ??
          '쿠팡 송장 업로드 실패',
      })
    }
    if (firstEntry.resultCode !== undefined && firstEntry.resultCode !== 'OK') {
      return MarketSubmitTrackingResultSchema.parse({
        ok: false,
        errorCode: firstEntry.resultCode,
        errorMessage:
          firstEntry.resultMessage ??
          parsed.data.data?.responseMessage ??
          parsed.data.message ??
          '쿠팡 송장 업로드 실패',
      })
    }
  }

  // 전체 responseCode 가 명시적 실패인 경우.
  const responseCode = parsed.data.data?.responseCode
  if (
    responseCode !== undefined &&
    String(responseCode) !== '0' &&
    String(responseCode) !== 'SUCCESS'
  ) {
    return MarketSubmitTrackingResultSchema.parse({
      ok: false,
      errorCode: String(responseCode),
      errorMessage:
        parsed.data.data?.responseMessage ??
        parsed.data.message ??
        '쿠팡 송장 업로드 실패',
    })
  }

  // 하위호환 — 구 단건 응답 (data.resultCode 'SUCCESS' / '0' 외 실패).
  const legacyResultCode = parsed.data.data?.resultCode
  if (
    legacyResultCode !== undefined &&
    legacyResultCode !== 'SUCCESS' &&
    legacyResultCode !== '0' &&
    legacyResultCode !== 'OK'
  ) {
    return MarketSubmitTrackingResultSchema.parse({
      ok: false,
      errorCode: legacyResultCode,
      errorMessage:
        parsed.data.data?.resultMessage ??
        parsed.data.message ??
        '쿠팡 발송 처리 실패',
    })
  }

  return MarketSubmitTrackingResultSchema.parse({
    ok: true,
    dispatchId: String(parsedInput.data.externalOrderId),
  })
}
