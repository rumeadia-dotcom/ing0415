import { create } from 'zustand'
import type {
  ImageMeta,
  MarketSelection,
  CategoryMapping,
} from '@/lib/schemas/registration'
import type { ShippingConfig } from '@/lib/schemas/shipping-config'

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
  shippingConfig: ShippingConfig
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
  /**
   * 이미지 1장을 원자적으로 append (동시 업로드 race 방지). 첫 장이면 role='main'.
   * 병렬 업로드 콜백이 각자 getState→setImages 하던 read-modify-write 가 서로를 덮어써
   * 일부 이미지가 소실되던 버그(R2) 를 막는다.
   */
  addImage: (meta: ImageMeta) => void
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
} satisfies Omit<RegisterFormState, 'setProductId' | 'setStep1' | 'setImages' | 'addImage' | 'setSelections' | 'setMappings' | 'clear'>

export const useRegisterFormStore = create<RegisterFormState>((set) => ({
  ...initial,
  setProductId: (id) => set({ productId: id }),
  setStep1: (data) => set({ step1: data }),
  setImages: (images) => set({ images }),
  addImage: (meta) =>
    set((s) => {
      const isFirst = s.images.length === 0
      return { images: [...s.images, { ...meta, role: isFirst ? 'main' : 'sub' }] }
    }),
  setSelections: (selections) => set({ selections }),
  setMappings: (mappings) => set({ mappings }),
  clear: () => set(initial),
}))
