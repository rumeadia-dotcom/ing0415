import { useCallback, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useAuth } from '@/features/auth'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { marketQueryKeys, MarketApiInvocationError } from '../api/markets-api'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

/**
 * 네이버 access token 만료 5분 전 silent refresh hook.
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.4 / §5.5
 *   - WIP-5markets-mvp.md C-1 Phase 4
 *
 * 동작:
 *  1. 네이버 active 계정의 last_verified_at + token_expires_at 기반으로 다음 만료
 *     시각 계산. (DB 의 `token_expires_at` 은 service_role 만 SELECT 가능하므로
 *     클라이언트는 `accounts.lastVerifiedAt` + 보수적 TTL 가정으로 trigger 시점만
 *     판단. 정확한 갱신은 Edge Function `markets-token-refresh` 가 권위.)
 *  2. 다음 trigger 시점에 `markets-token-refresh` on_demand 호출.
 *  3. 성공 시 `marketQueryKeys.accounts(sellerId)` invalidate.
 *  4. 실패 시 logger.warn (Sentry 송출은 Edge Function 측에서).
 *
 * 보안:
 *  - 토큰 자체는 본 hook 이 보지 않는다 — Edge Function 만 복호 / 갱신.
 *  - on_demand 호출은 셀러 JWT 기반 ownership 검증.
 */

const REFRESH_BEFORE_MS = 5 * 60 * 1000 // 5분 전
// Naver access token 의 대략적 TTL — 정확한 token_expires_at 은 BE 만 알기 때문에
// 클라이언트는 last_verified_at 기준으로 보수적으로 추정. 시간 동기화 오차 1분 고려.
const ASSUMED_NAVER_TOKEN_TTL_MS = 3 * 60 * 60 * 1000 // 3시간

interface RefreshArgs {
  credentialId: string
}

// cycle 41: 외부 (Edge Function) 응답은 zod runtime parse 필수 (CLAUDE.md i18n / 데이터 룰).
const RefreshResponseSchema = z.object({
  refreshedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  correlationId: z.string(),
})
type RefreshResponse = z.infer<typeof RefreshResponseSchema>

export async function invokeOnDemandRefresh(
  args: RefreshArgs,
): Promise<RefreshResponse> {
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>(
    'markets-token-refresh',
    {
      body: { mode: 'on_demand', credentialId: args.credentialId },
    },
  )
  if (error) {
    throw new MarketApiInvocationError(
      { code: 'internal', message: error.message },
      error,
    )
  }
  if (!data) {
    throw new MarketApiInvocationError({
      code: 'internal',
      message: 'empty refresh response',
    })
  }
  const parsed = RefreshResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new MarketApiInvocationError({
      code: 'internal',
      message: `refresh response schema mismatch: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    })
  }
  return parsed.data
}

/**
 * 단일 네이버 계정의 다음 silent refresh 시각 계산 (순수, 테스트 가능).
 *
 * `lastVerifiedAt` 이 비어있으면 "지금 즉시" 트리거하지 않고 nextEpoch=null 반환
 * (마지막 검증 시각이 없으면 사용자 액션이 따로 필요).
 */
export function computeNextRefreshEpoch(
  account: Pick<MarketAccount, 'marketId' | 'status' | 'lastVerifiedAt'>,
  opts: { nowMs: number; assumedTtlMs?: number; refreshBeforeMs?: number },
): number | null {
  if (account.marketId !== 'naver') return null
  if (account.status !== 'active') return null
  if (!account.lastVerifiedAt) return null

  const lastVerifiedMs = Date.parse(account.lastVerifiedAt)
  if (Number.isNaN(lastVerifiedMs)) return null

  const ttl = opts.assumedTtlMs ?? ASSUMED_NAVER_TOKEN_TTL_MS
  const before = opts.refreshBeforeMs ?? REFRESH_BEFORE_MS

  const tokenExpiresAtMs = lastVerifiedMs + ttl
  const triggerAt = tokenExpiresAtMs - before

  // 이미 트리거 시각이 지났다면 next=now 로 즉시 실행.
  if (triggerAt < opts.nowMs) return opts.nowMs
  return triggerAt
}

/**
 * 단일 네이버 계정의 silent refresh 스케줄러 hook.
 *
 * `account` 가 변경되거나 unmount 될 때 자동으로 timer cleanup.
 */
export function useNaverTokenRefresh(
  account: MarketAccount | null,
  options: { credentialId?: string | null } = {},
) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mutation = useMutation<RefreshResponse, unknown, RefreshArgs>({
    mutationFn: (args) => invokeOnDemandRefresh(args),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: marketQueryKeys.accounts(sellerId),
      })
    },
    onError: (err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        '← naver silent refresh failed',
      )
    },
  })

  const triggerRefresh = useCallback(() => {
    if (!options.credentialId) return
    mutation.mutate({ credentialId: options.credentialId })
  }, [mutation, options.credentialId])

  useEffect(() => {
    // 이전 타이머 정리
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!account || !options.credentialId) return

    const nextEpoch = computeNextRefreshEpoch(account, { nowMs: Date.now() })
    if (nextEpoch === null) return

    const delay = Math.max(0, nextEpoch - Date.now())
    timerRef.current = setTimeout(() => {
      triggerRefresh()
    }, delay)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [account, options.credentialId, triggerRefresh])

  return {
    triggerRefresh,
    isRefreshing: mutation.isPending,
    lastError: mutation.error,
  }
}
