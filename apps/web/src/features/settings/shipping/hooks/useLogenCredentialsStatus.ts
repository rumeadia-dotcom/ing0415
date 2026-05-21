import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import {
  fetchLogenCredentialsStatus,
  shippingSettingsQueryKeys,
} from '../api/shipping-settings-api'
import type { LogenCredentialsStatus } from '@/lib/schemas/logen'

/**
 * 로젠 자격증명/발송인 정보 상태 조회.
 *
 * 마스터: docs/spec/PRD.md §8
 *
 * - 평문 자격증명은 절대 응답에 포함되지 않는다 (RPC 가 hasCredentials boolean 만 반환).
 * - 4상태 — loading / error / data (hasCredentials=true) / empty (hasCredentials=false).
 * - 인증 필요 — sellerId 없으면 query 비활성.
 */
export function useLogenCredentialsStatus() {
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useQuery<LogenCredentialsStatus>({
    queryKey: shippingSettingsQueryKeys.credentialsStatus(sellerId),
    queryFn: fetchLogenCredentialsStatus,
    enabled: sellerId !== null,
    staleTime: 60_000,
  })
}
