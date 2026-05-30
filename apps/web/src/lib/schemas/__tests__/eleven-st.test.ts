import { describe, expect, it } from 'vitest'
import {
  ElevenStCategorySchema,
  ElevenStOfficialNoticeSchema,
  ElevenStOrderSchema,
  ElevenStProductCreateResponseSchema,
  ElevenStProductCreateSchema,
  ElevenStShippingAddressSchema,
  ELEVEN_ST_CREATE_SUCCESS_CODES,
} from '../eleven-st'

/**
 * 11번가 zod 스키마 계약 테스트 (PR-0, R-001: 스키마마다 pass 1 + fail ≥1).
 * 마스터: docs/architecture/v1/features/11st.md §4.
 */

const validProduct = {
  selMthdCd: '01',
  prdTypCd: '01',
  prdStatCd: '01',
  dispCtgrNo: '1122',
  prdNm: '11번가 목도리',
  brand: '알수없음',
  selPrc: 50000,
  prdSelQty: 99,
  prdImage01: 'https://cdn.example.com/a.jpg',
  htmlDetail: '<html><body>상세</body></html>',
  minorSelCnYn: 'Y',
  suplDtyfrPrdClfCd: '01',
  rmaterialTypCd: '04',
  orgnTypCd: '03',
  dlvCnAreaCd: '01',
  dlvWyCd: '01',
  dlvClf: '02',
  dlvCstInstBasiCd: '02',
  bndlDlvCnYn: 'N',
  dlvCstPayTypCd: '01',
  jejuDlvCst: 3000,
  islandDlvCst: 5000,
  rtngdDlvCst: 2500,
  exchDlvCst: 6000,
  addrSeqOut: '4',
  addrSeqIn: '8',
  asDetail: '구입후 1년 이내',
  rtngExchDetail: '비용본인부담',
}

describe('ElevenStProductCreateSchema (§4.1 상품등록 요청)', () => {
  it('pass: 필수필드 충족 + 미지 필드 passthrough 보존', () => {
    const parsed = ElevenStProductCreateSchema.parse({
      ...validProduct,
      dlvCst1: '2500', // 조건부 필드 — passthrough
    })
    expect(parsed.dispCtgrNo).toBe('1122')
    expect((parsed as Record<string, unknown>).dlvCst1).toBe('2500')
  })

  it('pass: selPrc 문자열도 coerce 되어 통과', () => {
    const parsed = ElevenStProductCreateSchema.parse({ ...validProduct, selPrc: '50000' })
    expect(parsed.selPrc).toBe(50000)
  })

  it('fail: 판매가 10원 단위 위반', () => {
    expect(() => ElevenStProductCreateSchema.parse({ ...validProduct, selPrc: 50005 })).toThrow()
  })

  it('fail: 필수필드(selMthdCd) 누락', () => {
    const { selMthdCd: _omit, ...rest } = validProduct
    expect(() => ElevenStProductCreateSchema.parse(rest)).toThrow()
  })

  it('fail: 상품명 100자 초과', () => {
    expect(() =>
      ElevenStProductCreateSchema.parse({ ...validProduct, prdNm: '가'.repeat(101) }),
    ).toThrow()
  })
})

describe('ElevenStProductCreateResponseSchema (§4.2 ClientMessage)', () => {
  it('pass: 성공 응답 (productNo + resultCode 200)', () => {
    const parsed = ElevenStProductCreateResponseSchema.parse({
      productNo: 52844137,
      resultCode: 200,
      message: '상품등록 완료',
    })
    expect(parsed.productNo).toBe('52844137') // coerce string
    expect(parsed.resultCode).toBe('200')
    expect(ELEVEN_ST_CREATE_SUCCESS_CODES).toContain(parsed.resultCode)
  })

  it('fail: resultCode 누락', () => {
    expect(() => ElevenStProductCreateResponseSchema.parse({ message: 'x' })).toThrow()
  })
})

describe('ElevenStCategorySchema (§4.3 ns2 제거 후)', () => {
  it('pass: dispNo/leafYn/depth 정상', () => {
    const parsed = ElevenStCategorySchema.parse({
      dispNo: '1033',
      dispNm: '주방/이미용/생활가전',
      depth: '1',
      parentDispNo: '0',
      leafYn: 'N',
    })
    expect(parsed.dispNo).toBe('1033')
    expect(parsed.depth).toBe(1)
  })

  it('fail: leafYn 잘못된 enum', () => {
    expect(() =>
      ElevenStCategorySchema.parse({
        dispNo: '1',
        dispNm: 'x',
        depth: 1,
        parentDispNo: '0',
        leafYn: 'true',
      }),
    ).toThrow()
  })
})

describe('ElevenStOrderSchema (§4.4 dlvNo 보존)', () => {
  it('pass: ordNo + dlvNo 필수 보존', () => {
    const parsed = ElevenStOrderSchema.parse({
      ordNo: '201001108318120',
      dlvNo: '40860365',
      ordQty: '1',
      ordAmt: '19000',
    })
    expect(parsed.dlvNo).toBe('40860365')
    expect(parsed.ordQty).toBe(1)
  })

  it('fail: dlvNo 누락 (발송처리 키 없음)', () => {
    expect(() => ElevenStOrderSchema.parse({ ordNo: '1' })).toThrow()
  })
})

describe('ElevenStShippingAddressSchema (§4 Layer 2 출고지/반품지)', () => {
  it('pass: addrSeq + addrNm', () => {
    const parsed = ElevenStShippingAddressSchema.parse({ addrSeq: '14', addrNm: '본사' })
    expect(parsed.addrSeq).toBe('14')
  })

  it('fail: addrNm 누락', () => {
    expect(() => ElevenStShippingAddressSchema.parse({ addrSeq: '14' })).toThrow()
  })
})

describe('ElevenStOfficialNoticeSchema (§4 ProductNotification)', () => {
  it('pass: type + item[{code,name}]', () => {
    const parsed = ElevenStOfficialNoticeSchema.parse({
      type: '891011',
      item: [{ code: '23759468', name: '나일론' }],
    })
    expect(parsed.item).toHaveLength(1)
  })

  it('fail: item 비어있음', () => {
    expect(() => ElevenStOfficialNoticeSchema.parse({ type: '891011', item: [] })).toThrow()
  })
})
