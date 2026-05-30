import { describe, expect, it } from 'vitest'
import { buildSubmitTrackingExtra } from '../lib/tracking-opts'

// NEW-1: 발송 워커가 orders.extra(jsonb)에서 마켓별 발송키(11번가 dlvNo)를 뽑아
// adapter.submitTracking 의 opts 로 전달한다. 순수 함수 — 검증 가능 단위.
describe('buildSubmitTrackingExtra (NEW-1 — dlvNo 전달)', () => {
  it('extra.dlvNo 가 있으면 { dlvNo } 반환', () => {
    expect(buildSubmitTrackingExtra({ dlvNo: 'DLV-1' })).toEqual({ dlvNo: 'DLV-1' })
  })
  it('여러 키가 섞여 있어도 dlvNo 만 추출', () => {
    expect(buildSubmitTrackingExtra({ dlvNo: 'DLV-9', other: 'x' })).toEqual({
      dlvNo: 'DLV-9',
    })
  })
  it('extra 가 null/undefined → undefined (다른 마켓·미수집)', () => {
    expect(buildSubmitTrackingExtra(null)).toBeUndefined()
    expect(buildSubmitTrackingExtra(undefined)).toBeUndefined()
  })
  it('dlvNo 없음/빈값/공백 → undefined (FAIL 엣지 — fallback 은 어댑터가 담당)', () => {
    expect(buildSubmitTrackingExtra({})).toBeUndefined()
    expect(buildSubmitTrackingExtra({ dlvNo: '' })).toBeUndefined()
    expect(buildSubmitTrackingExtra({ dlvNo: '   ' })).toBeUndefined()
  })
})
