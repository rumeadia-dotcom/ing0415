/**
 * 발송 워커 → adapter.submitTracking opts 빌더 (NEW-1 dlvNo plumbing).
 *
 * orders.extra(jsonb)에 수집된 마켓별 발송키(11번가 dlvNo)를 submitTracking 의 opts 로 변환.
 * 순수 함수 (deno.land import 없음 — vitest 직접 커버). 마스터: docs/architecture/v1/features/11st.md §4.5.
 */

import type { SubmitTrackingExtra } from '../../_shared/market-adapter.ts'

/**
 * orders.extra → submitTracking opts.
 *   - extra.dlvNo 가 비어있지 않으면 { dlvNo } 반환 (11번가 발송처리 path 키).
 *   - 없음/빈값/다른 마켓 → undefined (어댑터가 externalOrderId fallback).
 */
export function buildSubmitTrackingExtra(
  extra: Record<string, string> | null | undefined,
): SubmitTrackingExtra | undefined {
  const dlvNo = extra?.dlvNo
  return dlvNo && dlvNo.trim() !== '' ? { dlvNo } : undefined
}
