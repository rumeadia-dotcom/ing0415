/**
 * 로젠 SDK zod 스키마 단위 테스트.
 *
 * 강제: 새 zod 스키마는 pass 1 + fail ≥1 (testing.md §6.1).
 */

import { describe, it, expect } from 'vitest'
import {
  GetSlipNoReqSchema,
  GetSlipNoResSchema,
  GetSlipNoResultSchema,
  RegisterOrderDataReqSchema,
  RegisterOrderDataResSchema,
  RegisterOrderDataResultSchema,
  BuildPrintPopupUrlReqSchema,
  InquirySlipNoMultiReqSchema,
  InquirySlipNoMultiResSchema,
  InquirySlipNoMultiResultSchema,
  LogenVerifyRequestSchema,
  LogenVerifyResponseSchema,
} from '../schemas'
import { resultCdToLogenCode, httpStatusToLogenCode } from '../errors'

describe('schemas — getSlipNo', () => {
  it('req 정상', () => {
    expect(
      GetSlipNoReqSchema.safeParse({ userId: 'U', slipQty: 3 }).success,
    ).toBe(true)
  })
  it('req slipQty=0 fail', () => {
    expect(
      GetSlipNoReqSchema.safeParse({ userId: 'U', slipQty: 0 }).success,
    ).toBe(false)
  })
  it('res 정상', () => {
    expect(
      GetSlipNoResSchema.safeParse({
        resultCd: '00',
        startSlipNo: '1',
        closeSlipNo: '2',
        slipNo: ['1', '2'],
      }).success,
    ).toBe(true)
  })
  it('res resultCd 누락 fail', () => {
    expect(GetSlipNoResSchema.safeParse({}).success).toBe(false)
  })
  it('result 정상', () => {
    expect(
      GetSlipNoResultSchema.safeParse({
        startSlipNo: '1',
        closeSlipNo: '2',
        slipNo: ['1', '2'],
      }).success,
    ).toBe(true)
  })
  it('result slipNo 빈 배열 fail', () => {
    expect(
      GetSlipNoResultSchema.safeParse({
        startSlipNo: '1',
        closeSlipNo: '2',
        slipNo: [],
      }).success,
    ).toBe(false)
  })
})

describe('schemas — registerOrderData', () => {
  const valid = {
    userId: 'U',
    custCd: 'C',
    takeDt: '20260521',
    sndCustNm: '발송',
    sndCustAddr: '서울',
    sndTelNo: '02-1',
    rcvCustNm: '수취',
    rcvCustAddr: '부산',
    rcvTelNo: '010-1',
    fareTy: 'C',
    qty: 1,
    dlvFare: 0,
    fixTakeNo: 'ORD-1',
    slipNo: '1234567890',
  }
  it('정상', () => {
    expect(RegisterOrderDataReqSchema.safeParse(valid).success).toBe(true)
  })
  it('takeDt 8자리 아니면 fail', () => {
    expect(
      RegisterOrderDataReqSchema.safeParse({ ...valid, takeDt: '2026-05-21' })
        .success,
    ).toBe(false)
  })
  it('qty 음수 fail', () => {
    expect(
      RegisterOrderDataReqSchema.safeParse({ ...valid, qty: -1 }).success,
    ).toBe(false)
  })
  it('res 정상', () => {
    expect(
      RegisterOrderDataResSchema.safeParse({
        resultCd: '00',
        fixTakeNo: 'X',
      }).success,
    ).toBe(true)
  })
  it('result fail when fixTakeNo 누락', () => {
    expect(
      RegisterOrderDataResultSchema.safeParse({ resultCd: '00' }).success,
    ).toBe(false)
  })
})

describe('schemas — buildPrintPopupUrl', () => {
  it('정상', () => {
    expect(BuildPrintPopupUrlReqSchema.safeParse({ takeDt: '20260521' }).success).toBe(
      true,
    )
  })
  it('takeDt 형식 위반', () => {
    expect(BuildPrintPopupUrlReqSchema.safeParse({ takeDt: '2026' }).success).toBe(
      false,
    )
  })
})

describe('schemas — inquirySlipNoMulti', () => {
  it('정상', () => {
    expect(InquirySlipNoMultiReqSchema.safeParse({ slipNos: ['1'] }).success).toBe(
      true,
    )
  })
  it('빈 배열 fail', () => {
    expect(InquirySlipNoMultiReqSchema.safeParse({ slipNos: [] }).success).toBe(
      false,
    )
  })
  it('100 초과 fail', () => {
    const big = Array.from({ length: 101 }, (_, i) => String(i + 1))
    expect(InquirySlipNoMultiReqSchema.safeParse({ slipNos: big }).success).toBe(
      false,
    )
  })
  it('res 정상 (list 키)', () => {
    expect(
      InquirySlipNoMultiResSchema.safeParse({
        resultCd: '00',
        list: [{ slipNo: '1', status: 'Y' }],
      }).success,
    ).toBe(true)
  })
  it('result 정상', () => {
    expect(
      InquirySlipNoMultiResultSchema.safeParse({
        slipNo: ['1'],
        status: ['Y'],
      }).success,
    ).toBe(true)
  })
})

describe('schemas — verify edge fn', () => {
  it('request 정상', () => {
    expect(
      LogenVerifyRequestSchema.safeParse({ userId: 'U', custCd: 'C' }).success,
    ).toBe(true)
  })
  it('request 빈 문자열 fail', () => {
    expect(
      LogenVerifyRequestSchema.safeParse({ userId: '', custCd: 'C' }).success,
    ).toBe(false)
  })
  it('response 정상', () => {
    expect(
      LogenVerifyResponseSchema.safeParse({
        status: 'active',
        verifiedAt: '2026-05-21T00:00:00.000Z',
        correlationId: 'abc',
      }).success,
    ).toBe(true)
  })
  it('response unknown status fail', () => {
    expect(
      LogenVerifyResponseSchema.safeParse({
        status: 'banana',
        verifiedAt: 'now',
        correlationId: 'a',
      }).success,
    ).toBe(false)
  })
})

describe('errors — code 매핑', () => {
  it('http 401 → unauthorized', () => {
    expect(httpStatusToLogenCode(401)).toBe('unauthorized')
  })
  it('http 500 → server', () => {
    expect(httpStatusToLogenCode(500)).toBe('server')
  })
  it('http 200 → unknown', () => {
    // 호출측이 200 일 때 본 함수를 호출하지 않지만 fallback 확인.
    expect(httpStatusToLogenCode(200)).toBe('unknown')
  })
  it("resultCd '00' → null (success)", () => {
    expect(resultCdToLogenCode('00')).toBeNull()
  })
  it("resultCd 'OK' → null", () => {
    expect(resultCdToLogenCode('OK')).toBeNull()
  })
  it("resultCd 'AUTH99' → unauthorized", () => {
    expect(resultCdToLogenCode('AUTH99')).toBe('unauthorized')
  })
  it("resultCd 'VAL100' → validation", () => {
    expect(resultCdToLogenCode('VAL100')).toBe('validation')
  })
  it("resultCd 'SYS500' → server", () => {
    expect(resultCdToLogenCode('SYS500')).toBe('server')
  })
  it("resultCd 'ZZZ' → unknown", () => {
    expect(resultCdToLogenCode('ZZZ')).toBe('unknown')
  })
})
