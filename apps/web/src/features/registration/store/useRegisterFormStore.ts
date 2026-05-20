import { create } from 'zustand'
import type {
  ImageMeta,
  MarketSelection,
  CategoryMapping,
} from '@/lib/schemas/registration'

/**
 * 5단계 위저드 횡단 폼 store (zustand).
 * 마스터: docs/architecture/v1/features/registration.md §10
 *
 * - Step 1 (info) / Step 2 (images) / Step 3 (markets-categories) 의 입력값을 단일 store 로 보관.
 * - 새로고침 후 복구 (draft persistence) 는 v2.
 * - Step 4 미리보기 / Step 5 결과는 본 store 가 아닌 서버 응답 (useQuery) 로 다룬다.
 */

export interface Step1Draft {
  name: string
  price: number
  originalPrice: number | null
  brand: string | null
  manufacturer: string | null
  descriptionHtml: string | null
  baseCategoryId: string
  shippingPolicyId: string
}

interface RegisterFormState {
  productId: string | null
  step1: Step1Draft | null
  images: ImageMeta[]
  selections: MarketSelection[]
  mappings: CategoryMapping[]

  setProductId: (id: string | null) => void
  setStep1: (data: Step1Draft) => void
  setImages: (images: ImageMeta[]) => void
  setSelections: (selections: MarketSelection[]) => void
  setMappings: (mappings: CategoryMapping[]) => void
  clear: () => void
}

const initial = {
  productId: null,
  step1: null,
  images: [],
  selections: [],
  mappings: [],
} satisfies Omit<RegisterFormState, 'setProductId' | 'setStep1' | 'setImages' | 'setSelections' | 'setMappings' | 'clear'>

export const useRegisterFormStore = create<RegisterFormState>((set) => ({
  ...initial,
  setProductId: (id) => set({ productId: id }),
  setStep1: (data) => set({ step1: data }),
  setImages: (images) => set({ images }),
  setSelections: (selections) => set({ selections }),
  setMappings: (mappings) => set({ mappings }),
  clear: () => set(initial),
}))
