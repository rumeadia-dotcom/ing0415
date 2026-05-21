import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import {
  fetchAutoDispatchSetting,
  setAutoDispatchSetting,
  shippingSettingsQueryKeys,
} from '../api/shipping-settings-api'
import type { ShippingAutoDispatchSetting } from '@/lib/schemas/logen'

/**
 * "출력 후 자동 제출" 셀러 설정.
 *
 * 마스터: docs/spec/PRD-v2-shipping.md §2.4 (출력 후 자동 트리거)
 *
 * - 저장 위치 결정: sellers 테이블에 `auto_dispatch_after_print boolean default false` 컬럼 추가
 *   (PR2 마이그레이션 책임). 별도 settings 테이블은 v2 범위에 단일 boolean 만 두므로 과한 추상화.
 * - read: `get_seller_auto_dispatch()` / write: `set_seller_auto_dispatch(p_auto_dispatch)`.
 * - optimistic update — 토글 즉시 UI 반영, 실패 시 rollback.
 */
export function useAutoDispatchSetting() {
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useQuery<ShippingAutoDispatchSetting>({
    queryKey: shippingSettingsQueryKeys.autoDispatch(sellerId),
    queryFn: fetchAutoDispatchSetting,
    enabled: sellerId !== null,
    staleTime: 60_000,
  })
}

export function useAutoDispatchToggle() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const key = shippingSettingsQueryKeys.autoDispatch(sellerId)

  return useMutation<unknown, unknown, boolean, { previous: ShippingAutoDispatchSetting | undefined }>({
    mutationFn: (next) => setAutoDispatchSetting(next),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<ShippingAutoDispatchSetting>(key)
      qc.setQueryData<ShippingAutoDispatchSetting>(key, {
        autoDispatchAfterPrint: next,
      })
      return { previous }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(key, ctx.previous)
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
    },
  })
}
