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
  isElevenStShipmentOk,
  mapElevenStCategories,
  mapElevenStCategoryCertMeta,
  mapElevenStOrders,
  normalizeElevenStStatus,
  stripNsPrefix,
  toElevenStDate,
  xmlDocToObject,
} from '../map'
import { CategoryNodeSchema } from '@/lib/schemas'

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

describe('카테고리 — REST base / URL (PR-1)', () => {
  it('ELEVEN_ST_REST_BASE = api.11st.co.kr/rest', () => {
    expect(ELEVEN_ST_REST_BASE).toBe('https://api.11st.co.kr/rest')
  })
  it('buildElevenStCategoryUrl() — 1001 전체 카테고리 (path variable 없음)', () => {
    expect(buildElevenStCategoryUrl()).toBe(
      'https://api.11st.co.kr/rest/cateservice/category',
    )
  })
  it('buildElevenStCategoryUrl(dispCtgrNo) — 1617 하위 (path variable 부착·encode)', () => {
    expect(buildElevenStCategoryUrl('1097')).toBe(
      'https://api.11st.co.kr/rest/cateservice/category/1097',
    )
    expect(buildElevenStCategoryUrl('  1097  ')).toBe(
      'https://api.11st.co.kr/rest/cateservice/category/1097',
    )
  })
})

describe('mapElevenStCategories — ns2 + parentDispNo 트리 (PR-1 재작성)', () => {
  // spec category-1001.md: ns2:categorys>ns2:category[], dispNo/dispNm/depth/parentDispNo/leafYn.
  // ⚠️ leafYn: Y=하위 카테고리 존재(=non-leaf) / N=말단(=leaf).
  const sample1001 = {
    'ns2:categorys': {
      'ns2:category': [
        { dispNo: '1033', dispNm: '주방/이미용/생활가전', depth: '1', parentDispNo: '0', leafYn: 'Y' },
        { dispNo: '1097', dispNm: '주방조리가전', depth: '2', parentDispNo: '1033', leafYn: 'Y' },
        { dispNo: '1098', dispNm: '전기밥솥', depth: '3', parentDispNo: '1097', leafYn: 'N' },
      ],
    },
  }

  it('성공: ns2 제거 후 parentDispNo 로 대>중>소 트리 빌드', () => {
    const tree = mapElevenStCategories(sample1001)
    expect(tree).toHaveLength(1) // 루트 1개 (parentDispNo=0)
    const root = tree[0]
    expect(root).toMatchObject({ id: '1033', name: '주방/이미용/생활가전', depth: 1, parentId: null })
    expect(root?.leaf).toBe(false) // 자식 보유 → non-leaf
    const mid = root?.children[0]
    expect(mid).toMatchObject({ id: '1097', name: '주방조리가전', depth: 2, parentId: '1033', leaf: false })
    const leaf = mid?.children[0]
    expect(leaf).toMatchObject({ id: '1098', name: '전기밥솥', depth: 3, parentId: '1097', leaf: true })
    expect(leaf?.children).toEqual([])
    // CategoryNodeSchema 재귀 통과.
    expect(() => CategoryNodeSchema.parse(root)).not.toThrow()
  })

  it('성공: 단일 카테고리(객체, 배열 아님) → 루트 1건', () => {
    const tree = mapElevenStCategories({
      'ns2:categorys': {
        'ns2:category': { dispNo: '1', dispNm: '전자', depth: '1', parentDispNo: '0', leafYn: 'N' },
      },
    })
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ id: '1', name: '전자', leaf: true, parentId: null })
  })

  it('엣지: 빈 응답 / categorys 누락 → 빈 배열', () => {
    expect(mapElevenStCategories({})).toEqual([])
    expect(mapElevenStCategories({ 'ns2:categorys': {} })).toEqual([])
  })

  it('엣지: ns2 prefix 가 없는 응답도 파싱 (categorys/category 키)', () => {
    const tree = mapElevenStCategories({
      categorys: { category: { dispNo: '7', dispNm: '도서', depth: '1', parentDispNo: '0', leafYn: 'N' } },
    })
    expect(tree[0]).toMatchObject({ id: '7', name: '도서' })
  })

  it('실패/엣지: depth/필드 누락 → 안전 기본값(unknown/미분류/depth1/leaf)', () => {
    const tree = mapElevenStCategories({
      'ns2:categorys': { 'ns2:category': { parentDispNo: '0' } },
    })
    expect(tree[0]).toMatchObject({ id: 'unknown', name: '미분류', depth: 1, leaf: true })
  })

  it('실패/엣지: 잘못된 depth(비숫자) → depth 1 로 fallback', () => {
    const tree = mapElevenStCategories({
      'ns2:categorys': { 'ns2:category': { dispNo: 'X', dispNm: 'Y', depth: 'abc', parentDispNo: '0', leafYn: 'N' } },
    })
    expect(tree[0]?.depth).toBe(1)
  })

  it('엣지: 부모가 목록에 없는 노드 → 루트로 승격(데이터 유실 방지)', () => {
    const tree = mapElevenStCategories({
      'ns2:categorys': {
        'ns2:category': [{ dispNo: '50', dispNm: '고아노드', depth: '3', parentDispNo: '999', leafYn: 'N' }],
      },
    })
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ id: '50', parentId: '999' })
  })
})

describe('buildElevenStCategoryTree — 트리 빌드 단위 (leafYn 힌트 vs 자식 유무)', () => {
  it('자식이 있으면 leafYn 힌트(Y=non-leaf) 와 무관하게 부모는 non-leaf', () => {
    const tree = buildElevenStCategoryTree([
      { id: 'p', name: '부모', depth: 1, parentId: null, leafHint: true }, // leafYn=N 힌트(leaf) 였더라도
      { id: 'c', name: '자식', depth: 2, parentId: 'p', leafHint: true },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]?.leaf).toBe(false) // 자식 발견 → 강제 non-leaf
    expect(tree[0]?.children[0]?.leaf).toBe(true)
  })

  it('leafHint undefined + 자식 없음 → 기본 leaf=true', () => {
    const tree = buildElevenStCategoryTree([
      { id: 'a', name: 'A', depth: 1, parentId: null, leafHint: undefined },
    ])
    expect(tree[0]?.leaf).toBe(true)
  })

  it('동일 id 중복 → 첫 항목 유지(dedupe)', () => {
    const tree = buildElevenStCategoryTree([
      { id: 'x', name: '첫번째', depth: 1, parentId: null, leafHint: true },
      { id: 'x', name: '중복', depth: 1, parentId: null, leafHint: false },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]?.name).toBe('첫번째')
  })

  it('self-parent(순환) 방어 → 루트로 처리', () => {
    const tree = buildElevenStCategoryTree([
      { id: 'self', name: '자기참조', depth: 1, parentId: 'self', leafHint: true },
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]?.id).toBe('self')
  })
})

describe('mapElevenStCategoryCertMeta — 1617 KC인증 메타 (PR-1)', () => {
  it('성공: certType/requiredYn 추출 (id 기준 맵)', () => {
    const meta = mapElevenStCategoryCertMeta({
      'ns2:categorys': {
        'ns2:category': [
          { dispNo: '1098', dispNm: '전기밥솥', depth: '3', parentDispNo: '1097', certType: '2', requiredYn: 'Y' },
          { dispNo: '1097', dispNm: '주방조리가전', depth: '2', parentDispNo: '1033' }, // 메타 없음 → 제외
        ],
      },
    })
    expect(meta['1098']).toEqual({ certType: '2', requiredYn: 'Y' })
    expect(meta['1097']).toBeUndefined()
  })

  it('엣지: 1001(메타 없는) 응답 → 빈 맵', () => {
    const meta = mapElevenStCategoryCertMeta({
      'ns2:categorys': {
        'ns2:category': { dispNo: '1', dispNm: 'A', depth: '1', parentDispNo: '0', leafYn: 'N' },
      },
    })
    expect(meta).toEqual({})
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

  it('ns2 cateservice XML(EUC-KR style) → DOMParser → mapElevenStCategories 트리 (Web 실경로)', () => {
    // 실제 11번가 응답은 ns2: prefix + 형제 반복. DOMParser 가 xmlns 미선언 prefix 를
    // tagName 에 그대로 남기는지 검증 + stripNsPrefix → 트리 빌드.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <ns2:categorys xmlns:ns2="http://www.11st.co.kr/cate">
        <ns2:category>
          <dispNo>1033</dispNo><dispNm>주방가전</dispNm><depth>1</depth><parentDispNo>0</parentDispNo><leafYn>Y</leafYn>
        </ns2:category>
        <ns2:category>
          <dispNo>1097</dispNo><dispNm>주방조리가전</dispNm><depth>2</depth><parentDispNo>1033</parentDispNo><leafYn>N</leafYn>
        </ns2:category>
      </ns2:categorys>`
    const tree = mapElevenStCategories(parse(xml))
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ id: '1033', parentId: null, leaf: false })
    expect(tree[0]?.children[0]).toMatchObject({ id: '1097', parentId: '1033', leaf: true })
  })
})
