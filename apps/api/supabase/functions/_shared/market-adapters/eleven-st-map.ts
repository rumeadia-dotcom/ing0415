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

/**
 * 11번가 실제 REST base (PR-0 — spec import #265, `features/11st.md` §4 / market-adapter.md §9.9).
 * ⚠️ 구 `ELEVEN_ST_API_BASE`(OpenApiService.tmall?apiCode=) 는 추정값 placeholder — 실제 11번가는
 * `apiCode` 개념이 없고 서비스별 REST path 를 쓴다. 호출부(fetchCategoryTree/createProduct 등)
 * 재작성은 PR-1~5 이므로, PR-0 에선 본 상수를 **additive** 로만 추가하고 구 상수는 유지(build-green).
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
  inboundAddrList: '/areaservice/inboundarea', // GET 1015 (반품/교환지 목록)
} as const

/**
 * 출고지(1014)/반품지(1015) 조회 절대 URL 조립 (PR-2). API Key 는 `openapikey` 헤더로만 — querystring 없음.
 * 순수 함수 — Edge(eleven-st-shipping-list) 가 게이트웨이로 보낸다.
 */
export function buildElevenStOutboundAreaUrl(): string {
  return `${ELEVEN_ST_REST_BASE}${ELEVEN_ST_REST_PATHS.outboundAddrList}`
}
export function buildElevenStInboundAreaUrl(): string {
  return `${ELEVEN_ST_REST_BASE}${ELEVEN_ST_REST_PATHS.inboundAddrList}`
}

/**
 * 카테고리 조회 REST URL 조립 (PR-1). API Key 불필요(GET) — querystring 없음.
 *   - dispCtgrNo 없음 → 1001 전체 카테고리 (`/cateservice/category`).
 *   - dispCtgrNo 지정 → 1617 하위 카테고리 (`/cateservice/category/{dispCtgrNo}`).
 * 순수 함수 — Web(DOMParser)·Edge(fast-xml-parser) 양쪽이 동일 URL 을 게이트웨이로 보낸다.
 */
export function buildElevenStCategoryUrl(dispCtgrNo?: string): string {
  const sub = dispCtgrNo && dispCtgrNo.trim() !== '' ? `/${encodeURIComponent(dispCtgrNo.trim())}` : ''
  return `${ELEVEN_ST_REST_BASE}${ELEVEN_ST_REST_PATHS.categoryAll}${sub}`
}

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

/**
 * XML 네임스페이스 prefix 제거 (PR-0). 11번가 REST 응답은 `ns2:categorys` / `ns2:order` /
 * `ns2:inOutAddress` 처럼 `ns{n}:` prefix 를 단다(spec import #265 — `features/11st.md` §4.3/§4.4).
 * fast-xml-parser(Edge) / DOMParser(Web) 모두 prefix 를 키에 그대로 남기므로, 파싱 결과 객체를
 * 재귀적으로 훑어 단일 선행 `prefix:` 를 제거한다. 매핑 로직(`pick`)이 prefix 없는 키만 보게 한다.
 * 순수 함수 — 입력 비변형(새 객체 반환).
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

/**
 * ISO 8601 → 11번가 주문/발송 path variable (PR-5).
 * spec(paid-1876 / dispatch-1888)은 **12자리 `YYYYMMDDhhmm`** (초 없음, UTC).
 * `toElevenStDate`(14자리 GetOrderList 잔재)와 별개 — ordservices 계열 path 전용.
 */
export function toElevenStOrderDate(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
  )
}

// ─────────────────────────────────────────────
// 택배사 코드 매핑 (PR-5, §8-3)
//   내부 CarrierCode(enum) → 11번가 dlvEtprsCd. 출처: dispatch-1888.md path variable enum.
//   ⚠️ cross-market 공통 `_shared/carrier-codes.ts` 단일화는 PR-6 — 본 PR 은 11번가 어댑터
//   내부 맵으로 구현하되, PR-6 추출이 쉽도록 한 곳(본 상수)에 모아둔다.
//   v1 내부 enum(TRACKING_CARRIER_CODES)은 'LOGEN' 단일이나, 주요 택배사를 미리 매핑한다.
// ─────────────────────────────────────────────
export const ELEVEN_ST_CARRIER_CODES = {
  LOGEN: '00002', // 로젠택배 (v1 내부 enum)
  CJ: '00034', // CJ대한통운
  HANJIN: '00011', // 한진택배
  LOTTE: '00012', // 롯데(현대)택배
  EPOST: '00007', // 우체국택배/등기
  HABDONG: '00035', // 합동택배
  KYUNGDONG: '00026', // 경동택배
  DAESIN: '00021', // 대신택배
  CHUNIL: '00027', // 천일택배
  ETC: '00099', // 기타
} as const
export type ElevenStCarrierKey = keyof typeof ELEVEN_ST_CARRIER_CODES

/**
 * 내부 carrierCode → 11번가 dlvEtprsCd. 미매핑이면 undefined 반환
 * (호출측 어댑터가 '택배사 코드 미지원' validation 처리). 순수 함수.
 */
export function toElevenStCarrierCode(carrierCode: string): string | undefined {
  const key = carrierCode.toUpperCase() as ElevenStCarrierKey
  return ELEVEN_ST_CARRIER_CODES[key]
}

// ─────────────────────────────────────────────
// REST path 빌더 (PR-5) — ordservices 계열 path variable 조립
// ─────────────────────────────────────────────

/** 주문조회 path — `/ordservices/complete/{startTime}/{endTime}` (1876, 12자리). */
export function buildElevenStOrderListPath(startTime: string, endTime: string): string {
  return `${ELEVEN_ST_REST_PATHS.orderCompleteList}/${startTime}/${endTime}`
}

/**
 * 발송처리 path — `/ordservices/reqdelivery/{sendDt}/{dlvMthdCd}/{dlvEtprsCd}/{invcNo}/{dlvNo}` (1888).
 * dlvMthdCd 는 01(택배) 고정 (v1 범위 — 택배 발송만). body 없음.
 */
export function buildElevenStDispatchPath(input: {
  sendDt: string
  dlvEtprsCd: string
  invcNo: string
  dlvNo: string
}): string {
  const { sendDt, dlvEtprsCd, invcNo, dlvNo } = input
  return `${ELEVEN_ST_REST_PATHS.dispatch}/${sendDt}/01/${dlvEtprsCd}/${invcNo}/${dlvNo}`
}

// ─────────────────────────────────────────────
// 카테고리 매핑 (PR-1 재작성 — cateservice 1001/1617, ns2, parentDispNo 트리)
//
// 구 placeholder(`?apiCode=ProductCategoryInfo` → `ProductCategorys>Category>CategoryCode/IsLeaf`)
// 를 제거하고 spec(`category-1001.md`/`category-1617.md`) 의 `ns2:categorys > ns2:category[]`
// 응답을 파싱한다. 필드 매핑(11st.md §4.3): dispNo→id / dispNm→name / depth→depth /
//   parentDispNo→parentId(0→null) / leafYn→leaf.
//
// ⚠️ leafYn 의미(spec category-1001): "Y=하위 카테고리(가 존재) / N=하위 카테고리가 아님(=말단)".
//   즉 leafYn='N' 이 말단(leaf) 이다. 따라서 leaf = (leafYn === 'N').
//   응답에 leafYn 이 없으면(1617 등) 트리상 자식 유무로 보정(부모면 non-leaf).
// ─────────────────────────────────────────────

/** 카테고리 노드의 KC인증 메타(1617 의 certType/requiredYn). CategoryNode 엔 안 들어가는
 *  UI 힌트/PR-3 검증용 — id 기준 별도 맵으로 보존(트리와 분리). */
export interface ElevenStCategoryCertMeta {
  /** 인증유형 (1=식품관련, 2=생활/어린이/전기용품관련). 없으면 undefined. */
  certType?: string
  /** 인증필수여부 (Y/N). */
  requiredYn?: 'Y' | 'N'
}

/** parentId 기반 트리 빌드 입력 (내부 중간 표현). */
export interface FlatElevenStCategory {
  id: string
  name: string
  depth: number
  parentId: string | null
  /** leafYn 힌트 — true=말단, false=부모, undefined=미지(자식 유무로 보정). */
  leafHint: boolean | undefined
}

/** ns2 제거 후 응답에서 category 평탄 배열을 추출 (1001 전체 / 1617 하위 공통). */
function extractElevenStCategoryList(
  parsed: Record<string, unknown>,
): Record<string, unknown>[] {
  const stripped = stripNsPrefix(parsed) as Record<string, unknown>
  const container = pick(stripped, ['categorys', 'categories']) as
    | Record<string, unknown>
    | undefined
  if (container && typeof container === 'object') {
    return asArray(pick(container, ['category']))
  }
  return asArray(pick(stripped, ['category']))
}

/** spec leafYn → leaf(boolean). 'N'=말단. 누락 시 undefined (트리 빌드가 자식 유무로 보정). */
function parseLeafYn(raw: string): boolean | undefined {
  if (raw === 'N') return true
  if (raw === 'Y') return false
  return undefined
}

function toFlatElevenStCategory(c: Record<string, unknown>): FlatElevenStCategory {
  const id = str(pick(c, ['dispNo']))
  const name = str(pick(c, ['dispNm']))
  const depth = intOr(pick(c, ['depth']), 1)
  const parentRaw = str(pick(c, ['parentDispNo']))
  // parentDispNo '0'/'' = 최상위 → null.
  const parentId = parentRaw === '' || parentRaw === '0' ? null : parentRaw
  return {
    id: id || 'unknown',
    name: name || '미분류',
    depth: depth >= 1 ? depth : 1,
    parentId,
    leafHint: parseLeafYn(str(pick(c, ['leafYn']))),
  }
}

/**
 * 평탄 카테고리 목록 → parentId 기반 트리(`CategoryNode[]`). 순수 함수.
 *   - parentId=null 또는 부모가 목록에 없으면 루트.
 *   - leaf = leafYn 힌트 우선, 없으면 자식 유무(자식 있으면 non-leaf, 기본 leaf).
 *   - 자식이 발견되면 부모는 무조건 non-leaf 로 보정(leafYn 힌트보다 트리 구조 우선).
 *   - 동일 id 중복(1617 가 조회 기준 노드 포함) → 첫 항목 유지(dedupe).
 *   - 누락 parent 안전: 미연결 노드는 루트로 승격(데이터 유실 방지).
 */
export function buildElevenStCategoryTree(
  flat: FlatElevenStCategory[],
): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>()
  for (const f of flat) {
    if (!nodes.has(f.id)) {
      nodes.set(f.id, {
        id: f.id,
        name: f.name,
        depth: f.depth,
        leaf: f.leafHint ?? true, // 기본 leaf, 자식 발견 시 false 로 보정.
        parentId: f.parentId,
        children: [],
      })
    }
  }
  const roots: CategoryNode[] = []
  for (const node of nodes.values()) {
    const parent =
      node.parentId !== null && node.parentId !== node.id
        ? nodes.get(node.parentId)
        : undefined
    if (parent) {
      parent.children.push(node)
      parent.leaf = false // 자식 보유 → 부모는 말단 아님(트리 구조 우선).
    } else {
      roots.push(node)
    }
  }
  return roots
}

/**
 * 파싱된 cateservice 응답 → CategoryNode 트리(11st.md §4.3).
 * ns2 제거 + dispNo/dispNm/depth/parentDispNo/leafYn 매핑 + parentDispNo 트리 빌드.
 * (구 depth:1 평탄화 → 정정.)
 */
export function mapElevenStCategories(
  parsed: Record<string, unknown>,
): CategoryNode[] {
  const list = extractElevenStCategoryList(parsed)
  const flat = list.map(toFlatElevenStCategory)
  return buildElevenStCategoryTree(flat)
}

/**
 * 1617(하위) 응답의 KC인증 메타 추출 → `{ [dispNo]: { certType, requiredYn } }`.
 * 상품등록(PR-3) 의 ProductCertGroup 필수여부 검증·UI 힌트에 사용. 1001 응답엔 없음(빈 맵).
 */
export function mapElevenStCategoryCertMeta(
  parsed: Record<string, unknown>,
): Record<string, ElevenStCategoryCertMeta> {
  const out: Record<string, ElevenStCategoryCertMeta> = {}
  for (const c of extractElevenStCategoryList(parsed)) {
    const id = str(pick(c, ['dispNo']))
    if (!id) continue
    const certType = str(pick(c, ['certType']))
    const requiredRaw = str(pick(c, ['requiredYn']))
    const meta: ElevenStCategoryCertMeta = {}
    if (certType) meta.certType = certType
    if (requiredRaw === 'Y' || requiredRaw === 'N') meta.requiredYn = requiredRaw
    if (meta.certType !== undefined || meta.requiredYn !== undefined) {
      out[id] = meta
    }
  }
  return out
}

// ─────────────────────────────────────────────
// 상품 등록 payload + 응답 매핑 (PR-3 재작성 — prodservices 1003, ClientMessage 응답)
//
// 구 placeholder(`selPrdClfCd:'01'`(실제 판매기간코드)·`dlvCst`(존재 안 함) 등) 를 제거하고
// spec(product-manage-1003.md) 의 `<Product>` 필수 20+ 필드를 채운다(11st.md §4.1).
//   - 상수 필드(selMthdCd 01 / prdTypCd 01 / prdStatCd 01 / dlvWyCd 01 / dlvClf 02 …)
//   - Layer 1 배송 인라인(dlvCstInstBasiCd + dlvCst1/PrdFrDlvBasiAmt + jeju/island/rtngd/exch)
//   - Layer 2 출고지/반품지(addrSeqOut/addrSeqIn ← mapping.extra.{outboundAddrSeq,returnAddrSeq})
//   - KC인증(ProductCertGroup) — 카테고리 requiredYn=Y 시 필수(없으면 해당없음 코드)
//   - officialNotice(ProductNotification) 는 PR-4 — 본 PR 은 주입 자리만(extra.officialNotice 있으면 통과)
//   - 옵션(ProductOption)은 v1 단일상품 범위 밖(단일 재고/가격).
// 본 파일은 Web map.ts 의 미러 (동일 코드 — parity).
// ─────────────────────────────────────────────

/** 상품등록 상수 필드 (spec 1003 — 고정가/일반배송/새상품/택배/업체배송). */
const ELEVEN_ST_PRODUCT_CONSTANTS = {
  selMthdCd: '01', // 판매방식 = 고정가판매
  prdTypCd: '01', // 서비스 상품 코드 = 일반배송상품
  prdStatCd: '01', // 상품상태 = 새상품
  minorSelCnYn: 'Y', // 미성년자 구매가능
  suplDtyfrPrdClfCd: '01', // 부가세 = 과세상품(기본)
  rmaterialTypCd: '04', // 원재료유형 = 원산지 의무표시대상 아님(기본)
  orgnTypCd: '03', // 원산지 = 기타(+ orgnNmVal)
  dlvCnAreaCd: '01', // 배송가능지역 = 전국
  dlvWyCd: '01', // 배송방법 = 택배
  dlvClf: '02', // 배송주체 = 업체배송(셀러)
  dlvCstPayTypCd: '01', // 결제방법 = 선결제/착불 가능
} as const

/** 공백 불가 필드 기본값 (spec: A/S·반품교환 안내는 최소 '.' 이라도 필수). */
const ELEVEN_ST_DEFAULT_AS_DETAIL = '상품 상세설명을 참고해주세요.'
const ELEVEN_ST_DEFAULT_RTNG_EXCH_DETAIL = '상품 상세설명을 참고해주세요.'
/** 원산지 기타(03) 시 필수 원산지명 기본값. */
const ELEVEN_ST_DEFAULT_ORGN_NM = '상세설명 참조'
/** brand 미지정 시 spec 권장값. */
const ELEVEN_ST_DEFAULT_BRAND = '알수없음'

/** 11번가 prdNm 입력 불가 특수문자(spec: 자동 공백 처리) — 사전 정리. */
function sanitizeElevenStProductName(name: string): string {
  const cleaned = name.replace(/[[\]&%<>#†]/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.length > 100 ? cleaned.slice(0, 100) : cleaned
}

/** 10원 단위 내림 (spec: 판매가/배송비는 10원 단위). */
function floorTo10(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n / 10) * 10
}

/**
 * Layer 1 배송 인라인 매핑 (shipping-fee-model.md Layer1 표 — 11번가 열).
 * v1 은 product.shippingFeeKrw + (선택) mapping.extra.shipping 의도값으로 매핑한다.
 */
interface ElevenStShippingIntent {
  baseFee?: number | undefined
  freeThreshold?: number | undefined
  returnFee?: number | undefined
  exchangeFee?: number | undefined
  jejuFee?: number | undefined
  islandFee?: number | undefined
  bundleAllowed?: boolean | undefined
}

function buildElevenStShippingFields(
  product: Product,
  intent: ElevenStShippingIntent,
): Record<string, unknown> {
  const baseFee = floorTo10(intent.baseFee ?? product.shippingFeeKrw)
  const freeThreshold = intent.freeThreshold ?? 0
  const out: Record<string, unknown> = {
    bndlDlvCnYn: intent.bundleAllowed ? 'Y' : 'N',
    jejuDlvCst: floorTo10(intent.jejuFee ?? 0),
    islandDlvCst: floorTo10(intent.islandFee ?? 0),
    rtngdDlvCst: floorTo10(intent.returnFee ?? 0),
    exchDlvCst: floorTo10(intent.exchangeFee ?? 0),
  }
  if (baseFee <= 0) {
    out.dlvCstInstBasiCd = '01' // 무료
  } else if (freeThreshold > 0) {
    out.dlvCstInstBasiCd = '03' // 상품 조건부 무료
    out.dlvCst1 = baseFee
    out.PrdFrDlvBasiAmt = floorTo10(freeThreshold)
  } else {
    out.dlvCstInstBasiCd = '02' // 고정 배송비
    out.dlvCst1 = baseFee
  }
  return out
}

/**
 * KC인증(ProductCertGroup) 분기 (spec 1003 + category-1617 requiredYn).
 *   - requiredYn !== 'Y' → 인증그룹 생략.
 *   - requiredYn === 'Y' → 셀러 입력(extra.cert) 우선, 없으면 "해당없음(131)" 최소 입력.
 */
interface ElevenStCertInput {
  crtfGrpTypCd?: string
  crtfGrpObjClfCd?: string
  crtfGrpExptTypCd?: string
  certs?: { certTypeCd: string; certKey: string }[]
}

function buildElevenStCertGroup(
  requiredYn: 'Y' | 'N' | undefined,
  certInput: ElevenStCertInput | undefined,
): Record<string, unknown> | undefined {
  if (requiredYn !== 'Y') return undefined
  if (certInput && certInput.crtfGrpTypCd && certInput.crtfGrpObjClfCd) {
    const group: Record<string, unknown> = {
      crtfGrpTypCd: certInput.crtfGrpTypCd,
      crtfGrpObjClfCd: certInput.crtfGrpObjClfCd,
    }
    if (certInput.crtfGrpExptTypCd) group.crtfGrpExptTypCd = certInput.crtfGrpExptTypCd
    const certs = (certInput.certs ?? []).filter((c) => c.certTypeCd && c.certKey)
    if (certs.length > 0) {
      group.ProductCert = certs.map((c) => ({ certTypeCd: c.certTypeCd, certKey: c.certKey }))
    }
    return group
  }
  return {
    crtfGrpObjClfCd: '03', // KC인증대상 아님
    ProductCert: { certTypeCd: '131', certKey: '' },
  }
}

/** transformProduct 산출물 — `<Product>` 필드 + (이미지 13장↑ 등) 경고. */
export interface ElevenStProductRawResult {
  /** `<Product>` XML 로 직렬화할 필드 맵 (buildElevenStProductXml 입력). */
  fields: Record<string, unknown>
  /** 무음 처리(이미지 truncate 등) 경고 — createProduct 가 결과에 전달. */
  warnings: { code: string; message: string }[]
}

/** mapping.extra 에서 Layer 2 / 배송의도 / KC인증 / officialNotice 슬롯 추출 (타입 가드). */
function readElevenStExtra(extra: Record<string, unknown>): {
  outboundAddrSeq: string
  returnAddrSeq: string
  shipping: ElevenStShippingIntent
  cert: ElevenStCertInput | undefined
  certRequiredYn: 'Y' | 'N' | undefined
  officialNotice: unknown
  orgnNmVal: string | undefined
  asDetail: string | undefined
  rtngExchDetail: string | undefined
} {
  const obj = (k: string): Record<string, unknown> | undefined => {
    const v = extra[k]
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : undefined
  }
  const shippingRaw = obj('shipping') ?? {}
  const numOrUndef = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  const strOrUndef = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
  return {
    outboundAddrSeq: str(extra.outboundAddrSeq),
    returnAddrSeq: str(extra.returnAddrSeq),
    shipping: {
      baseFee: numOrUndef(shippingRaw.baseFee),
      freeThreshold: numOrUndef(shippingRaw.freeThreshold),
      returnFee: numOrUndef(shippingRaw.returnFee),
      exchangeFee: numOrUndef(shippingRaw.exchangeFee),
      jejuFee: numOrUndef(shippingRaw.jejuFee),
      islandFee: numOrUndef(shippingRaw.islandFee),
      bundleAllowed:
        typeof shippingRaw.bundleAllowed === 'boolean' ? shippingRaw.bundleAllowed : undefined,
    },
    cert: obj('cert') as ElevenStCertInput | undefined,
    certRequiredYn:
      extra.certRequiredYn === 'Y' || extra.certRequiredYn === 'N'
        ? (extra.certRequiredYn as 'Y' | 'N')
        : undefined,
    officialNotice: extra.officialNotice,
    orgnNmVal: strOrUndef(extra.orgnNmVal),
    asDetail: strOrUndef(extra.asDetail),
    rtngExchDetail: strOrUndef(extra.rtngExchDetail),
  }
}

/**
 * 도메인 Product + MarketMapping → 11번가 상품등록(`<Product>`) raw payload (PR-3).
 *
 * 순수 함수 (Date.now / Math.random / 네트워크 금지). spec product-manage-1003 의 필수 20+ 필드.
 * Layer 2(addrSeqOut/addrSeqIn)·KC인증·officialNotice 는 mapping.extra(오케스트레이터가 marketOptions
 * 에서 주입) 에서 읽는다. 이미지 13장↑(prdImage12 초과) 은 무음 드롭하되 warning 으로 보고한다.
 *
 * KC인증 필수여부(1617 cert 메타)는 오케스트레이터가 mapping.extra.certRequiredYn 로 주입한다.
 * 명시 인자 `requiredYnOverride` 가 있으면 우선(단위테스트용).
 */
export function buildElevenStProductRaw(
  product: Product,
  mapping: MarketMapping,
  requiredYnOverride?: 'Y' | 'N',
): ElevenStProductRawResult {
  const warnings: { code: string; message: string }[] = []
  const extra = readElevenStExtra(mapping.extra ?? {})
  const requiredYn = requiredYnOverride ?? extra.certRequiredYn

  const images = mapping.transformedImageUrls
  if (images.length > 12) {
    warnings.push({
      code: 'images_truncated',
      message: `11번가는 이미지 12장까지 등록됩니다. ${images.length - 12}장이 제외됩니다.`,
    })
  }
  const imageFields = images.slice(0, 12).reduce<Record<string, string>>((acc, url, idx) => {
    acc[`prdImage${String(idx + 1).padStart(2, '0')}`] = url
    return acc
  }, {})

  const raw: Record<string, unknown> = {
    ...ELEVEN_ST_PRODUCT_CONSTANTS,
    dispCtgrNo: mapping.categoryId,
    prdNm: sanitizeElevenStProductName(product.name),
    brand: product.brand && product.brand.trim() !== '' ? product.brand.trim() : ELEVEN_ST_DEFAULT_BRAND,
    selPrc: floorTo10(product.priceKrw),
    prdSelQty: product.stock > 0 ? product.stock : 1,
    ...imageFields,
    htmlDetail: product.descriptionHtml && product.descriptionHtml.trim() !== ''
      ? product.descriptionHtml
      : '<p>상세설명 준비중입니다.</p>',
    orgnNmVal: extra.orgnNmVal ?? ELEVEN_ST_DEFAULT_ORGN_NM,
    asDetail: extra.asDetail ?? ELEVEN_ST_DEFAULT_AS_DETAIL,
    rtngExchDetail: extra.rtngExchDetail ?? ELEVEN_ST_DEFAULT_RTNG_EXCH_DETAIL,
    ...buildElevenStShippingFields(product, extra.shipping),
    ...(extra.outboundAddrSeq ? { addrSeqOut: extra.outboundAddrSeq } : {}),
    ...(extra.returnAddrSeq ? { addrSeqIn: extra.returnAddrSeq } : {}),
  }

  const certGroup = buildElevenStCertGroup(requiredYn, extra.cert)
  if (certGroup) raw.ProductCertGroup = certGroup

  if (extra.officialNotice && typeof extra.officialNotice === 'object') {
    raw.ProductNotification = extra.officialNotice
  }

  return { fields: raw, warnings }
}

/** Record → `<Product>...</Product>` XML (중첩 객체/배열 재귀 직렬화). */
export function buildElevenStProductXml(raw: Record<string, unknown>): string {
  return `<?xml version="1.0" encoding="EUC-KR"?>${serializeElevenStXmlNode('Product', raw)}`
}

function serializeElevenStXmlNode(tag: string, value: unknown): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) {
    return value.map((v) => serializeElevenStXmlNode(tag, v)).join('')
  }
  if (typeof value === 'object') {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => serializeElevenStXmlNode(k, v))
      .join('')
    return `<${tag}>${inner}</${tag}>`
  }
  return `<${tag}>${escapeXml(value)}</${tag}>`
}

/**
 * 상품등록 응답(`ClientMessage`) 분류 (PR-3 — spec 1003 응답).
 *   - success  : resultCode ∈ {200, 210} AND productNo 존재 → externalId 발급
 *   - rejected : 400(일 500개 한도) / 500(검증실패) 등 — 셀러 정정 필요(validation)
 * 순수 함수. 입력은 stripNsPrefix 통과 후 객체 (root `ClientMessage`).
 */
export const ELEVEN_ST_CREATE_SUCCESS_CODES = ['200', '210'] as const

export function classifyElevenStCreateResult(
  parsed: Record<string, unknown>,
):
  | { kind: 'success'; productNo: string; resultCode: string; message: string }
  | { kind: 'rejected'; resultCode: string; message: string } {
  const container =
    (pick(parsed, ['ClientMessage', 'clientMessage', 'Result', 'result']) as
      | Record<string, unknown>
      | undefined) ?? parsed
  const productNo = str(pick(container, ['productNo', 'ProductNo', 'prdNo']))
  const resultCode = str(pick(container, ['resultCode', 'result_code', 'ResultCode', 'code']))
  const message = str(pick(container, ['message', 'result_text', 'resultMessage']))
  const isSuccess =
    (ELEVEN_ST_CREATE_SUCCESS_CODES as readonly string[]).includes(resultCode) && productNo !== ''
  if (isSuccess) {
    return { kind: 'success', productNo, resultCode, message }
  }
  return { kind: 'rejected', resultCode: resultCode || 'unknown', message }
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

/**
 * 주문조회(1876) 결과를 분류 (PR-5). spec Error Response: `orders.result_code`.
 *   - 0  = 조회된 결과 없음 (에러 아님 — empty)
 *   - 음수(-3105 등) = 비즈니스 에러 (error + code/message)
 *   - result_code 없음 = 정상 목록 (ok)
 * 순수 함수. 입력은 stripNsPrefix 통과 후 객체.
 */
export function classifyElevenStOrdersResult(
  parsed: Record<string, unknown>,
):
  | { kind: 'ok' }
  | { kind: 'empty' }
  | { kind: 'error'; code: string; message: string } {
  const container =
    (pick(parsed, ['orders', 'Orders', 'OrderList']) as Record<string, unknown> | undefined) ??
    parsed
  const code = str(pick(container, ['result_code', 'resultCode', 'code']))
  if (code === '') return { kind: 'ok' }
  if (code === '0') return { kind: 'empty' }
  return {
    kind: 'error',
    code,
    message: str(pick(container, ['result_text', 'resultMessage', 'message'])),
  }
}

/**
 * 파싱된 XML 객체 → MarketOrder[] (zod 검증은 호출측 어댑터가 수행).
 *
 * PR-5 재작성: spec paid-1876 (`ns2:orders > ns2:order[]`, stripNsPrefix 후 `orders.order`).
 * complete(1876)는 "발주확인 대기" 목록만 반환하므로 status 는 항상 new_pay (ordStat 필드 없음).
 * ⚠️ `dlvNo`(배송번호) 는 발송처리(1888)의 path 키 → `MarketOrder.extra.dlvNo` 로 반드시 수집.
 */
export function mapElevenStOrders(parsed: Record<string, unknown>): MarketOrder[] {
  const container = pick(parsed, ['orders', 'Orders', 'OrderList']) as
    | Record<string, unknown>
    | undefined
  let list: Record<string, unknown>[] = []
  if (container && typeof container === 'object') {
    list = asArray(pick(container, ['order', 'Order']))
  } else {
    list = asArray(pick(parsed, ['order', 'Order']))
  }

  return list.map((o) => {
    const baseAddr = str(pick(o, ['rcvrBaseAddr', 'RcvrBaseAddr', 'rcvrMailAddr']))
    const dtlAddr = str(pick(o, ['rcvrDtlsAddr', 'RcvrDtlsAddr', 'rcvrDetailAddr']))
    const addr = [baseAddr, dtlAddr].filter((s) => s.length > 0).join(' ')
    const qty = intOr(pick(o, ['ordQty', 'OrdQty', 'orderQty']), 1)
    // ordAmt(주문총액) 우선, 없으면 ordPayAmt(결제금액) fallback (spec §4.4).
    const amount = intOr(pick(o, ['ordAmt', 'OrdAmt', 'ordPayAmt', 'selPrc']), 0)
    const dlvNo = str(pick(o, ['dlvNo', 'DlvNo']))
    // paidAt 은 결제완료일시(ordStlEndDt) 우선, 없으면 주문일시(ordDt).
    const paidRaw =
      str(pick(o, ['ordStlEndDt', 'OrdStlEndDt'])) ||
      str(pick(o, ['ordDt', 'OrdDt'])) ||
      undefined
    const order: MarketOrder = {
      market: MARKET,
      externalOrderId: str(pick(o, ['ordNo', 'OrdNo', 'orderNo'])) || 'unknown',
      buyerName: str(pick(o, ['ordNm', 'OrdNm', 'buyerNm', 'memNm'])) || '미상',
      receiverName: str(pick(o, ['rcvrNm', 'RcvrNm', 'receiverNm'])) || '미상',
      receiverAddress: addr.length > 0 ? addr : '주소 없음',
      receiverPhone:
        str(pick(o, ['rcvrPrtblNo', 'RcvrPrtblNo', 'rcvrTlphn', 'rcvrTlphnNo'])) ||
        '연락처 없음',
      productName: str(pick(o, ['prdNm', 'PrdNm', 'productNm'])) || '상품명 없음',
      quantity: qty > 0 ? qty : 1,
      orderAmount: amount >= 0 ? amount : 0,
      status: 'new_pay',
      paidAt: normalizeIsoOffset(paidRaw),
    }
    // dlvNo 가 있을 때만 extra 부착 (없으면 발송처리 불가 — 호출측이 판단).
    if (dlvNo) order.extra = { dlvNo }
    return order
  })
}

// ─────────────────────────────────────────────
// 발송 처리
// ─────────────────────────────────────────────

/**
 * 발송처리(1888) 정상 거부 코드 (market-adapter.md §9.7).
 *   -3306 송장번호 형식 / -3320 중복 송장 / -3307 택배사 코드 오류.
 *   Edge 어댑터는 throw-on-failure 계약이므로 'validation'(비재시도) MarketError 로 throw.
 */
export const ELEVEN_ST_DISPATCH_REJECT_CODES = ['-3306', '-3320', '-3307'] as const

/**
 * 발송처리(1888) 성공 간주 코드.
 *   0 성공 / -3308 이미 발송처리됨 (묶음배송 멱등 — spec: 같은 dlvNo 재호출도 정상 처리로 간주).
 */
export const ELEVEN_ST_DISPATCH_OK_CODES = ['0', '-3308'] as const

/**
 * 발송처리(1888) 응답(`ResultOrder.result_code`)을 반환 정책(§9.7)으로 분류 (PR-5).
 *   - ok        : 성공 (0 / -3308 멱등)
 *   - rejected  : 정상 거부 (-3306/-3320/-3307)
 *   - throwable : 횡단 실패 (-1000 점검중 / -3311 시스템장애 / 알 수 없는 음수)
 * 순수 함수. 입력은 stripNsPrefix 통과 후 객체.
 */
export function classifyElevenStDispatchResult(
  parsed: Record<string, unknown>,
):
  | { kind: 'ok'; code: string; message: string }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'throwable'; code: string; message: string } {
  const container =
    (pick(parsed, ['ResultOrder', 'resultOrder', 'Result', 'result']) as
      | Record<string, unknown>
      | undefined) ?? parsed
  const code = str(pick(container, ['result_code', 'resultCode', 'code']))
  const message = str(pick(container, ['result_text', 'resultMessage', 'message']))
  if ((ELEVEN_ST_DISPATCH_OK_CODES as readonly string[]).includes(code)) {
    return { kind: 'ok', code, message }
  }
  if ((ELEVEN_ST_DISPATCH_REJECT_CODES as readonly string[]).includes(code)) {
    return { kind: 'rejected', code, message }
  }
  // 그 외 음수/미지 코드 = 횡단 실패로 보수적 처리 (-1000 점검중 / -3311 장애 / -1 비즈니스 등).
  return { kind: 'throwable', code, message }
}
