import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import {
  listEsmShippingProfiles,
  esmShippingProfileQueryKeys,
} from '../api/esm-shipping-profile-api'
import type { EsmShippingProfile } from '@/lib/schemas/esm'

/**
 * 셀러의 ESM 배송 프로필 목록 조회 (esm.md §5).
 *
 * - RLS 가 seller_id = auth.uid() 적용 → 자신의 행만.
 * - 4상태 — loading / error / data(목록 1+) / empty(빈 배열).
 * - sellerId 없으면 (anonymous) query 비활성.
 * - marketAccountId 지정 시 해당 ESM 계정의 프로필만 (3단계 드롭다운 선택용 — PR-3.5).
 */
export function useEsmShippingProfiles(marketAccountId?: string) {
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useQuery<EsmShippingProfile[]>({
    queryKey: esmShippingProfileQueryKeys.list(
      sellerId,
      marketAccountId ?? null,
    ),
    queryFn: () => listEsmShippingProfiles(marketAccountId),
    enabled: sellerId !== null,
    staleTime: 60_000,
  })
}
