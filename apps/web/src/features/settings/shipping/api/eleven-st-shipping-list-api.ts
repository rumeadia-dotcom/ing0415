import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  ElevenStShippingAddressListResponseSchema,
  type ElevenStShippingAddressListResponse,
} from '@/lib/schemas/eleven-st'

/**
 * 11번가 출고지/반품지 조회 도메인 API (PR-2 frontend).
 *
 * 마스터: docs/architecture/v1/features/11st.md §3 / §4.6 / §5 / §7(PR-2)
 *
 * 호출: getElevenStShippingAddresses(marketAccountId) → Edge `eleven-st-shipping-list`
 *   (셀러는 marketAccountId 만 — Edge 가 ownership 검증 + 11번가 1014/1015 조회 + 정규화 반환).
 *
 * 보안 경계 (11st.md §3 / security.md):
 *   - 응답에는 addrSeq(시퀀스) + addrNm(주소명)만 — PII(주소·전화·이름) 없음.
 *   - 우리 DB 에 저장하지 않는다(조회만). select 옵션 채움 + 등록 payload addrSeq 주입 용도.
 */

export class ElevenStShippingListError extends Error {
  readonly code: string
  readonly correlationId: string | null
  readonly raw: unknown

  constructor(
    payload: { code: string; message: string; correlationId?: string | null },
    raw?: unknown,
  ) {
    super(payload.message)
    this.name = 'ElevenStShippingListError'
    this.code = payload.code
    this.correlationId = payload.correlationId ?? null
    this.raw = raw
  }
}

/**
 * 셀러의 11번가 출고지/반품지 목록을 조회한다.
 * 빈 배열(outbound/returnAddrs)은 셀러오피스 미등록 — 에러 아님(UI empty 상태).
 */
export async function getElevenStShippingAddresses(
  marketAccountId: string,
): Promise<ElevenStShippingAddressListResponse> {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>(
    'eleven-st-shipping-list',
    { body: { marketAccountId } },
  )

  if (error) {
    logger.warn({ err: error.message }, '← eleven-st-shipping-list error')
    // Supabase JS v2 FunctionsHttpError: error.context 가 fetch Response (body 는 ReadableStream).
    // markets-api.invokeEdge 와 동일하게 clone().json() 으로 본문 파싱 후 code/message 복원.
    let errorBody: unknown = data
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
      try {
        errorBody = await ctx.clone().json()
      } catch {
        // body 가 JSON 이 아닐 수 있음 — data 폴백 유지
      }
    }
    const parsed = parseEdgeError(errorBody)
    if (parsed) {
      throw new ElevenStShippingListError(parsed, error)
    }
    throw new ElevenStShippingListError(
      { code: 'internal', message: error.message },
      error,
    )
  }

  // error 없이 본문에 { code, message } 를 담아 4xx 를 흉내내는 경우도 방어.
  const inline = parseEdgeError(data)
  if (inline) {
    throw new ElevenStShippingListError(inline, data)
  }

  return ElevenStShippingAddressListResponseSchema.parse(data)
}

/** Edge `err()` 본문(`{ error: { code, message, correlationId } }`) 또는 flat 형태를 정규화. */
function parseEdgeError(
  body: unknown,
): { code: string; message: string; correlationId?: string | null } | null {
  if (body === null || typeof body !== 'object') return null
  const obj = body as Record<string, unknown>
  const inner = obj.error
  if (inner && typeof inner === 'object') {
    const e = inner as Record<string, unknown>
    if (typeof e.code === 'string' && typeof e.message === 'string') {
      return {
        code: e.code,
        message: e.message,
        correlationId:
          typeof e.correlationId === 'string' ? e.correlationId : null,
      }
    }
  }
  if (typeof obj.code === 'string' && typeof obj.message === 'string') {
    return {
      code: obj.code,
      message: obj.message,
      correlationId:
        typeof obj.correlationId === 'string' ? obj.correlationId : null,
    }
  }
  return null
}

// ─────────────────────────────────────────────
// Query Key 팩토리 — [domain, ...filters] 규약
// ─────────────────────────────────────────────

export const elevenStShippingListQueryKeys = {
  all: ['eleven-st-shipping-list'] as const,
  list: (sellerId: string | null, marketAccountId: string | null) =>
    ['eleven-st-shipping-list', { sellerId, marketAccountId }] as const,
}
