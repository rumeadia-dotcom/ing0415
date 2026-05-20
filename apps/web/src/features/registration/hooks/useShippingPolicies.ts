import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth'

/**
 * 셀러 배송 정책 목록.
 * 마스터: docs/architecture/v1/features/registration.md §3.2 shipping_policies
 *
 * RLS 가 seller_id = auth.uid() 적용.
 * Step 1 진입 시 0개면 inline 으로 기본 1개 생성 가능 (createDefaultShippingPolicy).
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

const queryKey = (sellerId: string | null) => ['registration', 'shipping-policies', { sellerId }] as const

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
      const { data, error } = await supabase
        .from('shipping_policies')
        .insert({
          name: input.name,
          fee: input.fee,
          method: input.method,
          eta_days: input.etaDays,
          is_default: input.isDefault ?? false,
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
