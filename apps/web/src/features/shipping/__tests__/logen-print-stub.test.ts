import { describe, it, expect } from 'vitest'
import { buildOutSlipPrintPopUrl } from '../api/logen-print-stub'

describe('buildOutSlipPrintPopUrl (PR3 stub)', () => {
  it('빈 입력은 throw', () => {
    expect(() => buildOutSlipPrintPopUrl({ waybillNumbers: [] })).toThrow()
  })

  it('운송장 1개 → URL 에 인코딩된 운송장번호 포함', () => {
    const url = buildOutSlipPrintPopUrl({ waybillNumbers: ['WB-1'] })
    expect(url).toContain('WB-1')
  })

  it('운송장 다수 → 콤마 join 후 encode', () => {
    const url = buildOutSlipPrintPopUrl({ waybillNumbers: ['A', 'B', 'C'] })
    expect(url).toContain(encodeURIComponent('A,B,C'))
  })
})
