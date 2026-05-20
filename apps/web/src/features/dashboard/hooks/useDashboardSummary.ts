import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/features/auth'
import { dashboardQueryKeys, fetchDashboardSummary } from '../api/dashboard-api'
import type { DashboardSummary } from '@/lib/schemas/dashboard-summary'

/**
 * 대시보드 요약 카드 데이터.
 * - useQuery (staleTime 30s)
 * - Realtime: registration_jobs:seller_id=eq.<sellerId> INSERT/UPDATE → invalidate.
 * 마스터: docs/architecture/v1/features/dashboard.md §3.2 / §6.
 */
export function useDashboardSummary() {
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const qc = useQueryClient()

  useEffect(() => {
    if (!sellerId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`dashboard_summary:${sellerId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'registration_jobs',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          logger.debug({ sellerId }, 'realtime: registration_jobs (summary)')
          void qc.invalidateQueries({ queryKey: dashboardQueryKeys.summary() })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sellerId, qc])

  return useQuery<DashboardSummary | null>({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: fetchDashboardSummary,
    enabled: !!sellerId,
    staleTime: 30_000,
  })
}
