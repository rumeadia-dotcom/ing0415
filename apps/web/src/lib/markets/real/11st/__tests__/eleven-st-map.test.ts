import { describe, expect, it } from 'vitest'
import {
  ELEVEN_ST_API_BASE,
  ELEVEN_ST_API_CODES,
  buildElevenStProductRaw,
  buildElevenStProductXml,
  escapeXml,
  extractElevenStProductNo,
  isElevenStShipmentOk,
  mapElevenStCategories,
  mapElevenStOrders,
  normalizeElevenStStatus,
  toElevenStDate,
  xmlDocToObject,
} from '../map'

/**
 * 11번가 어댑터 순수 매핑 로직 단위 테스트 (프론트엔드 포트).
 *
 * Edge Function 측 __tests__/eleven-st.test.ts 와 동일 시나리오 — map.ts 가
 * eleven-st-map.ts 의 정확한 포트임을 보장해 FE↔BE parity 유지.
 *
 * 어댑터 본체(index.ts)는 fetch / DOMParser / EUC-KR 디코딩 등 런타임 의존이 있어
 * 본 테스트는 fetch/XML파싱 후의 순수 매핑(map.ts)만 검증한다. xmlDocToObject 는
 * jsdom DOMParser 로 별도 커버.
 *
 * R-001: 성공 + 실패/엣지 시나리오 동반.
 */
describe('eleven-st-map — 상수', () => {
  it('ELEVEN_ST_API_BASE 게이트웨이 화이트리스트 정합', () => {
    expect(ELEVEN_ST_API_BASE).toBe(
      'https://openapi.11st.co.kr/openapi/OpenApiService.tmall',
    )
  })
  it('apiCode 4종 정의', () => {
    expect(ELEVEN_ST_API_CODES.category).toBe('ProductCategoryInfo')
    expect(ELEVEN_ST_API_CODES.productCreate).toBe('ProductRegister')
    expect(ELEVEN_ST_API_CODES.orderList).toBe('GetOrderList')
    expect(ELEVEN_ST_API_CODES.shipment).toBe('SendGoods')
  })
})

describe('normalizeElevenStStatus', () => {
  it('결제완료/배송대기 코드 101·102 → new_pay', () => {
    expect(normalizeElevenStStatus('101')).toBe('new_pay')
    expect(normalizeElevenStStatus('102')).toBe('new_pay')
  })
  it('발송/배송/완료/취소/반품 코드 매핑', () => {
    expect(normalizeElevenStStatus('201')).toBe('dispatched')
    expect(normalizeElevenStStatus('203')).toBe('dispatched')
    expect(normalizeElevenStStatus('202')).toBe('delivering')
    expect(normalizeElevenStStatus('301')).toBe('delivered')
    expect(normalizeElevenStStatus('302')).toBe('delivered')
    expect(normalizeElevenStStatus('401')).toBe('cancelled')
    expect(normalizeElevenStStatus('502')).toBe('returned')
  })
  it('한글 라벨 보조 매핑', () => {
    expect(normalizeElevenStStatus('결제완료')).toBe('new_pay')
    expect(normalizeElevenStStatus('발송처리')).toBe('dispatched')
    expect(normalizeElevenStStatus('배송중')).toBe('delivering')
    expect(normalizeElevenStStatus('배송완료')).toBe('delivered')
    expect(normalizeElevenStStatus('취소완료')).toBe('cancelled')
    expect(normalizeElevenStStatus('반품완료')).toBe('returned')
  })
  it('매핑 안 되는 raw → unknown (실패 시나리오)', () => {
    expect(normalizeElevenStStatus('ZZZ')).toBe('unknown')
    expect(normalizeElevenStStatus('')).toBe('unknown')
  })
})

describe('mapElevenStOrders', () => {
  it('단일 주문(Order 객체) → MarketOrder 1건, PII/금액 매핑', () => {
    const parsed = {
      Orders: {
        Order: {
          OrdNo: 202605270001,
          OrdNm: '홍길동',
          RcvrNm: '김수령',
          RcvrBaseAddr: '서울시 강남구',
          RcvrDtlsAddr: '101동 202호',
          RcvrPrtblNo: '010-1234-5678',
          PrdNm: '테스트 상품',
          OrdQty: 2,
          OrdAmt: 25000,
          OrdStat: '101',
          OrdDt: '2026-05-27 10:00:00',
        },
      },
    }
    const orders = mapElevenStOrders(parsed)
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({
      market: '11st',
      externalOrderId: '202605270001',
      buyerName: '홍길동',
      receiverName: '김수령',
      receiverAddress: '서울시 강남구 101동 202호',
      receiverPhone: '010-1234-5678',
      productName: '테스트 상품',
      quantity: 2,
      orderAmount: 25000,
      status: 'new_pay',
    })
    expect(orders[0]?.paidAt).toMatch(/\+00:00$/)
  })

  it('다중 주문(Order 배열) → 각각 매핑', () => {
    const parsed = {
      Orders: { Order: [{ OrdNo: 'A', OrdStat: '201' }, { OrdNo: 'B', OrdStat: '301' }] },
    }
    const orders = mapElevenStOrders(parsed)
    expect(orders.map((o) => o.externalOrderId)).toEqual(['A', 'B'])
    expect(orders.map((o) => o.status)).toEqual(['dispatched', 'delivered'])
  })

  it('빈 응답 → 빈 배열 (엣지)', () => {
    expect(mapElevenStOrders({})).toEqual([])
    expect(mapElevenStOrders({ Orders: {} })).toEqual([])
  })

  it('누락 필드 → 안전 기본값 (미상/주소 없음/연락처 없음/상품명 없음, qty>=1)', () => {
    const orders = mapElevenStOrders({ Orders: { Order: { OrdNo: 'X' } } })
    expect(orders[0]).toMatchObject({
      buyerName: '미상',
      receiverName: '미상',
      receiverAddress: '주소 없음',
      receiverPhone: '연락처 없음',
      productName: '상품명 없음',
      quantity: 1,
      orderAmount: 0,
      status: 'unknown',
    })
  })
})

describe('mapElevenStCategories', () => {
  it('카테고리 목록 매핑 (leaf Y → true)', () => {
    const parsed = {
      Categorys: {
        Category: [
          { CategoryCode: '100', CategoryName: '패션', IsLeaf: 'N' },
          { CategoryCode: '101', CategoryName: '셔츠', IsLeaf: 'Y' },
        ],
      },
    }
    const cats = mapElevenStCategories(parsed)
    expect(cats).toHaveLength(2)
    expect(cats[0]).toMatchObject({ id: '100', name: '패션', leaf: false, depth: 1 })
    expect(cats[1]).toMatchObject({ id: '101', name: '셔츠', leaf: true })
  })
  it('단일 카테고리(객체) → 1건', () => {
    const cats = mapElevenStCategories({
      Categorys: { Category: { CategoryCode: '5', CategoryName: '전자', IsLeaf: '1' } },
    })
    expect(cats).toHaveLength(1)
    expect(cats[0]).toMatchObject({ id: '5', name: '전자', leaf: true })
  })
  it('빈 응답 → 빈 배열 (엣지)', () => {
    expect(mapElevenStCategories({})).toEqual([])
  })
  it('id/name 누락 → 안전 기본값 (엣지)', () => {
    const cats = mapElevenStCategories({ Categorys: { Category: { IsLeaf: 'N' } } })
    expect(cats[0]).toMatchObject({ id: 'unknown', name: '미분류', leaf: false })
  })
})

describe('상품 등록 빌드/응답', () => {
  it('buildElevenStProductRaw — 상품명 100자 제한 + 이미지 prdImage01.. 매핑', () => {
    const product = {
      id: '00000000-0000-0000-0000-000000000001',
      sellerId: '00000000-0000-0000-0000-000000000002',
      name: 'x'.repeat(120),
      priceKrw: 10000,
      stock: 5,
      images: [{ url: 'https://e.com/a.jpg', order: 0 }],
      descriptionHtml: '<p>상세</p>',
      shippingFeeKrw: 2500,
    } as unknown as Parameters<typeof buildElevenStProductRaw>[0]
    const mapping = {
      market: '11st' as const,
      categoryId: '101',
      transformedImageUrls: ['https://e.com/a.jpg', 'https://e.com/b.jpg'],
      extra: {},
    }
    const raw = buildElevenStProductRaw(product, mapping)
    expect(String(raw.prdNm)).toHaveLength(100)
    expect(raw.dispCtgrNo).toBe('101')
    expect(raw.prdImage01).toBe('https://e.com/a.jpg')
    expect(raw.prdImage02).toBe('https://e.com/b.jpg')
    expect(raw.selPrc).toBe(10000)
  })

  it('buildElevenStProductXml — XML 특수문자 escape', () => {
    const xml = buildElevenStProductXml({ prdNm: 'A & <B> "C"' })
    expect(xml).toContain('<prdNm>A &amp; &lt;B&gt; &quot;C&quot;</prdNm>')
    expect(xml).toContain('<Product>')
  })

  it('escapeXml 단위', () => {
    expect(escapeXml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;')
  })

  it('extractElevenStProductNo — 성공: productNo 추출', () => {
    const r = extractElevenStProductNo({
      Product: { result_code: '200', ProductNo: '987654' },
    })
    expect(r.productNo).toBe('987654')
    expect(r.resultCode).toBe('200')
  })

  it('extractElevenStProductNo — 실패: 상품번호 없음 → 빈 문자열', () => {
    const r = extractElevenStProductNo({
      Product: { result_code: '400', result_text: '카테고리 오류' },
    })
    expect(r.productNo).toBe('')
    expect(r.resultText).toBe('카테고리 오류')
  })
})

describe('발송 처리', () => {
  it('isElevenStShipmentOk — 성공 코드(200/0/빈값) → ok', () => {
    expect(isElevenStShipmentOk({ Result: { result_code: '200' } }).ok).toBe(true)
    expect(isElevenStShipmentOk({ Result: { result_code: '0' } }).ok).toBe(true)
    expect(isElevenStShipmentOk({}).ok).toBe(true)
  })
  it('isElevenStShipmentOk — 에러 코드 → ok=false + 메시지', () => {
    const r = isElevenStShipmentOk({
      Result: { result_code: '500', result_text: '이미 발송됨' },
    })
    expect(r.ok).toBe(false)
    expect(r.message).toBe('이미 발송됨')
  })
})

describe('toElevenStDate', () => {
  it('ISO → YYYYMMDDHHmmss (UTC)', () => {
    expect(toElevenStDate('2026-05-27T10:20:30+00:00')).toBe('20260527102030')
  })
  it('잘못된 입력 → 빈 문자열 (엣지)', () => {
    expect(toElevenStDate('not-a-date')).toBe('')
  })
})

describe('xmlDocToObject — DOMParser 결과 → fast-xml-parser 호환 객체', () => {
  function parse(xml: string): Record<string, unknown> {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    return xmlDocToObject(doc)
  }

  it('중첩 + 형제 반복 → 배열, leaf 숫자 파싱 → mapElevenStOrders 호환', () => {
    const xml = `<?xml version="1.0" encoding="EUC-KR"?>
      <Orders>
        <Order>
          <OrdNo>A100</OrdNo>
          <OrdQty>2</OrdQty>
          <OrdAmt>25000</OrdAmt>
          <OrdStat>101</OrdStat>
        </Order>
        <Order>
          <OrdNo>B200</OrdNo>
          <OrdStat>301</OrdStat>
        </Order>
      </Orders>`
    const obj = parse(xml)
    const orders = mapElevenStOrders(obj)
    expect(orders.map((o) => o.externalOrderId)).toEqual(['A100', 'B200'])
    expect(orders.map((o) => o.status)).toEqual(['new_pay', 'delivered'])
    expect(orders[0]?.quantity).toBe(2)
    expect(orders[0]?.orderAmount).toBe(25000)
  })

  it('단일 Order 엘리먼트 → 객체 (배열 아님), mapElevenStOrders 1건', () => {
    const xml = `<Orders><Order><OrdNo>SOLO</OrdNo><OrdStat>202</OrdStat></Order></Orders>`
    const orders = mapElevenStOrders(parse(xml))
    expect(orders).toHaveLength(1)
    expect(orders[0]?.externalOrderId).toBe('SOLO')
    expect(orders[0]?.status).toBe('delivering')
  })

  it('상품 등록 응답 XML → extractElevenStProductNo 성공', () => {
    const xml = `<Product><result_code>200</result_code><ProductNo>987654</ProductNo></Product>`
    const r = extractElevenStProductNo(parse(xml))
    expect(r.productNo).toBe('987654')
    expect(r.resultCode).toBe('200')
  })

  it('잘못된 XML → 빈 객체 (실패 시나리오)', () => {
    const obj = parse('<<not valid>>')
    expect(mapElevenStOrders(obj)).toEqual([])
  })
})
