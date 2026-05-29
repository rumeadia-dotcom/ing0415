import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createEsmShippingProfile,
  esmShippingProfileQueryKeys,
} from '../api/esm-shipping-profile-api'
import type {
  EsmShippingProfile,
  EsmShippingProfileCreateInput,
} from '@/lib/schemas/esm'

/**
 * ESM 배송 프로필 생성 (esm.md §1.3 / §3.1 / §7 PR-3).
 *
 * 실행류 mutation — Edge Function `esm-shipping-profile` 가 ESM 4단계 생성 후
 * service_role 로 INSERT. 성공 시 프로필 목록 query 무효화.
 *
 * 폼 안에서 생성 API 직접 호출 금지 원칙(esm.md §1.3)에 따라, 이 mutation 은
 * "배송 프로필 관리" 화면(설정)에서만 호출된다. 상품등록 3단계는 select 만.
 */
export function useCreateEsmShippingProfile() {
  const queryClient = useQueryClient()

  return useMutation<EsmShippingProfile, Error, EsmShippingProfileCreateInput>({
    mutationFn: (input) => createEsmShippingProfile(input),
    onSuccess: () => {
      // 도메인 prefix 단위 무효화 — sellerId/marketAccountId 변형 전부 갱신.
      void queryClient.invalidateQueries({
        queryKey: esmShippingProfileQueryKeys.all,
      })
    },
  })
}
