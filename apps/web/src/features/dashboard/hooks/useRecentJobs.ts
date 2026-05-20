import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/features/auth'
import { dashboardQueryKeys, fetchRecentJobs } from '../api/dashboard-api'
import type { RecentJob } from '@/lib/schemas/dashboard-summary'

/**
 * 대시보드 "최근 등록" 리스트.
 * - useQuery (staleTime 15s)
 * - Realtime: registration_jobs:seller_id=eq.<sellerId> INSERT/UPDATE → invalidate.
 */
export function useRecentJobs(limit = 20) {
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const qc = useQueryClient()

  useEffect(() => {
    if (!sellerId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`dashboard_recent:${sellerId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'registration_jobs',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          logger.debug({ sellerId }, 'realtime: registration_jobs (recent)')
          void qc.invalidateQueries({ queryKey: dashboardQueryKeys.recentJobs(limit) })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sellerId, qc, limit])

  return useQuery<RecentJob[]>({
    queryKey: dashboardQueryKeys.recentJobs(limit),
    queryFn: () => fetchRecentJobs(limit),
    enabled: !!sellerId,
    staleTime: 15_000,
  })
}
