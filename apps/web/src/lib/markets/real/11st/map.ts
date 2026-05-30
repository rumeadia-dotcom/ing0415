/**
 * 11번가 Open API — 순수 매핑/직렬화 로직 (프론트엔드 / Vite 환경).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (11번가 XML OpenAPI)
 *   - apps/api/supabase/functions/_shared/market-adapters/eleven-st-map.ts (Edge Function 측 원본 — 본 파일은 그 프론트엔드 포트)
 *
 * 본 파일은 **순수** 하다 (fetch / DOMParser / 네트워크 의존 0). 타입-only import 만 사용해
 * Vitest 가 직접 import 한다. XML 텍스트 → 객체 파싱(DOMParser) / EUC-KR 디코딩 / zod 검증 /
 * 네트워크는 index.ts (어댑터 본체) 가 담당한다.
 *
 * Edge Function 측은 fast-xml-parser 로 XML 을 객체화한다. 프론트엔드는 fast-xml-parser
 * 의존이 없으므로 index.ts 가 DOMParser 결과를 fast-xml-parser 호환 plain object 로 변환한
 * 뒤 본 파일 함수에 넘긴다 (xmlDocToObject — 동일 키/배열 형태). 따라서 매핑 로직은 양측 동일.
 *
 * 통합 검증 주의: apiCode / XML 엘리먼트 후보 / 주문 상태 코드는 11번가 셀러 Open API 공개
 *   규약 기반 상수다. 셀러 발급 키로 실호출 검증 시 본 파일만 조정하면 된다 (개발자포털은
 *   IP 화이트리스트로 사전 열람 제한).
 */

import type {
  CategoryNode,
  MarketMapping,
  MarketOrder,
  MarketOrderStatus,
  Product,
} from '@/lib/schemas'

export const MARKET = '11st' as const

/** 11번가 Open API base — 게이트웨이 화이트리스트 정합. */
export const ELEVEN_ST_API_BASE =
  'https://openapi.11st.co.kr/openapi/OpenApiService.tmall'

/** 셀러 API apiCode (통합 검증 시 조정 가능하도록 격리). */
export const ELEVEN_ST_API_CODES = {
  category: 'ProductCategoryInfo',
  productCreate: 'ProductRegister',
  orderList: 'GetOrderList',
  shipment: 'SendGoods',
} as const

/**
 * 11번가 실제 REST base (PR-0 — spec import #265, `features/11st.md` §4 / market-adapter.md §9.9).
 * ⚠️ 구 `ELEVEN_ST_API_BASE`(OpenApiService.tmall?apiCode=) 는 추정값 placeholder — 실제 11번가는
 * `apiCode` 개념이 없고 서비스별 REST path 를 쓴다. 호출부 재작성은 PR-1~5 이므로, PR-0 에선
 * 본 상수를 **additive** 로만 추가하고 구 상수는 유지(build-green). Edge `eleven-st-map.ts` 와 미러.
 */
export const ELEVEN_ST_REST_BASE = 'https://api.11st.co.kr/rest'

/** 서비스별 REST path (base 뒤에 붙음). path variable 은 호출부에서 조립(PR-1~5). */
export const ELEVEN_ST_REST_PATHS = {
  categoryAll: '/cateservice/category', // GET 1001 (전체)
  categorySub: '/cateservice/category', // GET 1617 — `${...}/{dispCtgrNo}`
  productCreate: '/prodservices/product', // POST 1003
  orderCompleteList: '/ordservices/complete', // GET 1876 — `/{startTime}/{endTime}`
  dispatch: '/ordservices/reqdelivery', // GET 1888 — `/{sendDt}/{dlvMthdCd}/{dlvEtprsCd}/{invcNo}/{dlvNo}`
  outboundAddrList: '/areaservice/outboundarea', // GET 1014
  outboundAddrOne: '/areaservice/getOutAddressInfo', // POST 1691 — `/{addrSeq}`
} as const

// ─────────────────────────────────────────────
// 공통 유틸 (순수)
// ─────────────────────────────────────────────

/** ISO 8601 + offset 정규화 (market-orders 와 동일 규칙, 로컬 복제). */
export function normalizeIsoOffset(raw: string | undefined): string {
  if (!raw) return '1970-01-01T00:00:00+00:00'
  if (/[+-]\d{2}:\d{2}$/.test(raw)) return raw
  if (raw.endsWith('Z')) return raw.replace(/Z$/, '+00:00')
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '1970-01-01T00:00:00+00:00'
  return d.toISOString().replace(/Z$/, '+00:00')
}

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 단순 평면 객체 → `<root>...</root>` XML (undefined/null 엘리먼트 생략). */
export function buildXml(root: string, fields: Record<string, unknown>): string {
  const inner = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('')
  return `<?xml version="1.0" encoding="EUC-KR"?><${root}>${inner}</${root}>`
}

function asArray(node: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) return node as Record<string, unknown>[]
  if (node && typeof node === 'object') return [node as Record<string, unknown>]
  return []
}

/**
 * XML 네임스페이스 prefix 제거 (PR-0). 11번가 REST 응답은 `ns2:categorys` / `ns2:order` /
 * `ns2:inOutAddress` 처럼 `ns{n}:` prefix 를 단다(spec import #265 — `features/11st.md` §4.3/§4.4).
 * fast-xml-parser(Edge) / DOMParser(Web) 모두 prefix 를 키에 그대로 남기므로, 파싱 결과 객체를
 * 재귀적으로 훑어 단일 선행 `prefix:` 를 제거한다. 매핑 로직(`pick`)이 prefix 없는 키만 보게 한다.
 * 순수 함수 — 입력 비변형(새 객체 반환). Edge `eleven-st-map.ts` 와 미러.
 */
export function stripNsPrefix(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripNsPrefix)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      // `ns2:categorys` → `categorys`. 선행 영숫자 prefix + 콜론 1개만 제거.
      const key = /^[A-Za-z][A-Za-z0-9]*:/.test(k) ? k.slice(k.indexOf(':') + 1) : k
      out[key] = stripNsPrefix(v)
    }
    return out
  }
  return node
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k]
  }
  return undefined
}

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'object') return ''
  return String(v).trim()
}

function intOr(v: unknown, fallback: number): number {
  const n = Number(str(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

/** ISO 8601 → 11번가 날짜 파라미터 (YYYYMMDDHHmmss, UTC). */
export function toElevenStDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  )
}

// ─────────────────────────────────────────────
// 카테고리 매핑
// ─────────────────────────────────────────────

export function mapElevenStCategories(
  parsed: Record<string, unknown>,
): CategoryNode[] {
  const container = pick(parsed, [
    'ProductCategorys',
    'Categorys',
    'Categories',
    'ProductCategoryInfo',
  ])
  let list: Record<string, unknown>[] = []
  if (container && typeof container === 'object') {
    const c = container as Record<string, unknown>
    list = asArray(pick(c, ['Category', 'category', 'ProductCategory']))
  } else {
    list = asArray(pick(parsed, ['Category', 'category']))
  }

  return list.map((c) => {
    const id = str(pick(c, ['CategoryCode', 'ctgrNo', 'dispCtgrNo', 'categoryCode']))
    const name = str(pick(c, ['CategoryName', 'ctgrNm', 'dispCtgrNm', 'categoryName']))
    const leafRaw = str(pick(c, ['IsLeaf', 'leafYn', 'lastCtgrYn']))
    const leaf = leafRaw === 'Y' || leafRaw === 'true' || leafRaw === '1'
    const node: CategoryNode = {
      id: id || 'unknown',
      name: name || '미분류',
      depth: 1,
      leaf,
      parentId: null,
      children: [],
    }
    return node
  })
}

// ─────────────────────────────────────────────
// 상품 등록 payload + 응답 매핑
// ─────────────────────────────────────────────

export function buildElevenStProductRaw(
  product: Product,
  mapping: MarketMapping,
): Record<string, unknown> {
  const name = product.name.length > 100 ? product.name.slice(0, 100) : product.name
  const images = mapping.transformedImageUrls
  const raw: Record<string, unknown> = {
    selPrdClfCd: '01',
    dispCtgrNo: mapping.categoryId,
    prdNm: name,
    selPrc: product.priceKrw,
    prdSelQty: product.stock,
    ...images.slice(0, 10).reduce<Record<string, string>>((acc, url, idx) => {
      acc[`prdImage${String(idx + 1).padStart(2, '0')}`] = url
      return acc
    }, {}),
    dlvCst: product.shippingFeeKrw,
    brand: product.brand ?? '',
    htmlDetail: product.descriptionHtml,
    ...mapping.extra,
  }
  return raw
}

export function buildElevenStProductXml(raw: Record<string, unknown>): string {
  return buildXml('Product', raw)
}

/** 상품 등록 응답에서 상품 번호 추출 (실패면 productNo='' — 호출측이 throw 판단). */
export function extractElevenStProductNo(parsed: Record<string, unknown>): {
  productNo: string
  resultCode: string
  resultText: string
} {
  const container =
    (pick(parsed, ['Product', 'ProductResponse', 'Result', 'result']) as
      | Record<string, unknown>
      | undefined) ?? parsed
  return {
    productNo: str(pick(container, ['ProductNo', 'prdNo', 'productNo', 'product_no'])),
    resultCode: str(pick(container, ['result_code', 'resultCode', 'ResultCode', 'code'])),
    resultText: str(pick(container, ['result_text', 'resultMessage', 'ResultText', 'message'])),
  }
}

// ─────────────────────────────────────────────
// 주문 상태 정규화 + 목록 매핑
// ─────────────────────────────────────────────

/** 11번가 주문상태(ordStat) → 정규화 enum. 숫자 코드 / 라벨 둘 다 대응. */
export function normalizeElevenStStatus(raw: string): MarketOrderStatus {
  const code = String(raw ?? '').trim()
  if (code === '101' || code === '102') return 'new_pay'
  if (code === '201' || code === '203') return 'dispatched'
  if (code === '202') return 'delivering'
  if (code === '301' || code === '302') return 'delivered'
  if (/^4\d{2}$/.test(code)) return 'cancelled'
  if (/^5\d{2}$/.test(code)) return 'returned'
  switch (code) {
    case '결제완료':
    case '배송대기':
    case '배송준비':
      return 'new_pay'
    case '발송처리':
    case '배송지시':
      return 'dispatched'
    case '배송중':
      return 'delivering'
    case '배송완료':
      return 'delivered'
    case '취소':
    case '취소완료':
      return 'cancelled'
    case '반품':
    case '반품완료':
      return 'returned'
    default:
      return 'unknown'
  }
}

/** 파싱된 XML 객체 → MarketOrder[] (zod 검증은 호출측 어댑터가 수행). */
export function mapElevenStOrders(parsed: Record<string, unknown>): MarketOrder[] {
  const container = pick(parsed, ['Orders', 'orders', 'OrderList']) as
    | Record<string, unknown>
    | undefined
  let list: Record<string, unknown>[] = []
  if (container && typeof container === 'object') {
    list = asArray(pick(container, ['Order', 'order']))
  } else {
    list = asArray(pick(parsed, ['Order', 'order']))
  }

  return list.map((o) => {
    const baseAddr = str(pick(o, ['RcvrBaseAddr', 'rcvrBaseAddr', 'rcvrMailAddr']))
    const dtlAddr = str(pick(o, ['RcvrDtlsAddr', 'rcvrDtlsAddr', 'rcvrDetailAddr']))
    const addr = [baseAddr, dtlAddr].filter((s) => s.length > 0).join(' ')
    const qty = intOr(pick(o, ['OrdQty', 'ordQty', 'orderQty']), 1)
    const amount = intOr(pick(o, ['OrdAmt', 'ordAmt', 'selPrc', 'orderAmt']), 0)
    const order: MarketOrder = {
      market: MARKET,
      externalOrderId: str(pick(o, ['OrdNo', 'ordNo', 'orderNo', 'ordPrdSeq'])) || 'unknown',
      buyerName: str(pick(o, ['OrdNm', 'ordNm', 'buyerNm', 'memNm'])) || '미상',
      receiverName: str(pick(o, ['RcvrNm', 'rcvrNm', 'receiverNm'])) || '미상',
      receiverAddress: addr.length > 0 ? addr : '주소 없음',
      receiverPhone:
        str(pick(o, ['RcvrPrtblNo', 'rcvrPrtblNo', 'rcvrMphnNo', 'rcvrTlphnNo'])) ||
        '연락처 없음',
      productName: str(pick(o, ['PrdNm', 'prdNm', 'productNm'])) || '상품명 없음',
      quantity: qty > 0 ? qty : 1,
      orderAmount: amount >= 0 ? amount : 0,
      status: normalizeElevenStStatus(
        str(pick(o, ['OrdStat', 'ordStat', 'orderStatus', 'shppgStatCd'])),
      ),
      paidAt: normalizeIsoOffset(str(pick(o, ['OrdDt', 'ordDt', 'payDt', 'PayDt'])) || undefined),
    }
    return order
  })
}

// ─────────────────────────────────────────────
// 발송 처리
// ─────────────────────────────────────────────

export function buildElevenStShipmentXml(input: {
  ordPrdSeq: string
  carrierCode: string
  invoiceNumber: string
}): string {
  return buildXml('SendGoods', {
    ordPrdSeq: input.ordPrdSeq,
    dlvEtprsCd: input.carrierCode,
    dlvNo: input.invoiceNumber,
  })
}

export function isElevenStShipmentOk(parsed: Record<string, unknown>): {
  ok: boolean
  code: string
  message: string
} {
  const container =
    (pick(parsed, ['Result', 'result', 'SendGoods', 'Delivery']) as
      | Record<string, unknown>
      | undefined) ?? parsed
  const code = str(pick(container, ['result_code', 'resultCode', 'code']))
  const message = str(pick(container, ['result_text', 'resultMessage', 'message']))
  const ok = code === '' || code === '200' || code === '0' || code === 'Success'
  return { ok, code, message }
}

// ─────────────────────────────────────────────
// DOM → plain object 변환 (fast-xml-parser 호환 형태)
//
// Edge Function 은 fast-xml-parser 로 XML 을 객체화한다. 프론트엔드는 DOMParser 로 파싱한
// Element 트리를 동일한 형태의 plain object 로 변환해 위 매핑 함수에 넘긴다. fast-xml-parser
// (ignoreAttributes:true, parseTagValue:true, trimValues:true) 와 동일하게:
//   - 자식 엘리먼트가 없는 leaf → 텍스트값 (가능하면 숫자로 파싱)
//   - 같은 이름의 형제 엘리먼트 2개 이상 → 배열
//   - 그 외 → 중첩 객체
//   - 속성(attribute) 은 무시
// 순수 함수이며 DOM 타입(Element)에만 의존 (jsdom 이 테스트에서 제공).
// ─────────────────────────────────────────────

/** leaf 텍스트값을 fast-xml-parser parseTagValue 규칙으로 파싱 (숫자면 number). */
function parseLeafValue(text: string): string | number {
  const trimmed = text.trim()
  if (trimmed === '') return ''
  // 선행 0 이 있는 숫자(주문번호/카테고리코드 등)는 문자열 유지 (fast-xml-parser 동일).
  if (/^-?\d+$/.test(trimmed) && !/^-?0\d/.test(trimmed)) {
    const n = Number(trimmed)
    if (Number.isSafeInteger(n)) return n
  }
  return trimmed
}

/** Element → fast-xml-parser 호환 값 (leaf=원시값, branch=객체). */
function elementToValue(el: Element): string | number | Record<string, unknown> {
  const childElements = Array.from(el.children)
  if (childElements.length === 0) {
    return parseLeafValue(el.textContent ?? '')
  }
  const obj: Record<string, unknown> = {}
  for (const child of childElements) {
    const key = child.tagName
    const value = elementToValue(child)
    if (key in obj) {
      const existing = obj[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        obj[key] = [existing, value]
      }
    } else {
      obj[key] = value
    }
  }
  return obj
}

/**
 * DOMParser 가 만든 XMLDocument → fast-xml-parser 호환 plain object.
 * 루트 엘리먼트 이름을 최상위 키로 둔다 (fast-xml-parser 동일: `<Orders>..` → `{ Orders: ... }`).
 */
export function xmlDocToObject(doc: Document): Record<string, unknown> {
  const root = doc.documentElement
  if (!root || root.nodeName === 'parsererror' || root.querySelector('parsererror')) {
    return {}
  }
  const value = elementToValue(root)
  if (typeof value === 'object') {
    return { [root.tagName]: value }
  }
  return { [root.tagName]: value }
}
