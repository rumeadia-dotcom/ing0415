import { describe, expect, it } from 'vitest'
import { injectCertRequiredYn } from '../lib/cert-inject'
import type { MarketMapping } from '../../_shared/index'

function makeMapping(over: Partial<MarketMapping> = {}): MarketMapping {
  return {
    market: '11st',
    categoryId: '1097',
    transformedImageUrls: ['https://e.com/a.jpg'],
    extra: {},
    ...over,
  } as MarketMapping
}

// NEW-2: 워커가 카테고리 cert 메타(1617)를 조회해 categoryId 의 requiredYn 을
// mapping.extra.certRequiredYn 에 주입한다 (transformProduct 가 읽는 슬롯). 순수 함수.
describe('injectCertRequiredYn (NEW-2 — KC인증 필수여부 주입)', () => {
  it('categoryId 의 requiredYn=Y → extra.certRequiredYn=Y 주입', () => {
    const m = injectCertRequiredYn(makeMapping(), { '1097': { requiredYn: 'Y' } })
    expect((m.extra as Record<string, unknown>).certRequiredYn).toBe('Y')
  })

  it('requiredYn=N 도 주입 (인증 비필수 명시)', () => {
    const m = injectCertRequiredYn(makeMapping(), { '1097': { requiredYn: 'N' } })
    expect((m.extra as Record<string, unknown>).certRequiredYn).toBe('N')
  })

  it('categoryId 메타 없음 → mapping 그대로 (certRequiredYn 미주입)', () => {
    const m = injectCertRequiredYn(makeMapping(), { '9999': { requiredYn: 'Y' } })
    expect((m.extra as Record<string, unknown>).certRequiredYn).toBeUndefined()
  })

  it('빈 certMap → mapping 그대로 (FAIL 엣지)', () => {
    const m = injectCertRequiredYn(makeMapping(), {})
    expect((m.extra as Record<string, unknown>).certRequiredYn).toBeUndefined()
  })

  it('기존 extra(출고지 등) 보존하며 certRequiredYn 만 추가', () => {
    const m = injectCertRequiredYn(
      makeMapping({ extra: { outboundAddrSeq: 'A1' } }),
      { '1097': { requiredYn: 'Y' } },
    )
    expect((m.extra as Record<string, unknown>).outboundAddrSeq).toBe('A1')
    expect((m.extra as Record<string, unknown>).certRequiredYn).toBe('Y')
  })
})
