/**
 * 11번가 Open API — 순수 매핑/직렬화 로직 (npm/Deno specifier 없음 → Vitest 직접 테스트 가능).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (11번가 XML OpenAPI)
 *   - eleven-st.ts (Deno 어댑터 본체 — fetch/XML파싱/zod 검증 담당)
 *
 * 본 파일은 타입-only import 만 사용한다 (런타임 의존 0). XML 파싱(fast-xml-parser) /
 * CP949 디코딩 / zod 검증 / 네트워크는 eleven-st.ts (Deno) 가 담당.
 *
 * 통합 검증 주의: apiCode / XML 엘리먼트 후보 / 주문 상태 코드는 11번가 셀러 Open API 공개
 *   규약 기반 상수다. 셀러 발급 키로 실호출 검증 시 본 파일만 조정하면 된다 (개발자포털은
 *   IP 화이트리스트로 사전 열람 제한).
 */

import type { CategoryNode, MarketMapping, Product } from '../schemas.ts'
import type { MarketOrder, MarketOrderStatus } from '../market-orders.ts'

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

// ─────────────────────────────────────────────
// 공통 유틸 (순수)
// ─────────────────────────────────────────────

/** ISO 8601 + offset 정규화 (market-orders.ts 와 동일 규칙, npm 의존 회피용 로컬 복제). */
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
