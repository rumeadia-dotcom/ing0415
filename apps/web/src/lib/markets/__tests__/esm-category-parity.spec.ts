/**
 * ESM(G마켓·옥션) 카테고리 mock ↔ real parity — fetchCategoryTree Edge 이전 후 (category-sync.md §6.4).
 *
 * 카테고리 조회는 Edge `markets-category-children` 으로 이전됨. web 어댑터(real/mock 공통)의
 * fetchCategoryTree 는 런타임 미사용이며 인터페이스 충족용 throw 만 유지한다.
 * 따라서 과거의 "site-cats 트리 동형성" 비교 대신, 양쪽 어댑터가 동형으로 throw 하는지만 검증한다.
 *
 * 마스터:
 *   - docs/architecture/v1/features/category-sync.md §6.4
 *   - docs/architecture/v1/testing.md §6.2 R-006
 */

import { describe, it, expect } from 'vitest'
import { createMockAdapter } from '../debug/createMockAdapter'
import { gmarketRealAdapter } from '../real/gmarket'

describe('ESM 카테고리 mock ↔ real parity (Edge 이전 후 throw)', () => {
  it('mock 어댑터 fetchCategoryTree 는 Edge 이전 throw', async () => {
    const mock = createMockAdapter('gmarket')
    await expect(mock.fetchCategoryTree()).rejects.toThrow(
      /markets-category-children/,
    )
  })

  it('real 어댑터 fetchCategoryTree 는 Edge 이전 throw (mock 과 동형)', async () => {
    await expect(gmarketRealAdapter.fetchCategoryTree()).rejects.toThrow(
      /markets-category-children/,
    )
  })
})
