import { describe, expect, it } from 'vitest'
import {
  ELEVEN_ST_CARRIER_CODES,
  buildElevenStDispatchPath,
  buildElevenStOrderListPath,
  classifyElevenStDispatchResult,
  classifyElevenStOrdersResult,
  mapElevenStOrders,
  toElevenStCarrierCode,
  toElevenStOrderDate,
} from '../eleven-st-map'

/**
 * 11번가 PR-5 (Edge map 미러) — 주문조회(ordservices/complete 1876) + 발송처리(reqdelivery 1888).
 *
 * Web 측 real/11st/__tests__/eleven-st-orders.test.ts 와 동일 시나리오 (FE↔BE parity).
 * eleven-st-map.ts 는 순수(npm/Deno specifier 없음) 라 Vitest 직접 import 가능.
 *
 * 마스터: docs/architecture/v1/features/11st.md §4.4/§4.5/§7/§8-3 + spec paid-1876/dispatch-1888.
 * R-001: 성공 + 실패/엣지 동반.
 */

describe('toElevenStOrderDate — 12자리 YYYYMMDDhhmm (Edge)', () => {
  it('성공: ISO → 12자리 (UTC, 초 제거)', () => {
    expect(toElevenStOrderDate('2026-05-27T10:20:30+00:00')).toBe('202605271020')
  })
  it('성공: offset 시각도 UTC 로 정규화', () => {
    expect(toElevenStOrderDate('2026-05-27T19:20:00+09:00')).toBe('202605271020')
  })
  it('엣지: 잘못된 입력/undefined → 빈 문자열', () => {
    expect(toElevenStOrderDate('not-a-date')).toBe('')
    expect(toElevenStOrderDate(undefined)).toBe('')
  })
})

describe('택배사 코드 매핑 (Edge)', () => {
  it('성공: LOGEN → 00002, CJ → 00034', () => {
    expect(ELEVEN_ST_CARRIER_CODES.LOGEN).toBe('00002')
    expect(toElevenStCarrierCode('LOGEN')).toBe('00002')
    expect(toElevenStCarrierCode('cj')).toBe('00034')
  })
  it('실패: 미매핑 택배사 → undefined', () => {
    expect(toElevenStCarrierCode('UNKNOWN_CARRIER')).toBeUndefined()
  })
})

describe('REST path 빌더 (Edge)', () => {
  it('buildElevenStOrderListPath — complete/{start}/{end}', () => {
    expect(buildElevenStOrderListPath('202605200000', '202605270000')).toBe(
      '/ordservices/complete/202605200000/202605270000',
    )
  })
  it('buildElevenStDispatchPath — reqdelivery + dlvMthdCd=01', () => {
    expect(
      buildElevenStDispatchPath({
        sendDt: '202605270900',
        dlvEtprsCd: '00002',
        invcNo: '6496711734',
        dlvNo: '40860365',
      }),
    ).toBe('/ordservices/reqdelivery/202605270900/01/00002/6496711734/40860365')
  })
})

describe('mapElevenStOrders — dlvNo 수집 (Edge)', () => {
  it('성공: 단일 주문 + extra.dlvNo + ordPayAmt fallback', () => {
    const parsed = {
      orders: { order: { ordNo: '201001108318120', dlvNo: '40860365', ordPayAmt: 16310 } },
    }
    const orders = mapElevenStOrders(parsed)
    expect(orders[0]?.externalOrderId).toBe('201001108318120')
    expect(orders[0]?.extra?.dlvNo).toBe('40860365')
    expect(orders[0]?.orderAmount).toBe(16310)
    expect(orders[0]?.status).toBe('new_pay')
  })
  it('엣지: 빈 결과 → 빈 배열', () => {
    expect(mapElevenStOrders({ orders: { result_code: 0 } })).toEqual([])
  })
})

describe('classifyElevenStOrdersResult (Edge)', () => {
  it('정상 목록 → ok', () => {
    expect(classifyElevenStOrdersResult({ orders: { order: { ordNo: 'A' } } })).toEqual({
      kind: 'ok',
    })
  })
  it('result_code=0 → empty', () => {
    expect(classifyElevenStOrdersResult({ orders: { result_code: 0 } })).toEqual({
      kind: 'empty',
    })
  })
  it('-3105 → error', () => {
    const r = classifyElevenStOrdersResult({
      orders: { result_code: -3105, result_text: '최대 조회기간은 일주일 입니다.' },
    })
    expect(r.kind).toBe('error')
    if (r.kind === 'error') expect(r.code).toBe('-3105')
  })
})

describe('classifyElevenStDispatchResult — §9.7 반환 정책 (Edge)', () => {
  it('성공: 0 / -3308(멱등) → ok', () => {
    expect(classifyElevenStDispatchResult({ ResultOrder: { result_code: 0 } }).kind).toBe('ok')
    expect(classifyElevenStDispatchResult({ ResultOrder: { result_code: -3308 } }).kind).toBe(
      'ok',
    )
  })
  it('정상 거부: -3306/-3320/-3307 → rejected', () => {
    expect(classifyElevenStDispatchResult({ ResultOrder: { result_code: -3306 } }).kind).toBe(
      'rejected',
    )
    expect(classifyElevenStDispatchResult({ ResultOrder: { result_code: -3320 } }).kind).toBe(
      'rejected',
    )
    expect(classifyElevenStDispatchResult({ ResultOrder: { result_code: -3307 } }).kind).toBe(
      'rejected',
    )
  })
  it('횡단 실패: -1000/-3311/미지 음수 → throwable', () => {
    expect(classifyElevenStDispatchResult({ ResultOrder: { result_code: -1000 } }).kind).toBe(
      'throwable',
    )
    expect(classifyElevenStDispatchResult({ ResultOrder: { result_code: -3311 } }).kind).toBe(
      'throwable',
    )
    expect(classifyElevenStDispatchResult({ ResultOrder: { result_code: -1 } }).kind).toBe(
      'throwable',
    )
  })
})
