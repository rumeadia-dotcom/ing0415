import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth'

/**
 * 셀러 배송 정책 목록 + CRUD mutation.
 * 마스터: docs/architecture/v1/features/registration.md §3.2 shipping_policies
 *
 * RLS 가 seller_id = auth.uid() 적용.
 * Step 1 진입 시 0개면 별도 화면(/settings/policies)에서 생성.
 *
 * 기본값(isDefault=true) 규약:
 *  - 한 셀러당 최대 1개. 새 row 를 default=true 로 만들면 같은 셀러의 다른 row 들을 false 로 만든다.
 *  - 클라이언트에서 2-step 으로 수행 (DB trigger 미존재):
 *    1) 같은 셀러의 다른 row 들을 is_default=false 로 update
 *    2) 대상 row 를 is_default=true 로 set
 *  - RLS 가 seller_id = auth.uid() 이므로 .eq('seller_id', sellerId) 는 안전장치(가독성).
 */

export interface ShippingPolicy {
  id: string
  name: string
  fee: number
  method: 'parcel' | 'direct' | 'quick' | 'visit_pickup'
  etaDays: number
  isDefault: boolean
}

interface ShippingPolicyRow {
  id: string
  name: string
  fee: number
  method: ShippingPolicy['method']
  eta_days: number
  is_default: boolean
}

function rowToPolicy(r: ShippingPolicyRow): ShippingPolicy {
  return {
    id: r.id,
    name: r.name,
    fee: r.fee,
    method: r.method,
    etaDays: r.eta_days,
    isDefault: r.is_default,
  }
}

const queryKey = (sellerId: string | null) =>
  ['registration', 'shipping-policies', { sellerId }] as const

export function useShippingPolicies() {
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useQuery<ShippingPolicy[]>({
    queryKey: queryKey(sellerId),
    enabled: sellerId != null,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('shipping_policies')
        .select('id, name, fee, method, eta_days, is_default')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((row) => rowToPolicy(row as ShippingPolicyRow))
    },
  })
}

// ─────────────────────────────────────────────
// 공통: 같은 셀러의 다른 row 들의 is_default 를 false 로 클리어
//   - skipId 가 있으면 그 row 는 제외 (수정 시 자기 자신 제외)
// ─────────────────────────────────────────────
async function clearDefaultsForSeller(
  sellerId: string,
  skipId: string | null,
): Promise<void> {
  const supabase = getSupabase()
  let q = supabase
    .from('shipping_policies')
    .update({ is_default: false })
    .eq('seller_id', sellerId)
  if (skipId !== null) {
    q = q.neq('id', skipId)
  }
  const { error } = await q
  if (error) throw error
}

interface CreatePolicyInput {
  name: string
  fee: number
  method: ShippingPolicy['method']
  etaDays: number
  isDefault?: boolean
}

export function useCreateShippingPolicy() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<ShippingPolicy, unknown, CreatePolicyInput>({
    mutationFn: async (input) => {
      const supabase = getSupabase()
      const wantDefault = input.isDefault ?? false

      // 1) 새 row 를 default 로 만들 거면 다른 row 들을 먼저 false 로
      if (wantDefault && sellerId !== null) {
        await clearDefaultsForSeller(sellerId, null)
      }

      const { data, error } = await supabase
        .from('shipping_policies')
        .insert({
          name: input.name,
          fee: input.fee,
          method: input.method,
          eta_days: input.etaDays,
          is_default: wantDefault,
        })
        .select('id, name, fee, method, eta_days, is_default')
        .single<ShippingPolicyRow>()
      if (error) throw error
      if (!data) throw new Error('insert returned no row')
      return rowToPolicy(data)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKey(sellerId) })
    },
  })
}

interface UpdatePolicyInput {
  id: string
  name: string
  fee: number
  method: ShippingPolicy['method']
  etaDays: number
  isDefault?: boolean
}

export function useUpdateShippingPolicy() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<ShippingPolicy, unknown, UpdatePolicyInput>({
    mutationFn: async (input) => {
      const supabase = getSupabase()
      const wantDefault = input.isDefault ?? false

      // 1) default 로 승격 시: 자기 자신 제외한 다른 row 들을 먼저 false 로
      if (wantDefault && sellerId !== null) {
        await clearDefaultsForSeller(sellerId, input.id)
      }

      const { data, error } = await supabase
        .from('shipping_policies')
        .update({
          name: input.name,
          fee: input.fee,
          method: input.method,
          eta_days: input.etaDays,
          is_default: wantDefault,
        })
        .eq('id', input.id)
        .select('id, name, fee, method, eta_days, is_default')
        .single<ShippingPolicyRow>()
      if (error) throw error
      if (!data) throw new Error('update returned no row')
      return rowToPolicy(data)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKey(sellerId) })
    },
  })
}

interface DeletePolicyInput {
  id: string
}

export function useDeleteShippingPolicy() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<{ id: string }, unknown, DeletePolicyInput>({
    mutationFn: async (input) => {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('shipping_policies')
        .delete()
        .eq('id', input.id)
      if (error) throw error
      return { id: input.id }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKey(sellerId) })
    },
  })
}
