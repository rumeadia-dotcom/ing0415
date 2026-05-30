import { z } from 'zod'

/**
 * 11번가(11st) 어댑터 zod 스키마 단일 소스 (PR-0 — spec import #265).
 *
 * 마스터: docs/architecture/v1/features/11st.md §4 (API 스키마 zod 계약).
 * 근거 원문: docs/architecture/v1/features/11st-api/product/{product-manage-1003, category-1001,
 *   shipping-1014, shipping-1691}.md, order/{paid-1876, dispatch-1888}.md
 *
 * 본 파일은 PR-0 산출물 — 11번가 문서 기준 재구현(PR-1~6)의 계약을 고정한다.
 * Edge Function 측 미러: apps/api/supabase/functions/_shared/schemas.ts (구조 동일).
 * RHF resolver + Supabase insert + 서버 응답 parse 3중 재사용. 컴포넌트 inline z.object 금지.
 *
 * 인코딩/형식: 요청·응답 모두 XML(EUC-KR). 응답은 `ns2:` 네임스페이스 prefix 를 단다 →
 *   파싱 후 `stripNsPrefix`(map.ts) 로 제거한 객체를 본 스키마로 parse 한다.
 *
 * 주의: 실제 호출 경로/페이로드 빌드 로직은 PR-1~5. PR-0 은 스키마 계약만 둔다.
 *   응답 스키마는 미지 필드 보존을 위해 `.passthrough()`.
 */

// ─────────────────────────────────────────────
// 공통 — XML 값은 문자열, 가격/배송비는 숫자 강제(coerce)
// ─────────────────────────────────────────────

/** XML 코드값(예 selMthdCd='01'). 빈 문자열 거부. */
const CodeStr = z.string().min(1)
/** 원 단위 금액 — XML 은 문자열이라 coerce. 음수 거부. */
const KrwNum = z.coerce.number().int().nonnegative()
/**
 * 문자열 또는 숫자(XML 파서가 숫자 태그를 number 로 줄 수 있음) → 문자열.
 * `z.coerce.string()` 은 undefined 를 "undefined" 로 coerce 해 필수 누락을 못 잡으므로,
 * union 으로 nullish 를 거부한다(필수 필드용). optional 은 `.optional()` 부착.
 */
const NumOrStr = z.union([z.string(), z.number()]).transform((v) => String(v))

// ─────────────────────────────────────────────
// §4.1 상품등록 요청 (transformProduct 출력 = createProduct 입력)
// 문서 product-manage-1003.md. 필수(Y) 필드를 계약으로 고정 + 나머지는 passthrough.
// ─────────────────────────────────────────────

export const ElevenStProductCreateSchema = z
  .object({
    // 판매 기본
    selMthdCd: CodeStr, // 판매방식 01=고정가
    prdTypCd: CodeStr, // 상품유형 01=일반배송
    prdStatCd: CodeStr, // 상품상태 01=새상품
    dispCtgrNo: CodeStr, // 카테고리(leaf)
    prdNm: z.string().min(1).max(100), // 상품명 ≤100자
    brand: z.string().min(1), // 없으면 "알수없음"
    selPrc: KrwNum.refine((v) => v % 10 === 0, '판매가는 10원 단위'),
    prdSelQty: z.coerce.number().int().positive(), // 재고 >0
    prdImage01: z.string().url(), // 대표이미지
    htmlDetail: z.string().min(1),
    minorSelCnYn: z.enum(['Y', 'N']),
    suplDtyfrPrdClfCd: CodeStr, // 부가세 01/02/03
    rmaterialTypCd: CodeStr, // 원재료유형 01~05
    orgnTypCd: CodeStr, // 원산지 01/02/03
    // 배송(Layer 1 인라인 + Layer 2 시퀀스)
    dlvCnAreaCd: CodeStr,
    dlvWyCd: CodeStr, // 01=택배
    dlvClf: CodeStr, // 02=업체배송
    dlvCstInstBasiCd: CodeStr, // 배송비종류 01무료/02고정/03조건부무료/04수량차등/05개당
    bndlDlvCnYn: z.enum(['Y', 'N']), // 묶음
    dlvCstPayTypCd: CodeStr, // 선/착불
    jejuDlvCst: KrwNum,
    islandDlvCst: KrwNum,
    rtngdDlvCst: KrwNum, // 반품배송비
    exchDlvCst: KrwNum, // 교환배송비
    addrSeqOut: CodeStr, // 출고지 시퀀스 (조회형 select)
    addrSeqIn: CodeStr, // 반품/교환지 시퀀스
    asDetail: z.string().min(1), // 공백 불가
    rtngExchDetail: z.string().min(1), // 공백 불가
  })
  .passthrough() // 조건부/선택 필드(dlvCst1, PrdFrDlvBasiAmt, ProductCertGroup, ProductNotification 등)는 PR-3 가 채움
export type ElevenStProductCreate = z.infer<typeof ElevenStProductCreateSchema>

// ─────────────────────────────────────────────
// §4.2 상품등록 응답 — root `ClientMessage` (구 코드 `Product>ProductNo` 는 오기)
// ─────────────────────────────────────────────

/** resultCode 200=일반성공 / 210=신규성공 / 400=한도 / 500=실패. */
export const ELEVEN_ST_CREATE_SUCCESS_CODES = ['200', '210'] as const

export const ElevenStProductCreateResponseSchema = z
  .object({
    productNo: NumOrStr.optional(), // 성공 시 발급
    resultCode: NumOrStr, // enum 이지만 문자열로 보존
    message: z.string().optional(),
  })
  .passthrough()
export type ElevenStProductCreateResponse = z.infer<
  typeof ElevenStProductCreateResponseSchema
>

// ─────────────────────────────────────────────
// §4.3 카테고리 응답 (1001/1617) — ns2 제거 후 ns2:category[] 단일 노드
// ─────────────────────────────────────────────

export const ElevenStCategorySchema = z
  .object({
    dispNo: NumOrStr, // → CategoryNode.id
    dispNm: z.string(), // → name
    depth: z.coerce.number().int().min(1), // 1대/2중/3소/4세
    parentDispNo: NumOrStr, // 0=최상위 → parentId:null
    leafYn: z.enum(['Y', 'N']),
    // 1617(하위)만: 카테고리별 KC인증 필수여부
    certType: NumOrStr.optional(),
    requiredYn: z.enum(['Y', 'N']).optional(),
  })
  .passthrough()
export type ElevenStCategory = z.infer<typeof ElevenStCategorySchema>

// ─────────────────────────────────────────────
// §4.4 주문 응답 (1876) — ns2 제거 후 ns2:order[] 단일 노드
//   dlvNo(배송번호) 는 발송처리(1888)의 path 키 → 반드시 보존
// ─────────────────────────────────────────────

export const ElevenStOrderSchema = z
  .object({
    ordNo: NumOrStr, // 11번가 주문번호 → externalOrderId
    dlvNo: NumOrStr, // 배송번호 (발송처리 키)
    ordPrdSeq: NumOrStr.optional(), // 주문순번
    ordNm: z.string().optional(), // 구매자
    rcvrNm: z.string().optional(), // 수령자
    rcvrBaseAddr: z.string().optional(),
    rcvrDtlsAddr: z.string().optional(),
    rcvrPrtblNo: z.string().optional(),
    prdNm: z.string().optional(),
    ordQty: z.coerce.number().int().nonnegative().optional(),
    ordAmt: z.coerce.number().int().nonnegative().optional(),
    ordPayAmt: z.coerce.number().int().nonnegative().optional(),
    ordDt: z.string().optional(),
    ordStlEndDt: z.string().optional(),
  })
  .passthrough()
export type ElevenStOrder = z.infer<typeof ElevenStOrderSchema>

// ─────────────────────────────────────────────
// §4 Layer 2 — 출고지/반품지 조회 응답 (1014/1691·1015/1692)
//   ns2 제거 후 inOutAddress[] 단일 노드. select 옵션은 addrSeq + addrNm.
// ─────────────────────────────────────────────

export const ElevenStShippingAddressSchema = z
  .object({
    addrSeq: NumOrStr, // 시퀀스코드 → addrSeqOut/addrSeqIn
    addrNm: z.string(), // 주소명 (select 표시)
    addr: z.string().optional(),
    rcvrNm: z.string().optional(),
    gnrlTlphnNo: z.string().optional(),
    prtblTlphnNo: z.string().optional(),
  })
  .passthrough()
export type ElevenStShippingAddress = z.infer<typeof ElevenStShippingAddressSchema>

// ─────────────────────────────────────────────
// §3 Layer 2 — 조회 Edge → Web 정규화 응답 (PR-2)
//   ⚠️ PII 차단: 정규화/응답 단계는 addrSeq + addrNm 2필드만 통과시킨다.
//   주소(addr)·수령자(rcvrNm)·전화(gnrlTlphnNo/prtblTlphnNo)는 우리 DB 미저장·미노출(11st.md §3).
//   select 표시 = addrNm, payload 주입 = addrSeq (addrSeqOut/addrSeqIn).
// ─────────────────────────────────────────────

/** 출고지/반품지 select 옵션 — addrSeq(값) + addrNm(표시). PII 0. */
export const ElevenStShippingAddressOptionSchema = z.object({
  addrSeq: z.string().min(1),
  addrNm: z.string().min(1),
})
export type ElevenStShippingAddressOption = z.infer<
  typeof ElevenStShippingAddressOptionSchema
>

/**
 * 조회 Edge(eleven-st-shipping-list) → Web 응답.
 *   outbound = 출고지 목록(1014), returnAddrs = 반품/교환지 목록(1015).
 * 빈 배열 = 셀러가 셀러오피스에 미등록(empty 상태) — 에러 아님.
 */
export const ElevenStShippingAddressListResponseSchema = z.object({
  outbound: z.array(ElevenStShippingAddressOptionSchema),
  returnAddrs: z.array(ElevenStShippingAddressOptionSchema),
})
export type ElevenStShippingAddressListResponse = z.infer<
  typeof ElevenStShippingAddressListResponseSchema
>

// ─────────────────────────────────────────────
// §4 상품정보고시 (ProductNotification) — type + item[{code,name}]
//   ESM officialNotice 와 동형. 상품군 코드 마스터는 PR-4.
// ─────────────────────────────────────────────

export const ElevenStNoticeItemSchema = z.object({
  code: z.string().min(1), // 항목코드
  name: z.string().min(1), // 항목값
})
export const ElevenStOfficialNoticeSchema = z.object({
  type: z.string().min(1), // 유형코드(상품군)
  item: z.array(ElevenStNoticeItemSchema).min(1),
})
export type ElevenStOfficialNotice = z.infer<typeof ElevenStOfficialNoticeSchema>
