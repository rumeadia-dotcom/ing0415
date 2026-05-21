/**
 * ESM 2.0 (G마켓·옥션) 공용 fetchOrders + submitTracking (v2 확장).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1, §6.4
 *
 * ESM 2.0 API (site='G' / site='A'):
 *   - getOrderList  (조회) — GET  /order
 *   - setShipInfo   (발송) — POST /shipment
 *
 * 인증: ESM JWT HS256 (credential kind = 'esm_jwt'). G·A 가 동일 base 사용, site 분기.
 *
 * 중요 제약:
 *   - masterId / secretKey 절대 로그 금지.
 *   - submitTracking 마켓 정상 거부 (검증 실패 / 이미 발송) → ok=false 반환.
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
import { ESM_API_BASE } from './shared-adapter'

const DEFAULT_TIMEOUT_MS = 15_000

// ─────────────────────────────────────────────
// ESM 응답 스키마
// ─────────────────────────────────────────────

const EsmOrderEntrySchema = z.object({
  orderNo: z.union([z.string(), z.number()]),
  buyerName: z.string().optional().default(''),
  receiverName: z.string().optional().default(''),
  receiverZipCode: z.string().optional().default(''),
  receiverAddress: z.string().optional().default(''),
  receiverPhone: z.string().optional().default(''),
  itemName: z.string().optional().default(''),
  orderQty: z.number().int().nonnegative().optional().default(1),
  orderPrice: z.number().int().nonnegative().optional().default(0),
  orderStatus: z.string().optional().default('PAID'),
  paidDate: z.string().optional(),
})

const EsmOrderListResponseSchema = z.object({
  resultCode: z.string().optional(),
  resultMessage: z.string().optional(),
  data: z
    .object({
      orders: z.array(EsmOrderEntrySchema).optional().default([]),
    })
    .optional(),
})

const EsmShipResponseSchema = z.object({
  resultCode: z.string().optional(),
  resultMessage: z.string().optional(),
  data: z
    .object({
      shipNo: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
})

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

export function normalizeEsmStatus(raw: string): MarketOrderStatus {
  switch (raw) {
    case 'PAID':
    case 'PAY_COMPLETE':
      return 'new_pay'
    case 'SHIPPED':
    case 'DISPATCHED':
      return 'dispatched'
    case 'DELIVERING':
      return 'delivering'
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

function normalizeIsoOffset(raw: string | undefined): string {
  if (!raw) return '1970-01-01T00:00:00+00:00'
  if (/[+-]\d{2}:\d{2}$/.test(raw)) return raw
  if (raw.endsWith('Z')) return raw.replace(/Z$/, '+00:00')
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '1970-01-01T00:00:00+00:00'
  return d.toISOString().replace(/Z$/, '+00:00')
}

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
  query?: Record<string, string>
  cred: EsmCredPayload
  body?: unknown
  correlationId: string
  timeoutMs?: number
}): Promise<Response> {
  const {
    market,
    method,
    path,
    query,
    cred,
    body,
    correlationId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  const { token } = await buildEsmJwt({
    masterId: cred.masterId,
    secretKey: cred.secretKey,
    site: cred.site,
  })

  const queryString = query
    ? '?' +
      Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : ''

  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(`${ESM_API_BASE}${path}${queryString}`, {
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
// fetchOrders — ESM getOrderList (site 분기)
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

  const query: Record<string, string> = {
    site,
    sellerId: cred.sellerId,
  }
  if (parsedInput.data.since) query.from = parsedInput.data.since
  if (parsedInput.data.until) query.to = parsedInput.data.until

  const response = await esmFetchSigned({
    market,
    method: 'GET',
    path: '/order',
    query,
    cred,
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

  const items = parsed.data.data?.orders ?? []
  const orders: MarketOrder[] = items.map((item) => {
    const order: MarketOrder = {
      market,
      externalOrderId: String(item.orderNo),
      buyerName: item.buyerName.length > 0 ? item.buyerName : '미상',
      receiverName: item.receiverName.length > 0 ? item.receiverName : '미상',
      receiverAddress:
        item.receiverAddress.length > 0 ? item.receiverAddress : '주소 없음',
      receiverPhone: item.receiverPhone.length > 0 ? item.receiverPhone : '연락처 없음',
      productName: item.itemName.length > 0 ? item.itemName : '상품명 없음',
      quantity: item.orderQty > 0 ? item.orderQty : 1,
      orderAmount: item.orderPrice,
      status: normalizeEsmStatus(item.orderStatus),
      paidAt: normalizeIsoOffset(item.paidDate),
    }
    return MarketOrderSchema.parse(order)
  })

  return orders
}

// ─────────────────────────────────────────────
// submitTracking — ESM setShipInfo (site 분기)
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

  const body = {
    site,
    sellerId: cred.sellerId,
    orderNo: parsedInput.data.externalOrderId,
    deliveryCompanyCode: parsedInput.data.carrierCode, // 'LOGEN'
    invoiceNumber: parsedInput.data.waybillNumber,
  }

  const response = await esmFetchSigned({
    market,
    method: 'POST',
    path: '/shipment',
    cred,
    body,
    correlationId,
  })

  const text = await response.text()

  if (!response.ok) {
    if (response.status === 400 || response.status === 422) {
      let parsedBody: { resultMessage?: string; resultCode?: string } = {}
      try {
        parsedBody = JSON.parse(text) as {
          resultMessage?: string
          resultCode?: string
        }
      } catch {
        // fallthrough
      }
      return MarketSubmitTrackingResultSchema.parse({
        ok: false,
        errorCode: parsedBody.resultCode ?? `http_${response.status}`,
        errorMessage:
          parsedBody.resultMessage ??
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

  // ESM resultCode '0000' / 'SUCCESS' 가 성공. 그 외 → ok=false.
  const code = parsed.data.resultCode
  if (code !== undefined && code !== '0000' && code !== 'SUCCESS') {
    return MarketSubmitTrackingResultSchema.parse({
      ok: false,
      errorCode: code,
      errorMessage: parsed.data.resultMessage ?? `ESM(${market}) 발송 처리 실패`,
    })
  }

  return MarketSubmitTrackingResultSchema.parse({
    ok: true,
    ...(parsed.data.data?.shipNo !== undefined
      ? { dispatchId: String(parsed.data.data.shipNo) }
      : {}),
  })
}
