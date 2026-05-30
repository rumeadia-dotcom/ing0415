import { describe, expect, it } from 'vitest'
import {
  ELEVEN_ST_CARRIER_CODES,
  buildElevenStDispatchPath,
  buildElevenStOrderListPath,
  classifyElevenStDispatchResult,
  classifyElevenStOrdersResult,
  mapElevenStOrders,
  toElevenStOrderDate,
} from '../map'

/**
 * 11번가 PR-5 — 주문조회(ordservices/complete 1876) + 발송처리(reqdelivery 1888) 순수 매핑 단위 테스트.
 *
 * 마스터:
 *   - docs/architecture/v1/features/11st.md §4.4(주문)/§4.5(발송)/§7 PR-5/§8-3(택배사 코드)
 *   - docs/architecture/v1/features/11st-api/order/{paid-1876,dispatch-1888}.md (spec 원문)
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9.7(반환 정책)/§9.9(11번가)
 *
 * Edge 측 eleven-st-map.ts 와 동일 시나리오 (FE↔BE parity). 본 테스트는 fetch/XML 파싱 후의
 * 순수 매핑만 검증. R-001: 성공 + 실패/엣지 동반.
 *
 * 보안: 주문은 PII(수령인명·주소·전화) 포함 — 테스트 fixture 도 가짜 데이터. 로그 출력 없음.
 */

// ─────────────────────────────────────────────
// toElevenStOrderDate — 12자리 YYYYMMDDhhmm (paid-1876 path variable)
// ─────────────────────────────────────────────
describe('toElevenStOrderDate — 12자리 YYYYMMDDhhmm', () => {
  it('성공: ISO → 12자리 (UTC, 초 제거)', () => {
    expect(toElevenStOrderDate('2026-05-27T10:20:30+00:00')).toBe('202605271020')
  })
  it('성공: offset 시각도 UTC 로 정규화', () => {
    // 2026-05-27T19:20+09:00 == 2026-05-27T10:20Z
    expect(toElevenStOrderDate('2026-05-27T19:20:00+09:00')).toBe('202605271020')
  })
  it('엣지: 잘못된 입력 → 빈 문자열', () => {
    expect(toElevenStOrderDate('not-a-date')).toBe('')
    expect(toElevenStOrderDate(undefined)).toBe('')
  })
})

// ─────────────────────────────────────────────
// 택배사 코드 매핑 (§8-3 / dispatch-1888 enum)
// ─────────────────────────────────────────────
describe('ELEVEN_ST_CARRIER_CODES — 내부 CarrierCode → 11번가 dlvEtprsCd', () => {
  it('성공: v1 내부 enum LOGEN → 00002 (로젠택배)', () => {
    expect(ELEVEN_ST_CARRIER_CODES.LOGEN).toBe('00002')
  })
  it('성공: 주요 택배사 코드 (CJ/한진/롯데/우체국) spec 정합', () => {
    expect(ELEVEN_ST_CARRIER_CODES.CJ).toBe('00034')
    expect(ELEVEN_ST_CARRIER_CODES.HANJIN).toBe('00011')
    expect(ELEVEN_ST_CARRIER_CODES.LOTTE).toBe('00012')
    expect(ELEVEN_ST_CARRIER_CODES.EPOST).toBe('00007')
  })
})

// ─────────────────────────────────────────────
// buildElevenStOrderListPath — complete/{start}/{end} (1876)
// ─────────────────────────────────────────────
describe('buildElevenStOrderListPath', () => {
  it('성공: 12자리 start/end 경로 조립', () => {
    expect(buildElevenStOrderListPath('202605200000', '202605270000')).toBe(
      '/ordservices/complete/202605200000/202605270000',
    )
  })
})

// ─────────────────────────────────────────────
// buildElevenStDispatchPath — reqdelivery/{sendDt}/{dlvMthdCd}/{dlvEtprsCd}/{invcNo}/{dlvNo} (1888)
// ─────────────────────────────────────────────
describe('buildElevenStDispatchPath — GET path variable, body 없음', () => {
  it('성공: dlvMthdCd=01(택배) + 택배사코드 + 송장 + dlvNo 경로 조립', () => {
    const path = buildElevenStDispatchPath({
      sendDt: '202605270900',
      dlvEtprsCd: '00002',
      invcNo: '6496711734',
      dlvNo: '40860365',
    })
    expect(path).toBe(
      '/ordservices/reqdelivery/202605270900/01/00002/6496711734/40860365',
    )
  })
})

// ─────────────────────────────────────────────
// mapElevenStOrders — ns2:orders > ns2:order[], dlvNo 수집
// ─────────────────────────────────────────────
describe('mapElevenStOrders — paid-1876 ns2 응답 (dlvNo 수집 필수)', () => {
  it('성공: 단일 주문 → MarketOrder 1건 + extra.dlvNo 보존', () => {
    // 어댑터가 stripNsPrefix 통과시킨 형태(prefix 제거됨)
    const parsed = {
      orders: {
        order: {
          ordNo: 201001108318120,
          dlvNo: 40860365,
          ordPrdSeq: 1,
          ordNm: '홍길동',
          rcvrNm: '김수령',
          rcvrBaseAddr: '충북 청주시 상당구 용암동',
          rcvrDtlsAddr: '00번지 8809호',
          rcvrPrtblNo: '010-9999-9999',
          prdNm: '셔링 브이넥 니트 티셔츠',
          ordQty: 2,
          ordAmt: 19000,
          ordPayAmt: 16310,
          ordDt: '2010-01-10 04:07:11',
          ordStlEndDt: '2010-01-12 16:20:59',
        },
      },
    }
    const orders = mapElevenStOrders(parsed)
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({
      market: '11st',
      externalOrderId: '201001108318120',
      buyerName: '홍길동',
      receiverName: '김수령',
      receiverAddress: '충북 청주시 상당구 용암동 00번지 8809호',
      receiverPhone: '010-9999-9999',
      productName: '셔링 브이넥 니트 티셔츠',
      quantity: 2,
      orderAmount: 19000,
      status: 'new_pay',
    })
    // dlvNo 는 발송처리(1888)의 path 키 → MarketOrder.extra.dlvNo 로 반드시 수집
    expect(orders[0]?.extra?.dlvNo).toBe('40860365')
    // paidAt 은 결제완료일시(ordStlEndDt) 기준 + offset 정규화
    expect(orders[0]?.paidAt).toMatch(/\+00:00$/)
  })

  it('성공: 다중 주문(order 배열) → 각각 dlvNo 수집', () => {
    const parsed = {
      orders: {
        order: [
          { ordNo: 'A', dlvNo: '111', ordQty: 1, ordAmt: 1000 },
          { ordNo: 'B', dlvNo: '222', ordQty: 1, ordAmt: 2000 },
        ],
      },
    }
    const orders = mapElevenStOrders(parsed)
    expect(orders.map((o) => o.externalOrderId)).toEqual(['A', 'B'])
    expect(orders.map((o) => o.extra?.dlvNo)).toEqual(['111', '222'])
  })

  it('성공: ordAmt 누락 시 ordPayAmt fallback', () => {
    const parsed = {
      orders: { order: { ordNo: 'C', dlvNo: '333', ordPayAmt: 9900 } },
    }
    const orders = mapElevenStOrders(parsed)
    expect(orders[0]?.orderAmount).toBe(9900)
  })

  it('엣지: 빈 결과(result_code=0) → 빈 배열 (에러 아님)', () => {
    expect(
      mapElevenStOrders({ orders: { result_code: 0, result_text: '조회된 결과가 없습니다.' } }),
    ).toEqual([])
    expect(mapElevenStOrders({})).toEqual([])
  })

  it('실패/엣지: 누락 필드 → 안전 기본값 (qty>=1, dlvNo 없으면 extra 생략)', () => {
    const orders = mapElevenStOrders({ orders: { order: { ordNo: 'X' } } })
    expect(orders[0]).toMatchObject({
      buyerName: '미상',
      receiverName: '미상',
      receiverAddress: '주소 없음',
      receiverPhone: '연락처 없음',
      productName: '상품명 없음',
      quantity: 1,
      orderAmount: 0,
    })
    expect(orders[0]?.extra).toBeUndefined()
  })
})

// ─────────────────────────────────────────────
// classifyElevenStOrdersResult — 빈 결과 vs 에러 코드 (paid-1876 Error Response)
// ─────────────────────────────────────────────
describe('classifyElevenStOrdersResult', () => {
  it('성공: 정상 목록 → ok (코드 없음)', () => {
    expect(classifyElevenStOrdersResult({ orders: { order: { ordNo: 'A' } } })).toEqual({
      kind: 'ok',
    })
  })
  it('빈 결과(result_code=0) → empty (에러 아님)', () => {
    expect(
      classifyElevenStOrdersResult({ orders: { result_code: 0, result_text: '조회된 결과가 없습니다.' } }),
    ).toEqual({ kind: 'empty' })
  })
  it('에러: -3105(7일 초과) → error + 코드/메시지', () => {
    const r = classifyElevenStOrdersResult({
      orders: { result_code: -3105, result_text: '최대 조회기간은 일주일 입니다.' },
    })
    expect(r.kind).toBe('error')
    if (r.kind === 'error') {
      expect(r.code).toBe('-3105')
      expect(r.message).toContain('일주일')
    }
  })
  it('에러: -1000(점검중) → error', () => {
    const r = classifyElevenStOrdersResult({ orders: { result_code: -1000 } })
    expect(r.kind).toBe('error')
  })
})

// ─────────────────────────────────────────────
// classifyElevenStDispatchResult — ResultOrder.result_code 분류 (dispatch-1888)
//   §9.7 반환 정책: 0=성공 / -3306·-3320·-3307=정상거부(ok:false) / -1000·기타=throw
// ─────────────────────────────────────────────
describe('classifyElevenStDispatchResult — 반환 정책 (market-adapter.md §9.7)', () => {
  it('성공: result_code=0 → ok', () => {
    expect(
      classifyElevenStDispatchResult({ ResultOrder: { result_code: 0, result_text: '발송처리 완료' } }),
    ).toMatchObject({ kind: 'ok' })
  })
  it('성공: 이미 발송됨(-3308) → ok (묶음배송 멱등 — 정상 처리로 간주)', () => {
    expect(
      classifyElevenStDispatchResult({ ResultOrder: { result_code: -3308 } }),
    ).toMatchObject({ kind: 'ok' })
  })

  it('정상 거부: -3306(송장형식) → rejected + 코드', () => {
    const r = classifyElevenStDispatchResult({
      ResultOrder: { result_code: -3306, result_text: '송장번호가 유효하지 않습니다.' },
    })
    expect(r.kind).toBe('rejected')
    if (r.kind === 'rejected') {
      expect(r.code).toBe('-3306')
      expect(r.message).toContain('송장번호')
    }
  })
  it('정상 거부: -3320(중복송장) → rejected', () => {
    const r = classifyElevenStDispatchResult({ ResultOrder: { result_code: -3320 } })
    expect(r.kind).toBe('rejected')
  })
  it('정상 거부: -3307(택배사코드) → rejected', () => {
    const r = classifyElevenStDispatchResult({ ResultOrder: { result_code: -3307 } })
    expect(r.kind).toBe('rejected')
  })

  it('횡단 실패: -1000(점검중) → throwable', () => {
    const r = classifyElevenStDispatchResult({ ResultOrder: { result_code: -1000 } })
    expect(r.kind).toBe('throwable')
  })
  it('횡단 실패: -3311(시스템 장애) → throwable', () => {
    const r = classifyElevenStDispatchResult({ ResultOrder: { result_code: -3311 } })
    expect(r.kind).toBe('throwable')
  })
  it('실패/엣지: 알 수 없는 음수 코드(-1) → throwable (보수적)', () => {
    const r = classifyElevenStDispatchResult({ ResultOrder: { result_code: -1 } })
    expect(r.kind).toBe('throwable')
  })
})
