import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth'
import {
  ShippingConfigSchema,
  DEFAULT_SHIPPING_CONFIG,
  type ShippingConfig,
} from '@/lib/schemas/shipping-config'

/**
 * 셀러 배송 템플릿 목록 + CRUD mutation.
 * 마스터: docs/architecture/v1/features/registration.md §3.2 shipping_policies (config 재편)
 *
 * shipping_policies 테이블 재편(C9): fee/method/eta_days 컬럼 DROP → config jsonb + name + is_default.
 * 템플릿 = ShippingConfig 묶음에 이름·기본여부를 붙인 형태. StepInfoPage 가 "템플릿 적용" 으로 불러온다.
 *
 * RLS 가 seller_id = auth.uid() 적용.
 *
 * 기본값(isDefault=true) 규약:
 *  - 한 셀러당 최대 1개. 새 row 를 default=true 로 만들면 같은 셀러의 다른 row 들을 false 로 만든다.
 *  - 클라이언트에서 2-step 으로 수행 (DB trigger 미존재):
 *    1) 같은 셀러의 다른 row 들을 is_default=false 로 update
 *    2) 대상 row 를 is_default=true 로 set
 *  - RLS 가 seller_id = auth.uid() 이므로 .eq('seller_id', sellerId) 는 안전장치(가독성).
 */

export interface ShippingTemplate {
  id: string
  name: string
  isDefault: boolean
  config: ShippingConfig
}

/** 기존 import 처 호환용 별칭 (점진 이행). */
export type ShippingPolicy = ShippingTemplate

interface ShippingTemplateRow {
  id: string
  name: string
  is_default: boolean
  config: unknown
}

/** config jsonb 는 파싱된 객체로 도착 — 방어적으로 safeParse, 실패 시 기본값 fallback. */
function parseConfig(raw: unknown): ShippingConfig {
  const res = ShippingConfigSchema.safeParse(raw)
  return res.success ? res.data : DEFAULT_SHIPPING_CONFIG
}

function rowToTemplate(r: ShippingTemplateRow): ShippingTemplate {
  return {
    id: r.id,
    name: r.name,
    isDefault: r.is_default,
    config: parseConfig(r.config),
  }
}

const queryKey = (sellerId: string | null) =>
  ['registration', 'shipping-policies', { sellerId }] as const

export function useShippingPolicies() {
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useQuery<ShippingTemplate[]>({
    queryKey: queryKey(sellerId),
    enabled: sellerId != null,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('shipping_policies')
        .select('id, name, is_default, config')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((row) => rowToTemplate(row as ShippingTemplateRow))
    },
  })
}

/** 배송 템플릿 hook 별칭 (의미 명시용 — 동일 구현). */
export const useShippingTemplates = useShippingPolicies

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

interface CreateTemplateInput {
  name: string
  isDefault?: boolean
  config: ShippingConfig
}

export function useCreateShippingPolicy() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<ShippingTemplate, unknown, CreateTemplateInput>({
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
          is_default: wantDefault,
          config: input.config,
        })
        .select('id, name, is_default, config')
        .single<ShippingTemplateRow>()
      if (error) throw error
      if (!data) throw new Error('insert returned no row')
      return rowToTemplate(data)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKey(sellerId) })
    },
  })
}

interface UpdateTemplateInput {
  id: string
  name: string
  isDefault?: boolean
  config: ShippingConfig
}

export function useUpdateShippingPolicy() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<ShippingTemplate, unknown, UpdateTemplateInput>({
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
          is_default: wantDefault,
          config: input.config,
        })
        .eq('id', input.id)
        .select('id, name, is_default, config')
        .single<ShippingTemplateRow>()
      if (error) throw error
      if (!data) throw new Error('update returned no row')
      return rowToTemplate(data)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKey(sellerId) })
    },
  })
}

interface DeleteTemplateInput {
  id: string
}

export function useDeleteShippingPolicy() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<{ id: string }, unknown, DeleteTemplateInput>({
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
