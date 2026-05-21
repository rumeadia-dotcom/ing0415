/**
 * 네이버 Commerce API — fetchOrders + submitTracking (v2 확장).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD-v2-shipping.md §2.1, §2.4
 *
 * 엔드포인트:
 *   - GET   /external/v1/pay-order/seller/orders/new-pay-waiting
 *   - PATCH /external/v1/orders/{orderId}/dispatch
 *
 * 인증: OAuth 2.0 (credential kind = 'oauth'). authenticate() 후 인스턴스 cred
 *       또는 명시 인자 credential 어느 쪽이든 받는다.
 *
 * 중요 제약:
 *   - accessToken 은 절대 로그 금지. 헤더에만 부여.
 *   - PII (buyerName / receiverName / receiverPhone / receiverAddress) 는 본 모듈
 *     반환값에 포함되지만 logger 의 redact() 로 마스킹 (security.md §6.2).
 *   - submitTracking 의 마켓 정상 거부 (예: 이미 발송됨) 는 throw 가 아닌 ok=false 반환.
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
import { NAVER_API_BASE } from './index'

const MARKET = 'naver' as const
const DEFAULT_TIMEOUT_MS = 15_000

// ─────────────────────────────────────────────
// 응답 스키마 (Naver Commerce API)
// ─────────────────────────────────────────────

const NaverOrderItemSchema = z.object({
  productOrderId: z.union([z.string(), z.number()]),
  orderId: z.union([z.string(), z.number()]).optional(),
  buyerName: z.string().optional().default(''),
  shippingAddress: z
    .object({
      name: z.string().optional().default(''),
      tel1: z.string().optional().default(''),
      baseAddress: z.string().optional().default(''),
      detailAddress: z.string().optional().default(''),
    })
    .optional(),
  productName: z.string().optional().default(''),
  quantity: z.number().int().nonnegative().optional().default(1),
  totalPaymentAmount: z.number().int().nonnegative().optional().default(0),
  productOrderStatus: z.string().optional().default('PAYED'),
  paymentDate: z.string().optional(),
})

const NaverOrderListResponseSchema = z.object({
  data: z.array(NaverOrderItemSchema).optional(),
})

const NaverDispatchResponseSchema = z.object({
  // 성공 시 dispatchId 또는 빈 객체. 오류는 message / code.
  dispatchId: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
  code: z.string().optional(),
})

// ─────────────────────────────────────────────
// 유틸 — credential 추출 / status 정규화
// ─────────────────────────────────────────────

export function extractNaverAccessToken(
  credential: StoredCredential | undefined,
): string {
  if (!credential || credential.kind !== 'oauth') {
    throw new MarketError(
      'unauthorized',
      '네이버 fetchOrders: oauth StoredCredential 필요',
      { market: MARKET },
    )
  }
  return credential.payload.accessToken
}

/**
 * Naver productOrderStatus → 정규화된 MarketOrderStatus.
 * 매핑 외 값은 'unknown' 으로 안전 fallback.
 */
export function normalizeNaverStatus(raw: string): MarketOrderStatus {
  switch (raw) {
    case 'PAYED':
    case 'NEW_PAY_WAITING':
      return 'new_pay'
    case 'DELIVERING':
    case 'DISPATCHED':
      return 'dispatched'
    case 'DELIVERED':
      return 'delivered'
    case 'CANCELED':
    case 'CANCELLED':
      return 'cancelled'
    case 'RETURNED':
      return 'returned'
    default:
      return 'unknown'
  }
}

/**
 * Naver paymentDate → ISO 8601 + offset.
 * 입력이 빈 값이면 epoch fallback (호출측 검증 책임).
 */
function normalizeIsoOffset(raw: string | undefined): string {
  if (!raw) return '1970-01-01T00:00:00+00:00'
  // toISOString() 'Z' → '+00:00'.
  if (/[+-]\d{2}:\d{2}$/.test(raw)) return raw
  if (raw.endsWith('Z')) return raw.replace(/Z$/, '+00:00')
  // 파싱 시도.
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
    return new MarketError('unauthorized', `네이버 인증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 429) {
    return new MarketError('rate_limit', '네이버 API rate limit', {
      market: MARKET,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError('server', `네이버 서버 오류 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 400 || status === 422) {
    return new MarketError('validation', `네이버 검증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  return new MarketError(
    'unknown',
    `네이버 API 오류 (${status}) correlationId=${correlationId}`,
    {
      market: MARKET,
      status,
      marketErrorMessage: message,
    },
  )
}

async function naverFetchWithToken(opts: {
  method: 'GET' | 'POST' | 'PATCH'
  path: string
  accessToken: string
  body?: unknown
  query?: Record<string, string>
  correlationId: string
  timeoutMs?: number
}): Promise<Response> {
  const {
    method,
    path,
    accessToken,
    body,
    query,
    correlationId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), timeoutMs)

  const queryString = query
    ? '?' +
      Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : ''

  try {
    return await fetch(`${NAVER_API_BASE}${path}${queryString}`, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `Bearer ${accessToken}`,
        'X-Correlation-Id': correlationId,
      },
      body: body !== undefined ? JSON.stringify(body) : null,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketError('network', '네이버 API 요청 timeout', {
        market: MARKET,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    throw new MarketError('network', '네이버 API 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }
}

// ─────────────────────────────────────────────
// fetchOrders — GET /external/v1/pay-order/seller/orders/new-pay-waiting
// ─────────────────────────────────────────────

export async function naverFetchOrders(
  input: FetchOrdersInput,
  credential: StoredCredential | undefined,
): Promise<MarketOrder[]> {
  const parsedInput = FetchOrdersInputSchema.safeParse(input)
  if (!parsedInput.success) {
    throw new MarketError(
      'validation',
      `네이버 fetchOrders 입력 형식 오류 — ${parsedInput.error.message}`,
      { market: MARKET, cause: parsedInput.error },
    )
  }

  const accessToken = extractNaverAccessToken(credential)
  const correlationId = crypto.randomUUID()

  const query: Record<string, string> = {}
  if (parsedInput.data.since) query.from = parsedInput.data.since
  if (parsedInput.data.until) query.to = parsedInput.data.until

  const response = await naverFetchWithToken({
    method: 'GET',
    path: '/external/v1/pay-order/seller/orders/new-pay-waiting',
    accessToken,
    query,
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
    throw new MarketError('server', '네이버 주문 응답 JSON 파싱 실패', {
      market: MARKET,
      status: response.status,
    })
  }

  const parsed = NaverOrderListResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new MarketError('server', '네이버 주문 응답 스키마 불일치', {
      market: MARKET,
      cause: parsed.error,
    })
  }

  const items = parsed.data.data ?? []
  const orders: MarketOrder[] = items.map((item) => {
    const baseAddr = item.shippingAddress?.baseAddress ?? ''
    const detailAddr = item.shippingAddress?.detailAddress ?? ''
    const fullAddr = [baseAddr, detailAddr].filter((s) => s.length > 0).join(' ')

    const order: MarketOrder = {
      market: MARKET,
      externalOrderId: String(item.productOrderId),
      buyerName: item.buyerName.length > 0 ? item.buyerName : '미상',
      receiverName:
        (item.shippingAddress?.name?.length ?? 0) > 0
          ? (item.shippingAddress?.name as string)
          : item.buyerName.length > 0
            ? item.buyerName
            : '미상',
      receiverAddress: fullAddr.length > 0 ? fullAddr : '주소 없음',
      receiverPhone:
        (item.shippingAddress?.tel1?.length ?? 0) > 0
          ? (item.shippingAddress?.tel1 as string)
          : '연락처 없음',
      productName: item.productName.length > 0 ? item.productName : '상품명 없음',
      quantity: item.quantity > 0 ? item.quantity : 1,
      orderAmount: item.totalPaymentAmount,
      status: normalizeNaverStatus(item.productOrderStatus),
      paidAt: normalizeIsoOffset(item.paymentDate),
    }
    return MarketOrderSchema.parse(order)
  })

  return orders
}

// ─────────────────────────────────────────────
// submitTracking — PATCH /external/v1/orders/{orderId}/dispatch
// ─────────────────────────────────────────────

export async function naverSubmitTracking(
  input: SubmitTrackingInput,
  credential: StoredCredential | undefined,
): Promise<MarketSubmitTrackingResult> {
  const parsedInput = SubmitTrackingInputSchema.safeParse(input)
  if (!parsedInput.success) {
    throw new MarketError(
      'validation',
      `네이버 submitTracking 입력 형식 오류 — ${parsedInput.error.message}`,
      { market: MARKET, cause: parsedInput.error },
    )
  }

  const accessToken = extractNaverAccessToken(credential)
  const correlationId = crypto.randomUUID()

  // 네이버 deliveryCompanyCode: 'LOGEN' (Naver Commerce API 표준 코드).
  const body = {
    dispatchProductOrders: [
      {
        productOrderId: parsedInput.data.externalOrderId,
        deliveryMethod: 'DELIVERY',
        deliveryCompanyCode: parsedInput.data.carrierCode, // 'LOGEN'
        trackingNumber: parsedInput.data.waybillNumber,
      },
    ],
  }

  const response = await naverFetchWithToken({
    method: 'PATCH',
    path: `/external/v1/orders/${encodeURIComponent(parsedInput.data.externalOrderId)}/dispatch`,
    accessToken,
    body,
    correlationId,
  })

  const text = await response.text()

  if (!response.ok) {
    // 400/422 = 마켓 정상 거부 (이미 발송 / 검증 실패 등). throw 가 아닌 ok=false.
    // 401/403/429/5xx 는 횡단 실패 → throw.
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
          parsedBody.message ?? `네이버 발송 처리 거부 (${response.status})`,
      })
    }
    throw httpStatusToMarketError(response.status, text, correlationId)
  }

  let json: unknown = {}
  try {
    json = text.length > 0 ? JSON.parse(text) : {}
  } catch {
    throw new MarketError('server', '네이버 발송 응답 JSON 파싱 실패', {
      market: MARKET,
      status: response.status,
    })
  }

  const parsed = NaverDispatchResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new MarketError('server', '네이버 발송 응답 스키마 불일치', {
      market: MARKET,
      cause: parsed.error,
    })
  }

  return MarketSubmitTrackingResultSchema.parse({
    ok: true,
    ...(parsed.data.dispatchId !== undefined
      ? { dispatchId: String(parsed.data.dispatchId) }
      : {}),
  })
}
