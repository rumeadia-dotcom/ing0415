import { useMutation } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import type { Step1Draft } from '../store/useRegisterFormStore'

/**
 * Step 1 종료 시 products INSERT (status='draft') 또는 UPDATE.
 * RLS 가 seller_id = auth.uid() 적용 → 클라이언트 직접 가능.
 *
 * - productId 없으면 INSERT → 반환된 id 를 store 에 저장.
 * - productId 있으면 UPDATE.
 */

interface UpsertInput {
  productId: string | null
  draft: Step1Draft
}

export function useUpsertProductDraft() {
  return useMutation<{ productId: string }, unknown, UpsertInput>({
    mutationFn: async ({ productId, draft }) => {
      const supabase = getSupabase()
      const row = {
        name: draft.name,
        price: draft.price,
        original_price: draft.originalPrice,
        brand: draft.brand,
        manufacturer: draft.manufacturer,
        description_html: draft.descriptionHtml,
        base_category_id: draft.baseCategoryId,
        shipping_policy_id: draft.shippingPolicyId,
        status: 'draft' as const,
      }
      if (productId) {
        const { error } = await supabase.from('products').update(row).eq('id', productId)
        if (error) throw error
        return { productId }
      }
      const { data, error } = await supabase
        .from('products')
        .insert(row)
        .select('id')
        .single<{ id: string }>()
      if (error) throw error
      if (!data) throw new Error('insert returned no row')
      return { productId: data.id }
    },
  })
}
