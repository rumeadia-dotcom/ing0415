import { describe, expect, it } from 'vitest'
import {
  ELEVEN_ST_API_BASE,
  ELEVEN_ST_API_CODES,
  ELEVEN_ST_REST_BASE,
  buildElevenStCategoryTree,
  buildElevenStCategoryUrl,
  buildElevenStProductRaw,
  buildElevenStProductXml,
  escapeXml,
  extractElevenStProductNo,
  mapElevenStCategories,
  mapElevenStCategoryCertMeta,
  mapElevenStOrders,
  normalizeElevenStStatus,
  stripNsPrefix,
  toElevenStDate,
} from '../eleven-st-map'

/**
 * 11번가 어댑터 순수 매핑 로직 단위 테스트.
 *
 * 어댑터 본체(eleven-st.ts)는 Deno 전용 import(npm:fast-xml-parser / gatewayFetch) 라
 * Vitest 가 직접 import 불가 → fetch/XML파싱 후의 순수 매핑(eleven-st-map.ts)만 검증.
 * 실 HTTP 호출 경로는 Deno 통합 검증(실 키 + Lightsail Gateway)에서.
 *
 * R-001: 성공 + 실패/엣지 시나리오 동반.
 */
describe('stripNsPrefix — ns2 네임스페이스 제거 (PR-0)', () => {
  it('성공: 중첩 객체/배열의 ns2: prefix 를 재귀 제거', () => {
    const input = {
      'ns2:categorys': {
        'ns2:category': [
          { 'ns2:dispNo': '1033', 'ns2:dispNm': '주방', leafYn: 'N' },
          { 'ns2:dispNo': '1097', 'ns2:dispNm': '가전', leafYn: 'Y' },
        ],
      },
    }
    expect(stripNsPrefix(input)).toEqual({
      categorys: {
        category: [
          { dispNo: '1033', dispNm: '주방', leafYn: 'N' },
          { dispNo: '1097', dispNm: '가전', leafYn: 'Y' },
        ],
      },
    })
  })

  it('성공: prefix 없는 키는 그대로 보존', () => {
    expect(stripNsPrefix({ productNo: '52844137', resultCode: '200' })).toEqual({
      productNo: '52844137',
      resultCode: '200',
    })
  })

  it('엣지: 원본 비변형 + 스칼라/빈 입력 안전', () => {
    const src = { 'ns2:a': 1 }
    stripNsPrefix(src)
    expect(Object.keys(src)).toEqual(['ns2:a']) // 입력 불변
    expect(stripNsPrefix('SUCCESS')).toBe('SUCCESS')
    expect(stripNsPrefix(null)).toBe(null)
    expect(stripNsPrefix([])).toEqual([])
  })

  it('엣지: 콜론 1개만 제거 (선행 prefix 한정)', () => {
    expect(stripNsPrefix({ 'ns2:result_message': 'SUCCESS' })).toEqual({
      result_message: 'SUCCESS',
    })
  })
})

describe('eleven-st-map — 상수', () => {
  it('ELEVEN_ST_API_BASE 게이트웨이 화이트리스트 정합', () => {
    expect(ELEVEN_ST_API_BASE).toBe(
      'https://openapi.11st.co.kr/openapi/OpenApiService.tmall',
    )
  })
  it('apiCode 4종 정의', () => {
    expect(ELEVEN_ST_API_CODES.category).toBeTruthy()
    expect(ELEVEN_ST_API_CODES.productCreate).toBeTruthy()
    expect(ELEVEN_ST_API_CODES.orderList).toBeTruthy()
    expect(ELEVEN_ST_API_CODES.shipment).toBeTruthy()
  })
})

describe('normalizeElevenStStatus', () => {
  it('결제완료/배송대기 코드 101·102 → new_pay', () => {
    expect(normalizeElevenStStatus('101')).toBe('new_pay')
    expect(normalizeElevenStStatus('102')).toBe('new_pay')
  })
  it('발송/배송/완료/취소/반품 코드 매핑', () => {
    expect(normalizeElevenStStatus('201')).toBe('dispatched')
    expect(normalizeElevenStStatus('202')).toBe('delivering')
    expect(normalizeElevenStStatus('301')).toBe('delivered')
    expect(normalizeElevenStStatus('401')).toBe('cancelled')
    expect(normalizeElevenStStatus('502')).toBe('returned')
  })
  it('한글 라벨 보조 매핑', () => {
    expect(normalizeElevenStStatus('결제완료')).toBe('new_pay')
    expect(normalizeElevenStStatus('배송중')).toBe('delivering')
  })
  it('매핑 안 되는 raw → unknown (실패 시나리오)', () => {
    expect(normalizeElevenStStatus('ZZZ')).toBe('unknown')
    expect(normalizeElevenStStatus('')).toBe('unknown')
  })
})

describe('mapElevenStOrders (PR-5 — ns2:orders/order, dlvNo 수집)', () => {
  it('단일 주문(order 객체) → MarketOrder 1건, PII/금액/dlvNo 매핑', () => {
    const parsed = {
      orders: {
        order: {
          ordNo: 202605270001,
          dlvNo: 40860365,
          ordNm: '홍길동',
          rcvrNm: '김수령',
          rcvrBaseAddr: '서울시 강남구',
          rcvrDtlsAddr: '101동 202호',
          rcvrPrtblNo: '010-1234-5678',
          prdNm: '테스트 상품',
          ordQty: 2,
          ordAmt: 25000,
          ordStlEndDt: '2026-05-27 10:00:00',
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
    expect(orders[0]?.extra?.dlvNo).toBe('40860365')
    expect(orders[0]?.paidAt).toMatch(/\+00:00$/)
  })

  it('다중 주문(order 배열) → 각각 dlvNo 수집', () => {
    const parsed = {
      orders: { order: [{ ordNo: 'A', dlvNo: '111' }, { ordNo: 'B', dlvNo: '222' }] },
    }
    const orders = mapElevenStOrders(parsed)
    expect(orders.map((o) => o.externalOrderId)).toEqual(['A', 'B'])
    expect(orders.map((o) => o.extra?.dlvNo)).toEqual(['111', '222'])
  })

  it('빈 응답 → 빈 배열 (엣지)', () => {
    expect(mapElevenStOrders({})).toEqual([])
    expect(mapElevenStOrders({ orders: {} })).toEqual([])
  })

  it('누락 필드 → 안전 기본값 (미상/주소 없음/연락처 없음/상품명 없음, qty>=1, dlvNo 없으면 extra 생략)', () => {
    const orders = mapElevenStOrders({ orders: { order: { ordNo: 'X' } } })
    expect(orders[0]).toMatchObject({
      buyerName: '미상',
      receiverName: '미상',
      receiverAddress: '주소 없음',
      receiverPhone: '연락처 없음',
      productName: '상품명 없음',
      quantity: 1,
      orderAmount: 0,
      status: 'new_pay',
    })
    expect(orders[0]?.extra).toBeUndefined()
  })
})

describe('카테고리 — REST base / URL (PR-1)', () => {
  it('ELEVEN_ST_REST_BASE = api.11st.co.kr/rest', () => {
    expect(ELEVEN_ST_REST_BASE).toBe('https://api.11st.co.kr/rest')
  })
  it('buildElevenStCategoryUrl() — 1001 전체 / 1617 하위(path variable)', () => {
    expect(buildElevenStCategoryUrl()).toBe(
      'https://api.11st.co.kr/rest/cateservice/category',
    )
    expect(buildElevenStCategoryUrl('1097')).toBe(
      'https://api.11st.co.kr/rest/cateservice/category/1097',
    )
  })
})

describe('mapElevenStCategories — ns2 + parentDispNo 트리 (PR-1 재작성)', () => {
  const sample1001 = {
    'ns2:categorys': {
      'ns2:category': [
        { dispNo: '1033', dispNm: '주방가전', depth: '1', parentDispNo: '0', leafYn: 'Y' },
        { dispNo: '1097', dispNm: '주방조리가전', depth: '2', parentDispNo: '1033', leafYn: 'Y' },
        { dispNo: '1098', dispNm: '전기밥솥', depth: '3', parentDispNo: '1097', leafYn: 'N' },
      ],
    },
  }

  it('성공: ns2 제거 후 parentDispNo 대>중>소 트리', () => {
    const tree = mapElevenStCategories(sample1001)
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ id: '1033', name: '주방가전', depth: 1, parentId: null, leaf: false })
    expect(tree[0]?.children[0]).toMatchObject({ id: '1097', parentId: '1033', leaf: false })
    expect(tree[0]?.children[0]?.children[0]).toMatchObject({ id: '1098', parentId: '1097', leaf: true })
  })

  it('성공: 단일 카테고리(객체) → 루트 1건', () => {
    const tree = mapElevenStCategories({
      'ns2:categorys': {
        'ns2:category': { dispNo: '1', dispNm: '전자', depth: '1', parentDispNo: '0', leafYn: 'N' },
      },
    })
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ id: '1', leaf: true })
  })

  it('엣지: 빈 응답 / categorys 누락 → 빈 배열', () => {
    expect(mapElevenStCategories({})).toEqual([])
    expect(mapElevenStCategories({ 'ns2:categorys': {} })).toEqual([])
  })

  it('실패/엣지: 필드 누락 → 안전 기본값(unknown/미분류/depth1/leaf)', () => {
    const tree = mapElevenStCategories({
      'ns2:categorys': { 'ns2:category': { parentDispNo: '0' } },
    })
    expect(tree[0]).toMatchObject({ id: 'unknown', name: '미분류', depth: 1, leaf: true })
  })
})

describe('buildElevenStCategoryTree — 트리 빌드 단위', () => {
  it('자식이 있으면 부모는 강제 non-leaf (트리 구조 우선)', () => {
    const tree = buildElevenStCategoryTree([
      { id: 'p', name: '부모', depth: 1, parentId: null, leafHint: true },
      { id: 'c', name: '자식', depth: 2, parentId: 'p', leafHint: true },
    ])
    expect(tree[0]?.leaf).toBe(false)
    expect(tree[0]?.children[0]?.leaf).toBe(true)
  })

  it('동일 id 중복 → 첫 항목 유지(dedupe)', () => {
    const tree = buildElevenStCategoryTree([
      { id: 'x', name: '첫번째', depth: 1, parentId: null, leafHint: true },
      { id: 'x', name: '중복', depth: 1, parentId: null, leafHint: false },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]?.name).toBe('첫번째')
  })
})

describe('mapElevenStCategoryCertMeta — 1617 KC인증 메타', () => {
  it('성공: certType/requiredYn 추출 (메타 없는 노드 제외)', () => {
    const meta = mapElevenStCategoryCertMeta({
      'ns2:categorys': {
        'ns2:category': [
          { dispNo: '1098', certType: '2', requiredYn: 'Y' },
          { dispNo: '1097' },
        ],
      },
    })
    expect(meta['1098']).toEqual({ certType: '2', requiredYn: 'Y' })
    expect(meta['1097']).toBeUndefined()
  })

  it('엣지: 메타 없는 응답 → 빈 맵', () => {
    expect(mapElevenStCategoryCertMeta({ 'ns2:categorys': { 'ns2:category': { dispNo: '1' } } })).toEqual({})
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

// 발송처리 분류(classifyElevenStDispatchResult)/주문조회 분류/택배사 코드 매핑/path 빌더
// 단위 테스트는 PR-5 전용 eleven-st-orders.test.ts (Edge map 미러) 로 분리.

describe('toElevenStDate', () => {
  it('ISO → YYYYMMDDHHmmss (UTC)', () => {
    expect(toElevenStDate('2026-05-27T10:20:30+00:00')).toBe('20260527102030')
  })
  it('잘못된 입력 → 빈 문자열 (엣지)', () => {
    expect(toElevenStDate('not-a-date')).toBe('')
  })
})
