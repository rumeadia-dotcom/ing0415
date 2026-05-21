import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { fetchShippingJobWithResults, shippingQueryKeys } from '../api/shipping-api'
import type { ShippingJob, ShippingJobMarketResult } from '../types/shipping-schema'

/**
 * n54 / n55 단일 배송 잡 + Realtime.
 * - useQuery 로 초기 조회.
 * - Realtime 2채널 (shipping_jobs / shipping_job_market_results) 구독 → invalidate.
 * - terminal 진입 시 refetchInterval false.
 */
export function useShippingJob(jobId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!jobId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`shipping_job:${jobId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'shipping_jobs',
          filter: `id=eq.${jobId}`,
        },
        () => {
          logger.debug({ jobId }, 'realtime: shipping_jobs change')
          void qc.invalidateQueries({ queryKey: shippingQueryKeys.job(jobId) })
        },
      )
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'shipping_job_market_results',
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          logger.debug({ jobId }, 'realtime: shipping_market_results change')
          void qc.invalidateQueries({ queryKey: shippingQueryKeys.job(jobId) })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [jobId, qc])

  return useQuery<{ job: ShippingJob; results: ShippingJobMarketResult[] }>({
    queryKey: shippingQueryKeys.job(jobId),
    queryFn: () => fetchShippingJobWithResults(jobId),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const data = q.state.data
      if (!data) return 5000
      const terminal = ['succeeded', 'partial', 'failed', 'cancelled']
      return terminal.includes(data.job.status) ? false : 5000
    },
  })
}
