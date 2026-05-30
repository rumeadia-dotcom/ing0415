import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import {
  getEsmShippingOptions,
  esmShippingListQueryKeys,
} from '../api/esm-shipping-list-api'
import type { EsmShippingListResponse } from '@/lib/schemas/esm'

/**
 * 셀러의 ESM(G마켓·옥션) 출하지/발송정책 목록 조회 (esm.md "전환 결정" / PR-E2).
 *
 * - Edge `esm-shipping-list` 가 ownership 검증 + ESM 17(출하지)/19(발송정책) 조회 + 정규화 반환.
 * - 4상태 — loading / error / data(places·dispatchPolicies) / empty(둘 다 빈 배열).
 * - marketAccountId 없으면 query 비활성(카드에서 계정 미선택 케이스).
 * - 조회는 멱등 → staleTime 으로 카드 재렌더 시 중복 호출 억제(11번가 useElevenStShippingAddresses 와 동일).
 *
 * 응답엔 placeNo/placeName + dispatchPolicyNo/dispatchPolicyName 만 — PII 없음(esm.md "전환 결정").
 * 발송정책은 사이트별(G/A) — 응답이 계정 site 로 태깅된 분만 내려온다.
 */
export function useEsmShippingOptions(marketAccountId?: string) {
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useQuery<EsmShippingListResponse>({
    queryKey: esmShippingListQueryKeys.list(sellerId, marketAccountId ?? null),
    queryFn: () => getEsmShippingOptions(marketAccountId as string),
    enabled: sellerId !== null && Boolean(marketAccountId),
    staleTime: 60_000,
  })
}
