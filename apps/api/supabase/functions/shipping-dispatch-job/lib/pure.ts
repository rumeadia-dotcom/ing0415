/**
 * shipping-dispatch fan-out 의 순수 함수 모음.
 *
 * 마스터: docs/spec/PRD-v2-shipping.md §4.
 *
 * - Deno specifier (`npm:zod`) / Supabase 클라이언트 / 환경변수 등 일체의 부수효과 의존 없음.
 * - 본 모듈만 Vitest (Node ESM) 에서 직접 import 하여 단위·통합 테스트로 검증.
 *   → Edge Function 본체는 Deno 런타임에서 실행 (vitest 는 픽업 안 함).
 *
 * 검증 대상:
 *   - groupOrdersByMarket: 마켓별 그룹화
 *   - determineJobStatus: shipping_job_results.status 집합 → shipping_jobs.status 결정
 *   - mapMarketErrorToShippingCode / isFinalShippingErrorCode (마켓 워커 측 미러)
 *   - decideFinal: attempt_count + errorCode → final 여부
 *   - decideCounterDelta: 결과 → shipping_jobs.success_count / failed_count 증분
 */

// ─────────────────────────────────────────────
// 타입 (lib/types.ts 의 ENUM 과 정합)
// ─────────────────────────────────────────────

export type ShippingResultStatus =
  | 'pending'
  | 'in_flight'
  | 'success'
  | 'failed'
  | 'failed_final'

// PRD §4: shipping_jobs.status ENUM 5값 (cancelled 없음).
export type ShippingJobStatus =
  | 'pending'
  | 'running'
  | 'partial'
  | 'succeeded'
  | 'failed'

export type ShippingErrorCode =
  | 'rate_limit'
  | 'timeout'
  | 'market_5xx'
  | 'oauth_expired'
  | 'oauth_revoked'
  | 'validation'
  | 'duplicate'
  | 'unknown'

export type MarketErrorCode =
  | 'unauthorized'
  | 'rate_limit'
  | 'validation'
  | 'network'
  | 'server'
  | 'unknown'

export interface OrderLike {
  id: string
  market_id: string
}

// ─────────────────────────────────────────────
// 마켓별 그룹화 (preflight 미러)
// ─────────────────────────────────────────────
export function groupOrdersByMarket(
  orders: readonly OrderLike[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const order of orders) {
    const list = map.get(order.market_id)
    if (list) {
      list.push(order.id)
    } else {
      map.set(order.market_id, [order.id])
    }
  }
  return map
}

// ─────────────────────────────────────────────
// shipping_jobs.status 재계산 (result-update 미러)
// ─────────────────────────────────────────────
export function determineJobStatus(
  resultStatuses: readonly ShippingResultStatus[],
): ShippingJobStatus | null {
  if (resultStatuses.length === 0) return null

  const hasNonFinal = resultStatuses.some(
    (s) => s === 'pending' || s === 'in_flight' || s === 'failed',
  )
  if (hasNonFinal) return 'running'

  const successCount = resultStatuses.filter((s) => s === 'success').length
  const failedFinalCount = resultStatuses.filter((s) => s === 'failed_final').length
  const total = resultStatuses.length

  if (successCount === total) return 'succeeded'
  if (failedFinalCount === total) return 'failed'
  return 'partial'
}

// ─────────────────────────────────────────────
// MarketError → shipping error_code 매핑 (error-map 미러)
// ─────────────────────────────────────────────
export function mapMarketErrorToShippingCode(
  code: MarketErrorCode,
  oauthRefreshFailed: boolean,
): ShippingErrorCode {
  switch (code) {
    case 'unauthorized':
      return oauthRefreshFailed ? 'oauth_revoked' : 'oauth_expired'
    case 'rate_limit':
      return 'rate_limit'
    case 'validation':
      return 'validation'
    case 'network':
      return 'timeout'
    case 'server':
      return 'market_5xx'
    case 'unknown':
    default:
      return 'unknown'
  }
}

export function isFinalShippingErrorCode(code: ShippingErrorCode): boolean {
  return (
    code === 'oauth_revoked' ||
    code === 'validation' ||
    code === 'duplicate' ||
    code === 'unknown'
  )
}

// ─────────────────────────────────────────────
// attempt + errorCode → final 여부
// ─────────────────────────────────────────────
const MAX_ATTEMPT = 3

export function decideFinal(
  attempts: number,
  code: ShippingErrorCode,
): boolean {
  return attempts >= MAX_ATTEMPT || isFinalShippingErrorCode(code)
}

// ─────────────────────────────────────────────
// 마켓별 처리 요약 집계 — 테스트 / 응답 양쪽 사용
// ─────────────────────────────────────────────
export interface PerOrderOutcome {
  orderId: string
  outcome: 'success' | 'failed' | 'failed_final'
}

export interface MarketSummary {
  total: number
  success: number
  failed: number
  failedFinal: number
}

export function summarizeMarketOutcomes(
  outcomes: readonly PerOrderOutcome[],
): MarketSummary {
  let success = 0
  let failed = 0
  let failedFinal = 0
  for (const o of outcomes) {
    if (o.outcome === 'success') success += 1
    else if (o.outcome === 'failed') failed += 1
    else failedFinal += 1
  }
  return { total: outcomes.length, success, failed, failedFinal }
}

// ─────────────────────────────────────────────
// PRD §4: shipping_jobs.success_count / failed_count 증분 규칙.
//
// - 'success'       → { success: 1, failed: 0 }
// - 'failed_final'  → { success: 0, failed: 1 }
// - 'failed' (재시도 대기) → { success: 0, failed: 0 }
//   다음 시도에서 최종 결정될 때까지 카운트 안 함.
// ─────────────────────────────────────────────
export interface CounterDelta {
  success: number
  failed: number
}

export function decideCounterDelta(
  outcome: 'success' | 'failed' | 'failed_final',
): CounterDelta {
  if (outcome === 'success') return { success: 1, failed: 0 }
  if (outcome === 'failed_final') return { success: 0, failed: 1 }
  return { success: 0, failed: 0 }
}
