import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  EsmShippingProfileSchema,
  EsmShippingProfileCreateInputSchema,
  type EsmShippingProfile,
  type EsmShippingProfileCreateInput,
} from '@/lib/schemas/esm'

/**
 * ESM(G마켓/옥션) 배송 프로필 도메인 API (PR-3 frontend).
 *
 * 마스터: docs/architecture/v1/features/esm.md §3 / §4.5 / §5 / §7(PR-3)
 *
 * 호출 매트릭스:
 *  - listEsmShippingProfiles(marketAccountId?) → market_accounts RLS 적용 직접 SELECT
 *      (esm_shipping_profiles SELECT 는 본인 row 만 허용 — esm.md §3.1).
 *  - createEsmShippingProfile(input)          → Edge Function `esm-shipping-profile`
 *      (셀러는 폼만 — Edge 가 ESM 4단계 생성 + service_role INSERT. esm.md §1.3/§3.1).
 *
 * 보안 경계 (esm.md §3 / security.md):
 *  - 응답/목록에는 ESM 식별 번호(addrNo/placeNo/dispatchPolicyNo)만 — PII(주소·전화) 없음.
 *  - 생성 입력의 address(PII)는 Edge 호출 바디에만 존재, 우리 DB 엔 저장되지 않는다.
 */

export class EsmShippingProfileError extends Error {
  readonly code: string
  readonly correlationId: string | null
  readonly raw: unknown

  constructor(
    payload: { code: string; message: string; correlationId?: string | null },
    raw?: unknown,
  ) {
    super(payload.message)
    this.name = 'EsmShippingProfileError'
    this.code = payload.code
    this.correlationId = payload.correlationId ?? null
    this.raw = raw
  }
}

// ─────────────────────────────────────────────
// 목록 — RLS 적용된 직접 SELECT (esm_shipping_profiles)
// ─────────────────────────────────────────────

interface EsmShippingProfileRow {
  id: string
  seller_id: string
  market_account_id: string
  site: string
  profile_label: string
  addr_no: string
  place_no: string
  bundle_policy_no: string | null
  dispatch_policy_no: string
  dispatch_type: string
  shipping_fee: number
  fee_type: number
  status: string
  created_at: string
  updated_at: string
}

const PROFILE_COLUMNS =
  'id, seller_id, market_account_id, site, profile_label, addr_no, place_no, ' +
  'bundle_policy_no, dispatch_policy_no, dispatch_type, shipping_fee, fee_type, ' +
  'status, created_at, updated_at'

function rowToProfile(row: EsmShippingProfileRow): EsmShippingProfile {
  return EsmShippingProfileSchema.parse({
    id: row.id,
    sellerId: row.seller_id,
    marketAccountId: row.market_account_id,
    site: row.site,
    profileLabel: row.profile_label,
    addrNo: row.addr_no,
    placeNo: row.place_no,
    bundlePolicyNo: row.bundle_policy_no,
    dispatchPolicyNo: row.dispatch_policy_no,
    dispatchType: row.dispatch_type,
    shippingFee: row.shipping_fee,
    feeType: row.fee_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

/**
 * 셀러의 ESM 배송 프로필 목록. marketAccountId 지정 시 해당 계정으로 필터.
 * RLS 가 seller_id = auth.uid() 적용 → 응답에 자신의 행만.
 */
export async function listEsmShippingProfiles(
  marketAccountId?: string,
): Promise<EsmShippingProfile[]> {
  const supabase = getSupabase()
  // status='active' 만 노출 — 부분 실패 추적용 error row(번호 NULL 가능, esm.md §3.2)는
  // 목록·EsmShippingProfileSchema(.min(1)) 대상이 아니다. 고아 리소스 추적은 내부/후속 관리 UI 몫.
  let query = supabase
    .from('esm_shipping_profiles')
    .select(PROFILE_COLUMNS)
    .eq('status', 'active')

  if (marketAccountId) {
    query = query.eq('market_account_id', marketAccountId)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) {
    logger.warn({ err: error.message }, '← esm_shipping_profiles select error')
    throw new EsmShippingProfileError(
      { code: 'internal', message: error.message },
      error,
    )
  }

  // esm_shipping_profiles 는 생성 DB 타입에 아직 없어 row 타입이 추론되지 않는다.
  // RLS + zod parse(rowToProfile) 가 형태를 보장하므로 unknown 경유 캐스팅.
  const rows = (data ?? []) as unknown as EsmShippingProfileRow[]
  return rows.map((row) => rowToProfile(row))
}

// ─────────────────────────────────────────────
// 생성 — esm-shipping-profile Edge Function (4단계 생성 + INSERT)
// ─────────────────────────────────────────────

export async function createEsmShippingProfile(
  input: EsmShippingProfileCreateInput,
): Promise<EsmShippingProfile> {
  // 클라이언트 사전 검증 — 잘못된 폼이 Edge 로 가지 않게 차단 (zod 단일 소스 재사용).
  const safeInput = EsmShippingProfileCreateInputSchema.parse(input)
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>(
    'esm-shipping-profile',
    { body: safeInput as unknown as Record<string, unknown> },
  )

  if (error) {
    logger.warn({ err: error.message }, '← esm-shipping-profile error')
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
      throw new EsmShippingProfileError(parsed, error)
    }
    throw new EsmShippingProfileError(
      { code: 'internal', message: error.message },
      error,
    )
  }

  // 일부 Edge Function 은 error 없이 본문에 { code, message } 를 담아 4xx 를 흉내낼 수 있음.
  const inline = parseEdgeError(data)
  if (inline) {
    throw new EsmShippingProfileError(inline, data)
  }

  return EsmShippingProfileSchema.parse(data)
}

/** Edge `err()` 본문(`{ error: { code, message, correlationId } }`) 또는 flat 형태를 코드/메시지로 정규화. */
function parseEdgeError(
  body: unknown,
): { code: string; message: string; correlationId?: string | null } | null {
  if (body === null || typeof body !== 'object') return null
  const obj = body as Record<string, unknown>
  // _shared/http.ts err() 형태: { error: { code, message, correlationId } }
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
  // flat { code, message }
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

export const esmShippingProfileQueryKeys = {
  all: ['esm-shipping-profiles'] as const,
  list: (sellerId: string | null, marketAccountId: string | null) =>
    ['esm-shipping-profiles', { sellerId, marketAccountId }] as const,
}
