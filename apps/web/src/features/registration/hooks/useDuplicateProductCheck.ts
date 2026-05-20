import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth'
import { registrationQueryKeys } from '../api/registration-api'

/**
 * 상품명 디바운스 (default 500ms) 중복 확인.
 * 마스터: docs/architecture/v1/features/registration.md §10.3 blockingReasons.
 */
function useDebounced<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface DuplicateCheckResult {
  duplicate: boolean
  productId: string | null
}

export function useDuplicateProductCheck(name: string, currentProductId: string | null = null) {
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const debounced = useDebounced(name.trim(), 500)

  return useQuery<DuplicateCheckResult>({
    queryKey: registrationQueryKeys.duplicateName(debounced),
    enabled: sellerId != null && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .eq('name', debounced)
        .neq('status', 'registered')
        .maybeSingle<{ id: string }>()
      if (error && error.code !== 'PGRST116') throw error
      if (!data) return { duplicate: false, productId: null }
      if (currentProductId && data.id === currentProductId) return { duplicate: false, productId: data.id }
      return { duplicate: true, productId: data.id }
    },
  })
}
