import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import {
  getElevenStShippingAddresses,
  elevenStShippingListQueryKeys,
} from '../api/eleven-st-shipping-list-api'
import type { ElevenStShippingAddressListResponse } from '@/lib/schemas/eleven-st'

/**
 * 셀러의 11번가 출고지/반품지 목록 조회 (11st.md §3 / §5 / PR-2).
 *
 * - Edge `eleven-st-shipping-list` 가 ownership 검증 + 11번가 1014/1015 조회 + 정규화 반환.
 * - 4상태 — loading / error / data(outbound·returnAddrs) / empty(둘 다 빈 배열).
 * - marketAccountId 없으면 query 비활성(카드에서 계정 미선택 케이스).
 * - 조회는 멱등 → staleTime 으로 카드 재렌더 시 중복 호출 억제.
 *
 * 응답엔 addrSeq + addrNm 만 — PII 없음(11st.md §3).
 */
export function useElevenStShippingAddresses(marketAccountId?: string) {
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useQuery<ElevenStShippingAddressListResponse>({
    queryKey: elevenStShippingListQueryKeys.list(
      sellerId,
      marketAccountId ?? null,
    ),
    queryFn: () => getElevenStShippingAddresses(marketAccountId as string),
    enabled: sellerId !== null && Boolean(marketAccountId),
    staleTime: 60_000,
  })
}
