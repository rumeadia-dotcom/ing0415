import { describe, expect, it } from 'vitest'
import {
  ELEVEN_ST_API_BASE,
  ELEVEN_ST_API_CODES,
  ELEVEN_ST_REST_BASE,
  buildElevenStCategoryTree,
  buildElevenStCategoryUrl,
  buildElevenStProductRaw,
  buildElevenStProductXml,
  classifyElevenStCreateResult,
  escapeXml,
  mapElevenStCategories,
  mapElevenStCategoryCertMeta,
  mapElevenStOrders,
  normalizeElevenStOfficialNotice,
  normalizeElevenStStatus,
  stripNsPrefix,
  toElevenStDate,
  xmlDocToObject,
} from '../map'
import type { MarketMapping, Product } from '@/lib/schemas'
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

// ─────────────────────────────────────────────
// PR-3: transformProduct (buildElevenStProductRaw) — prodservices 1003 필수 20+ 필드
//   + Layer1 배송 인라인 + Layer2 addrSeq + KC인증 분기 + 이미지 truncate warning.
// ─────────────────────────────────────────────

function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    sellerId: '00000000-0000-4000-8000-000000000002',
    name: '테스트 상품',
    priceKrw: 12_345,
    stock: 5,
    images: [{ url: 'https://e.com/a.jpg', order: 0 }],
    descriptionHtml: '<p>상세</p>',
    shippingFeeKrw: 0,
    ...over,
  }
}
function makeMapping(over: Partial<MarketMapping> = {}): MarketMapping {
  return {
    market: '11st',
    categoryId: '1122',
    transformedImageUrls: ['https://e.com/a.jpg', 'https://e.com/b.jpg'],
    extra: {},
    ...over,
  }
}

describe('PR-3 buildElevenStProductRaw — 필수필드', () => {
  it('상수 필드 + 상품명 100자 컷 + 10원단위 + 이미지 prdImage01.. 매핑', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct({ name: 'x'.repeat(120) }),
      makeMapping(),
    )
    // 상수 필드 (spec 1003 — 고정가/일반배송/새상품/택배/업체배송).
    expect(fields.selMthdCd).toBe('01')
    expect(fields.prdTypCd).toBe('01')
    expect(fields.prdStatCd).toBe('01')
    expect(fields.dlvWyCd).toBe('01')
    expect(fields.dlvClf).toBe('02')
    expect(fields.minorSelCnYn).toBe('Y')
    expect(fields.suplDtyfrPrdClfCd).toBe('01')
    expect(fields.rmaterialTypCd).toBe('04')
    expect(fields.orgnTypCd).toBe('03')
    // 카테고리/상품명/가격/재고.
    expect(fields.dispCtgrNo).toBe('1122')
    expect(String(fields.prdNm)).toHaveLength(100)
    expect(fields.selPrc).toBe(12_340) // 10원 단위 내림
    expect(fields.prdSelQty).toBe(5)
    // 이미지.
    expect(fields.prdImage01).toBe('https://e.com/a.jpg')
    expect(fields.prdImage02).toBe('https://e.com/b.jpg')
    // 공백 불가 안내 + 원산지명 기본값.
    expect(String(fields.asDetail).length).toBeGreaterThan(0)
    expect(String(fields.rtngExchDetail).length).toBeGreaterThan(0)
    expect(String(fields.orgnNmVal).length).toBeGreaterThan(0)
  })

  it('brand 미지정 → "알수없음", htmlDetail 공백 → 기본값', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct({ brand: undefined, descriptionHtml: '' }),
      makeMapping(),
    )
    expect(fields.brand).toBe('알수없음')
    expect(String(fields.htmlDetail).length).toBeGreaterThan(0)
  })

  it('FAIL 케이스 — prdNm 입력불가 특수문자([&%<>#†])는 공백 처리', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct({ name: 'A&B[C]<D>#E' }),
      makeMapping(),
    )
    expect(String(fields.prdNm)).not.toMatch(/[[\]&%<>#†]/)
  })

  it('구 placeholder 오용 제거 — selPrdClfCd / dlvCst 단일 미존재', () => {
    const { fields } = buildElevenStProductRaw(makeProduct(), makeMapping())
    expect(fields.selPrdClfCd).toBeUndefined()
    expect(fields.dlvCst).toBeUndefined()
  })
})

describe('PR-3 Layer1 배송 인라인 매핑 (shipping-fee-model)', () => {
  it('fee 0 → dlvCstInstBasiCd 01(무료), dlvCst1 미부착', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct({ shippingFeeKrw: 0 }),
      makeMapping(),
    )
    expect(fields.dlvCstInstBasiCd).toBe('01')
    expect(fields.dlvCst1).toBeUndefined()
    expect(fields.bndlDlvCnYn).toBe('N')
    expect(fields.jejuDlvCst).toBe(0)
    expect(fields.islandDlvCst).toBe(0)
    expect(fields.rtngdDlvCst).toBe(0)
    expect(fields.exchDlvCst).toBe(0)
  })

  it('fee>0 → dlvCstInstBasiCd 02(고정) + dlvCst1(10원단위)', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct({ shippingFeeKrw: 2_503 }),
      makeMapping(),
    )
    expect(fields.dlvCstInstBasiCd).toBe('02')
    expect(fields.dlvCst1).toBe(2_500)
  })

  it('extra.shipping.freeThreshold → 03(조건부무료) + PrdFrDlvBasiAmt + 반품/교환/도서산간', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct({ shippingFeeKrw: 3_000 }),
      makeMapping({
        extra: {
          shipping: {
            baseFee: 3_000,
            freeThreshold: 50_000,
            returnFee: 2_500,
            exchangeFee: 5_000,
            jejuFee: 3_000,
            islandFee: 5_000,
            bundleAllowed: true,
          },
        },
      }),
    )
    expect(fields.dlvCstInstBasiCd).toBe('03')
    expect(fields.dlvCst1).toBe(3_000)
    expect(fields.PrdFrDlvBasiAmt).toBe(50_000)
    expect(fields.rtngdDlvCst).toBe(2_500)
    expect(fields.exchDlvCst).toBe(5_000)
    expect(fields.jejuDlvCst).toBe(3_000)
    expect(fields.islandDlvCst).toBe(5_000)
    expect(fields.bndlDlvCnYn).toBe('Y')
  })
})

describe('PR-3 Layer2 addrSeq 주입 (출고지/반품지 조회형 select)', () => {
  it('extra.outboundAddrSeq/returnAddrSeq → addrSeqOut/addrSeqIn', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct(),
      makeMapping({ extra: { outboundAddrSeq: '4', returnAddrSeq: '8' } }),
    )
    expect(fields.addrSeqOut).toBe('4')
    expect(fields.addrSeqIn).toBe('8')
  })

  it('FAIL/엣지 — addrSeq 미선택 시 미주입(11번가 기본주소 자동설정)', () => {
    const { fields } = buildElevenStProductRaw(makeProduct(), makeMapping({ extra: {} }))
    expect(fields.addrSeqOut).toBeUndefined()
    expect(fields.addrSeqIn).toBeUndefined()
  })
})

describe('PR-3 KC인증 분기 (category-1617 requiredYn)', () => {
  it('requiredYn 미지정/N → ProductCertGroup 생략', () => {
    const a = buildElevenStProductRaw(makeProduct(), makeMapping())
    expect(a.fields.ProductCertGroup).toBeUndefined()
    const b = buildElevenStProductRaw(makeProduct(), makeMapping(), 'N')
    expect(b.fields.ProductCertGroup).toBeUndefined()
  })

  it('requiredYn=Y + 셀러 미입력 → "해당없음(131)" 최소 인증그룹 통과', () => {
    const { fields } = buildElevenStProductRaw(makeProduct(), makeMapping(), 'Y')
    const grp = fields.ProductCertGroup as Record<string, unknown>
    expect(grp).toBeTruthy()
    expect(grp.crtfGrpObjClfCd).toBe('03')
    expect((grp.ProductCert as Record<string, unknown>).certTypeCd).toBe('131')
  })

  it('requiredYn=Y + 셀러 입력(extra.cert) → 입력값 우선 + ProductCert 배열', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct(),
      makeMapping({
        extra: {
          cert: {
            crtfGrpTypCd: '01',
            crtfGrpObjClfCd: '01',
            certs: [{ certTypeCd: '101', certKey: 'SAFE-12345' }],
          },
        },
      }),
      'Y',
    )
    const grp = fields.ProductCertGroup as Record<string, unknown>
    expect(grp.crtfGrpTypCd).toBe('01')
    expect(grp.crtfGrpObjClfCd).toBe('01')
    expect(grp.ProductCert).toEqual([{ certTypeCd: '101', certKey: 'SAFE-12345' }])
  })

  it('extra.certRequiredYn=Y(오케스트레이터 주입) → 인자 없이도 인증그룹 부착', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct(),
      makeMapping({ extra: { certRequiredYn: 'Y' } }),
    )
    expect(fields.ProductCertGroup).toBeTruthy()
  })
})

describe('PR-3 이미지 truncate warning (13장↑ 무음 드롭)', () => {
  it('이미지 13장 → prdImage12 까지만 + images_truncated warning', () => {
    const urls = Array.from({ length: 13 }, (_, i) => `https://e.com/${i}.jpg`)
    const { fields, warnings } = buildElevenStProductRaw(
      makeProduct(),
      makeMapping({ transformedImageUrls: urls }),
    )
    expect(fields.prdImage12).toBe('https://e.com/11.jpg')
    expect(fields.prdImage13).toBeUndefined()
    expect(warnings.some((w) => w.code === 'images_truncated')).toBe(true)
  })

  it('이미지 12장 이하 → warning 없음', () => {
    const urls = Array.from({ length: 12 }, (_, i) => `https://e.com/${i}.jpg`)
    const { warnings } = buildElevenStProductRaw(
      makeProduct(),
      makeMapping({ transformedImageUrls: urls }),
    )
    expect(warnings).toEqual([])
  })

})

describe('PR-4 officialNotice(ProductNotification) 주입 + 정규화', () => {
  it('extra.officialNotice 없으면 ProductNotification 미부착', () => {
    const without = buildElevenStProductRaw(makeProduct(), makeMapping())
    expect(without.fields.ProductNotification).toBeUndefined()
  })

  it('이미 11번가 형태({type,item})면 그대로 통과 (PR-3 슬롯 호환)', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct(),
      makeMapping({
        extra: { officialNotice: { type: '891011', item: [{ code: '1', name: '면' }] } },
      }),
    )
    expect(fields.ProductNotification).toEqual({
      type: '891011',
      item: [{ code: '1', name: '면' }],
    })
  })

  it('UI generic 형태({officialNoticeNo, details}) → {type, item:[{code,name}]} 변환 후 주입', () => {
    const { fields } = buildElevenStProductRaw(
      makeProduct(),
      makeMapping({
        extra: {
          officialNotice: {
            officialNoticeNo: '891011',
            details: [
              { code: '23759468', value: '나일론' },
              { code: '23759469', value: '대한민국' },
            ],
          },
        },
      }),
    )
    expect(fields.ProductNotification).toEqual({
      type: '891011',
      item: [
        { code: '23759468', name: '나일론' },
        { code: '23759469', name: '대한민국' },
      ],
    })
  })
})

describe('PR-4 normalizeElevenStOfficialNotice — 순수 정규화 (양측 입력)', () => {
  it('UI generic 변환 — officialNoticeNo→type, details(value)→item(name)', () => {
    expect(
      normalizeElevenStOfficialNotice({
        officialNoticeNo: '700001',
        details: [{ code: 'C1', value: 'V1' }],
      }),
    ).toEqual({ type: '700001', item: [{ code: 'C1', name: 'V1' }] })
  })

  it('11번가 형태 passthrough', () => {
    expect(
      normalizeElevenStOfficialNotice({ type: '700001', item: [{ code: 'C1', name: 'V1' }] }),
    ).toEqual({ type: '700001', item: [{ code: 'C1', name: 'V1' }] })
  })

  it('free-form 군(마스터 밖 type) 도 입력값 그대로 직렬화 (코드 날조 없음)', () => {
    expect(
      normalizeElevenStOfficialNotice({
        officialNoticeNo: '999999',
        details: [{ code: 'X', value: 'Y' }],
      }),
    ).toEqual({ type: '999999', item: [{ code: 'X', name: 'Y' }] })
  })

  it('fail: type/officialNoticeNo 비어있으면 undefined', () => {
    expect(
      normalizeElevenStOfficialNotice({ officialNoticeNo: '', details: [{ code: 'C', value: 'V' }] }),
    ).toBeUndefined()
  })

  it('fail: item/details 가 비어있거나 code/value 공백이면 undefined', () => {
    expect(
      normalizeElevenStOfficialNotice({ officialNoticeNo: '1', details: [] }),
    ).toBeUndefined()
    expect(
      normalizeElevenStOfficialNotice({ officialNoticeNo: '1', details: [{ code: '', value: '' }] }),
    ).toBeUndefined()
  })

  it('fail: 객체 아님 / null → undefined', () => {
    expect(normalizeElevenStOfficialNotice(undefined)).toBeUndefined()
    expect(normalizeElevenStOfficialNotice(null)).toBeUndefined()
    expect(normalizeElevenStOfficialNotice('x')).toBeUndefined()
    expect(normalizeElevenStOfficialNotice([])).toBeUndefined()
  })
})

describe('PR-3 buildElevenStProductXml — 중첩 직렬화 + escape', () => {
  it('XML 특수문자 escape + <Product> root', () => {
    const xml = buildElevenStProductXml({ prdNm: 'A & <B> "C"' })
    expect(xml).toContain('<prdNm>A &amp; &lt;B&gt; &quot;C&quot;</prdNm>')
    expect(xml).toContain('<Product>')
    expect(xml).toContain('<?xml version="1.0" encoding="EUC-KR"?>')
  })

  it('중첩 객체(ProductCertGroup) + 배열(ProductCert) 직렬화', () => {
    const xml = buildElevenStProductXml({
      ProductCertGroup: {
        crtfGrpObjClfCd: '03',
        ProductCert: [
          { certTypeCd: '131', certKey: '' },
          { certTypeCd: '101', certKey: 'K1' },
        ],
      },
    })
    expect(xml).toContain('<ProductCertGroup><crtfGrpObjClfCd>03</crtfGrpObjClfCd>')
    // 배열 → 같은 태그 반복.
    expect(xml.match(/<ProductCert>/g)?.length).toBe(2)
    expect(xml).toContain('<certTypeCd>131</certTypeCd>')
  })

  it('escapeXml 단위', () => {
    expect(escapeXml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;')
  })
})

describe('PR-3 classifyElevenStCreateResult — ClientMessage 응답 분류', () => {
  it('200(일반성공) + productNo → success', () => {
    const r = classifyElevenStCreateResult({
      ClientMessage: { resultCode: '200', productNo: '52844137', message: '정상' },
    })
    expect(r.kind).toBe('success')
    if (r.kind === 'success') expect(r.productNo).toBe('52844137')
  })

  it('210(신규성공) + productNo → success', () => {
    const r = classifyElevenStCreateResult({
      ClientMessage: { resultCode: '210', productNo: '999', message: '신규성공' },
    })
    expect(r.kind).toBe('success')
  })

  it('400(일 500개 한도) → rejected', () => {
    const r = classifyElevenStCreateResult({
      ClientMessage: { resultCode: '400', message: '상품 등록은 1일 500개 까지만 가능합니다.' },
    })
    expect(r.kind).toBe('rejected')
    if (r.kind === 'rejected') expect(r.resultCode).toBe('400')
  })

  it('500(검증 실패) → rejected + 메시지 보존', () => {
    const r = classifyElevenStCreateResult({
      ClientMessage: { resultCode: '500', message: '교환반품 안내는 반드시 입력하셔야 합니다.' },
    })
    expect(r.kind).toBe('rejected')
    if (r.kind === 'rejected') expect(r.message).toContain('교환반품')
  })

  it('FAIL/엣지 — resultCode 200 이지만 productNo 누락 → rejected (보수적)', () => {
    const r = classifyElevenStCreateResult({ ClientMessage: { resultCode: '200', message: 'x' } })
    expect(r.kind).toBe('rejected')
  })
})

// 발송처리 분류(classifyElevenStDispatchResult) 단위 테스트는 PR-5 전용
// eleven-st-orders.test.ts 로 분리. 여기선 status 정규화 헬퍼만 회귀 유지.

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

  it('중첩 + 형제 반복 → 배열, leaf 숫자 파싱 → mapElevenStOrders 호환 (orders/order)', () => {
    const xml = `<?xml version="1.0" encoding="EUC-KR"?>
      <orders>
        <order>
          <ordNo>A100</ordNo>
          <dlvNo>111</dlvNo>
          <ordQty>2</ordQty>
          <ordAmt>25000</ordAmt>
        </order>
        <order>
          <ordNo>B200</ordNo>
          <dlvNo>222</dlvNo>
        </order>
      </orders>`
    const obj = parse(xml)
    const orders = mapElevenStOrders(obj)
    expect(orders.map((o) => o.externalOrderId)).toEqual(['A100', 'B200'])
    expect(orders.map((o) => o.extra?.dlvNo)).toEqual(['111', '222'])
    expect(orders.map((o) => o.status)).toEqual(['new_pay', 'new_pay'])
    expect(orders[0]?.quantity).toBe(2)
    expect(orders[0]?.orderAmount).toBe(25000)
  })

  it('단일 order 엘리먼트 → 객체 (배열 아님), mapElevenStOrders 1건', () => {
    const xml = `<orders><order><ordNo>SOLO</ordNo><dlvNo>999</dlvNo></order></orders>`
    const orders = mapElevenStOrders(parse(xml))
    expect(orders).toHaveLength(1)
    expect(orders[0]?.externalOrderId).toBe('SOLO')
    expect(orders[0]?.status).toBe('new_pay')
    expect(orders[0]?.extra?.dlvNo).toBe('999')
  })

  it('상품 등록 응답 XML(ClientMessage) → classifyElevenStCreateResult 성공', () => {
    const xml = `<ClientMessage><resultCode>200</resultCode><productNo>987654</productNo><message>정상</message></ClientMessage>`
    const r = classifyElevenStCreateResult(parse(xml))
    expect(r.kind).toBe('success')
    if (r.kind === 'success') {
      expect(r.productNo).toBe('987654')
      expect(r.resultCode).toBe('200')
    }
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
