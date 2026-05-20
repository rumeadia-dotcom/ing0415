import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { fetchHistoryDetail, historyQueryKeys } from '../api/history-api'
import type { JobDetail } from '@/lib/schemas/history-filter'

/**
 * 이력 상세 + 2채널 Realtime.
 * - registration_jobs:id=eq.<jobId>
 * - registration_job_market_results:job_id=eq.<jobId>
 * 마스터: docs/architecture/v1/features/history.md §3.3 / §6.
 */
export function useHistoryDetail(jobId: string | null | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!jobId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`history_detail:${jobId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'registration_jobs',
          filter: `id=eq.${jobId}`,
        },
        () => {
          logger.debug({ jobId }, 'realtime: registration_jobs (detail)')
          void qc.invalidateQueries({ queryKey: historyQueryKeys.detail(jobId) })
        },
      )
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'registration_job_market_results',
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          logger.debug({ jobId }, 'realtime: market_results (detail)')
          void qc.invalidateQueries({ queryKey: historyQueryKeys.detail(jobId) })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [jobId, qc])

  return useQuery<JobDetail | null>({
    queryKey: jobId ? historyQueryKeys.detail(jobId) : ['history', 'detail', 'noop'],
    queryFn: () => (jobId ? fetchHistoryDetail(jobId) : Promise.resolve(null)),
    enabled: !!jobId,
    staleTime: 10_000,
  })
}
