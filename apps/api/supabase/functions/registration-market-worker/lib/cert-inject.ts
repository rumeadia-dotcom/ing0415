/**
 * 카테고리 KC인증 필수여부(certRequiredYn) 주입 (NEW-2 — 순수 함수, vitest 커버).
 *
 * 오케스트레이터(워커)가 마켓 cert 메타(11번가 1617 fetchCategoryCertMeta)를 조회한 뒤,
 * mapping.categoryId 의 requiredYn 을 mapping.extra.certRequiredYn 로 주입한다.
 * transformProduct(11번가 buildElevenStProductRaw → readElevenStExtra)가 이 슬롯을 읽어
 * ProductCertGroup 필수 분기를 결정한다 (11st.md §4.1 / category-1617).
 *
 * deno.land/npm 런타임 import 없음 (type-only) — process.ts(Edge)·vitest 양쪽에서 사용.
 */

import type { MarketMapping } from '../../_shared/index.ts'

/** 어댑터 fetchCategoryCertMeta 반환 항목과 호환되는 최소 구조. */
export interface CategoryCertMetaLike {
  requiredYn?: 'Y' | 'N'
}

/**
 * mapping.categoryId 의 cert 메타가 있으면 extra.certRequiredYn 을 주입한 새 mapping 반환.
 *   - requiredYn 미존재(메타 없음/빈 맵) → mapping 그대로 (불변).
 *   - 기존 extra 슬롯(출고지/반품지/officialNotice 등)은 보존.
 */
export function injectCertRequiredYn(
  mapping: MarketMapping,
  certMap: Record<string, CategoryCertMetaLike>,
): MarketMapping {
  const requiredYn = certMap[mapping.categoryId]?.requiredYn
  if (requiredYn !== 'Y' && requiredYn !== 'N') return mapping
  return {
    ...mapping,
    extra: { ...(mapping.extra ?? {}), certRequiredYn: requiredYn },
  }
}
