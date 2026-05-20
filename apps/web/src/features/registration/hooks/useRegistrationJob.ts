import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { fetchJobWithResults, registrationQueryKeys } from '../api/registration-api'
import type { RegistrationJob, MarketResult } from '@/lib/schemas/registration'

/**
 * Step 5 결과 페이지 데이터.
 * - useQuery 로 초기 데이터 조회.
 * - Realtime 2채널 (registration_jobs / registration_job_market_results) 구독 → invalidate.
 * 마스터: docs/architecture/v1/features/registration.md §8.1
 */
export function useRegistrationJob(jobId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!jobId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`registration_job:${jobId}`)
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'registration_jobs', filter: `id=eq.${jobId}` },
        () => {
          logger.debug({ jobId }, 'realtime: registration_jobs change')
          void qc.invalidateQueries({ queryKey: registrationQueryKeys.job(jobId) })
        },
      )
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'registration_job_market_results', filter: `job_id=eq.${jobId}` },
        () => {
          logger.debug({ jobId }, 'realtime: market_results change')
          void qc.invalidateQueries({ queryKey: registrationQueryKeys.job(jobId) })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [jobId, qc])

  return useQuery<{ job: RegistrationJob; results: MarketResult[] }>({
    queryKey: registrationQueryKeys.job(jobId),
    queryFn: () => fetchJobWithResults(jobId),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const data = q.state.data
      if (!data) return 5000
      const terminal = ['succeeded', 'partial', 'failed', 'cancelled']
      return terminal.includes(data.job.status) ? false : 5000
    },
  })
}
