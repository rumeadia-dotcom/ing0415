import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  EsmShippingListResponseSchema,
  type EsmShippingListResponse,
} from '@/lib/schemas/esm'

/**
 * ESM(G마켓·옥션) 출하지/발송정책 조회 도메인 API (PR-E2 frontend).
 *
 * 마스터:
 *   - docs/architecture/v1/features/esm.md "⚠ 전환 결정 (2026-05-30): 생성형 → 조회형" / PR-E2
 *   - docs/architecture/v1/cross-cutting/shipping-fee-model.md §2 (Layer 2 조회형 단일 표준)
 *
 * 호출: getEsmShippingOptions(marketAccountId) → Edge `esm-shipping-list`
 *   (POST { marketAccountId } body — supabase-js functions.invoke 규약, 11번가 eleven-st-shipping-list 와 동일).
 *   Edge 가 ownership 검증 + ESM 17(출하지)/19(발송정책) 조회 + 정규화 반환.
 *
 * 보안 경계 (esm.md "전환 결정" / security.md §2):
 *   - 응답에는 placeNo/placeName + dispatchPolicyNo/dispatchPolicyName 만 — PII(주소·연락처) 없음.
 *   - 우리 DB 에 저장하지 않는다(조회만). select 옵션 채움 + 등록 payload 번호 주입 용도.
 *   - 발송정책은 사이트별(G/A) — 응답이 site 로 태깅되며 호출한 계정 site 분만 내려온다.
 */

export class EsmShippingListError extends Error {
  readonly code: string
  readonly correlationId: string | null
  readonly raw: unknown

  constructor(
    payload: { code: string; message: string; correlationId?: string | null },
    raw?: unknown,
  ) {
    super(payload.message)
    this.name = 'EsmShippingListError'
    this.code = payload.code
    this.correlationId = payload.correlationId ?? null
    this.raw = raw
  }
}

/**
 * 셀러의 ESM 출하지/발송정책 목록을 조회한다.
 * 빈 배열(places/dispatchPolicies)은 ESM Plus 미등록 — 에러 아님(UI empty 상태).
 */
export async function getEsmShippingOptions(
  marketAccountId: string,
): Promise<EsmShippingListResponse> {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>(
    'esm-shipping-list',
    { body: { marketAccountId } },
  )

  if (error) {
    logger.warn({ err: error.message }, '← esm-shipping-list error')
    // Supabase JS v2 FunctionsHttpError: error.context 가 fetch Response (body 는 ReadableStream).
    // markets-api.invokeEdge / eleven-st-shipping-list-api 와 동일하게 clone().json() 으로 본문 파싱.
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
      throw new EsmShippingListError(parsed, error)
    }
    throw new EsmShippingListError(
      { code: 'internal', message: error.message },
      error,
    )
  }

  // error 없이 본문에 { code, message } 를 담아 4xx 를 흉내내는 경우도 방어.
  const inline = parseEdgeError(data)
  if (inline) {
    throw new EsmShippingListError(inline, data)
  }

  return EsmShippingListResponseSchema.parse(data)
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

export const esmShippingListQueryKeys = {
  all: ['esm-shipping-list'] as const,
  list: (sellerId: string | null, marketAccountId: string | null) =>
    ['esm-shipping-list', { sellerId, marketAccountId }] as const,
}
