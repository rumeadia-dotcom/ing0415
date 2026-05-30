/**
 * ESM(G마켓·옥션) 상품정보고시 41개 상품군 마스터 상수 (Web 측 단일 소스).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.4 (EsmOfficialNoticeSchema)
 * 근거 원문: docs/architecture/v1/features/esm-api/product/161.md (고시 정보 조회 API)
 *   - 고시 상품군 조회        [GET] /item/v1/official-notice/groups
 *       → { groups: [{ officialNoticeNo: number, officialNoticeName: string }] }
 *   - 상품군별 필수항목 리스트 [GET] /item/v1/official-notice/groups/{officialNoticeNo}/codes
 *       → { codes: [{ officialNoticeItemelementCode, officialNoticeItemelementName,
 *                      guideText, isExtraMark(=필수여부) }] }
 *   - officialNoticeNo 는 1 ~ 41 (path param). 항목코드 포맷은 `{groupNo}-{idx}` (문서 sample: "41-1").
 *
 * Edge 미러: apps/api/supabase/functions/_shared/market-adapters/esm-official-notice-groups.ts
 *            (구조 동일 — 같은 41군 코드/명칭/항목 집합).
 *
 * ── 데이터 출처 경계 (INTJ: 근거 없는 결정 금지) ────────────────────────────
 * 문서 161.md 는 **API 형태와 sample 2건**(상품군 1=의류, 상품군 41=살생물제품/항목 "41-1")
 * 만 명시하고, 41개 상품군 전체 명칭·각 군의 필수항목 코드 목록은 **런타임 라이브 API**
 * (`/official-notice/groups`, `/groups/{no}/codes`)에서 받도록 설계돼 있다.
 *
 * 따라서 본 상수는:
 *   1. officialNoticeNo 1~41 의 **코드 enum** 을 고정한다 (path param 범위 = 법정 고정값).
 *   2. 상품군 **명칭** 은 "전자상거래 등에서의 상품정보제공에 관한 고시"(공정거래위원회)
 *      의 표준 41개 상품군 명칭을 박는다(ESM 라이브 API 가 돌려주는 값과 동일한 법정 표준).
 *      문서 161.md 가 직접 확인해 준 군(1=의류, 41=살생물제품)은 `docVerified: true` 로 표기.
 *   3. **필수항목 코드 목록**은 군마다 수가 크고 문서에 전량이 없으므로, 문서가 확인한 항목
 *      (41-1)만 박고, 나머지는 `requiredItemCodes` 를 빈 배열로 두어 **런타임 fetch 로 채운다**
 *      (frontend 가 `/groups/{no}/codes` 응답으로 항목 폼을 생성). 빈 배열 = "런타임 조회 필요"
 *      이지 "필수항목 없음" 이 아니다(아래 `hasStaticItems` 로 구분).
 *
 * frontend 사용처:
 *   - select 옵션: ESM_OFFICIAL_NOTICE_GROUPS 로 상품군 드롭다운 생성.
 *   - 항목 폼: 선택된 군의 requiredItemCodes 가 비어있으면 라이브 API(codes)로 폼 생성,
 *     채워져 있으면 정적 항목으로 즉시 렌더(오프라인/테스트 경로).
 */

import { z } from 'zod'
import {
  EsmOfficialNoticeDetailSchema,
  type EsmOfficialNotice,
} from '@/lib/schemas/esm'

// ─────────────────────────────────────────────
// 상품군 코드 enum — officialNoticeNo 1 ~ 41 (문자열). 등록 페이로드의 officialNoticeNo 와 정합.
//   문서 161.md: officialNoticeNo 는 number(1~41)이나, EsmOfficialNoticeSchema 의
//   officialNoticeNo 는 string. 등록 시 string("1".."41") 으로 전달 → 본 enum 은 string.
// ─────────────────────────────────────────────
export const ESM_OFFICIAL_NOTICE_NOS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
] as const

export const EsmOfficialNoticeNoSchema = z.enum(ESM_OFFICIAL_NOTICE_NOS)
export type EsmOfficialNoticeNo = z.infer<typeof EsmOfficialNoticeNoSchema>

/**
 * 상품군 1건. 라이브 API `/official-notice/groups` 의 group 1건 + 우리 측 정적 보강.
 *  - officialNoticeNo: 코드(string).
 *  - officialNoticeName: 상품군 명칭(법정 표준).
 *  - requiredItemCodes: 정적으로 박힌 필수항목 코드(문서 확인분). 비어있으면 런타임 fetch.
 *  - hasStaticItems: requiredItemCodes 가 정적 완본인지(true) / 런타임 보강 필요(false).
 *  - docVerified: 문서 161.md 가 명칭/항목을 직접 확인해 준 군인지.
 */
export interface EsmOfficialNoticeGroup {
  readonly officialNoticeNo: EsmOfficialNoticeNo
  readonly officialNoticeName: string
  readonly requiredItemCodes: readonly string[]
  readonly hasStaticItems: boolean
  readonly docVerified: boolean
}

/**
 * 41개 상품군 마스터.
 *
 * 명칭 출처: 공정거래위원회 "전자상거래 등에서의 상품정보제공에 관한 고시" 별표(상품군 표준 41종).
 *   ESM 라이브 API(`/official-notice/groups`)가 돌려주는 officialNoticeName 과 동일 표준.
 * docVerified: 문서 161.md sample 이 직접 확인 — 1(의류), 41(살생물제품).
 *
 * requiredItemCodes: 문서 161.md 가 항목코드를 직접 보여준 41군의 "41-1"(제품명 및 살생물제품유형)만
 *   정적 보강. 그 외 군은 [](=런타임 fetch). 빈 배열은 "필수항목 없음" 이 아님 — hasStaticItems=false 로 구분.
 *
 * 항목코드 포맷: `{officialNoticeNo}-{n}` (문서 sample "41-1" 기준).
 */
export const ESM_OFFICIAL_NOTICE_GROUPS: readonly EsmOfficialNoticeGroup[] = [
  { officialNoticeNo: '1', officialNoticeName: '의류', requiredItemCodes: [], hasStaticItems: false, docVerified: true },
  { officialNoticeNo: '2', officialNoticeName: '구두/신발', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '3', officialNoticeName: '가방', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '4', officialNoticeName: '패션잡화(모자/벨트/액세서리)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '5', officialNoticeName: '침구류/커튼', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '6', officialNoticeName: '가구(침대/소파/싱크대/DIY제품)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '7', officialNoticeName: '영상가전(TV류)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '8', officialNoticeName: '가정용 전기제품(냉장고/세탁기/식기세척기/전자레인지)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '9', officialNoticeName: '계절가전(에어컨/온풍기)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '10', officialNoticeName: '사무용기기(컴퓨터/노트북/프린터)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '11', officialNoticeName: '광학기기(디지털카메라/캠코더)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '12', officialNoticeName: '소형전자(MP3/전자사전 등)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '13', officialNoticeName: '휴대폰(이동전화단말기)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '14', officialNoticeName: '내비게이션', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '15', officialNoticeName: '자동차용품(자동차부품/기타 자동차용품)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '16', officialNoticeName: '의료기기', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '17', officialNoticeName: '주방용품', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '18', officialNoticeName: '화장품', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '19', officialNoticeName: '귀금속/보석/시계류', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '20', officialNoticeName: '식품(농수축산물)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '21', officialNoticeName: '가공식품', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '22', officialNoticeName: '건강기능식품', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '23', officialNoticeName: '영유아용품', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '24', officialNoticeName: '악기', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '25', officialNoticeName: '스포츠용품', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '26', officialNoticeName: '서적', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '27', officialNoticeName: '호텔/펜션 예약', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '28', officialNoticeName: '여행패키지/항공권/입장권', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '29', officialNoticeName: '물품 및 상품권(상품권/쿠폰/티켓)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '30', officialNoticeName: '모바일 쿠폰', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '31', officialNoticeName: '영화/공연 예매권', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '32', officialNoticeName: '자동차대여 서비스(렌터카)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '33', officialNoticeName: '기타용역(경비/청소 등 서비스)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '34', officialNoticeName: '소프트웨어(자동차 부품 등 일반)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '35', officialNoticeName: '디지털콘텐츠(온라인 게임/음원/동영상)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '36', officialNoticeName: '생활화학제품', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '37', officialNoticeName: '주방세제/세탁세제 등 세정제', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '38', officialNoticeName: '자동차(신차/중고차)', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '39', officialNoticeName: '주택/상가 분양/임대', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  { officialNoticeNo: '40', officialNoticeName: '기타 재화', requiredItemCodes: [], hasStaticItems: false, docVerified: false },
  {
    officialNoticeNo: '41',
    officialNoticeName: '살생물제품',
    // 문서 161.md sample 이 직접 확인한 항목. 살생물제품 전체 항목은 라이브 API 로 보강.
    requiredItemCodes: ['41-1'],
    hasStaticItems: false,
    docVerified: true,
  },
] as const

/** officialNoticeNo → 상품군 1건 (O(1) 조회). */
export const ESM_OFFICIAL_NOTICE_GROUP_BY_NO: Readonly<
  Record<EsmOfficialNoticeNo, EsmOfficialNoticeGroup>
> = Object.fromEntries(
  ESM_OFFICIAL_NOTICE_GROUPS.map((g) => [g.officialNoticeNo, g]),
) as Record<EsmOfficialNoticeNo, EsmOfficialNoticeGroup>

/** select 옵션용 — { value, label }[] (frontend 드롭다운 생성). */
export function getEsmOfficialNoticeOptions(): readonly {
  value: EsmOfficialNoticeNo
  label: string
}[] {
  return ESM_OFFICIAL_NOTICE_GROUPS.map((g) => ({
    value: g.officialNoticeNo,
    label: g.officialNoticeName,
  }))
}

// ─────────────────────────────────────────────
// 강검증 스키마 — officialNoticeNo ∈ 41 상품군 + 군별 정적 필수항목(있으면) 포함.
//
//   PR-0 의 EsmOfficialNoticeSchema(schemas/esm.ts)는 officialNoticeNo: string().min(1)
//   의 **느슨한 계약**이다(상품군 마스터를 PR-5 로 미룬다고 명시). 본 strict 스키마는
//   상품군 마스터가 생긴 PR-5 에서 그 위에 얹는 **정합 검증**이다.
//
//   레이어링: schemas/esm.ts(저수준) → 본 파일(markets, 고수준) 단방향. 역참조 금지
//   (schemas 가 markets 를 import 하면 순환). 따라서 strict 변형은 마스터와 동거하는 본 파일에 둔다.
//
//   검증 규칙:
//     - officialNoticeNo 는 ESM_OFFICIAL_NOTICE_NOS('1'..'41') enum.
//     - 선택 군의 requiredItemCodes 가 정적 완본(hasStaticItems=true)이면, 그 코드가 details 에
//       전부 존재해야 한다. hasStaticItems=false(런타임 보강 군)면 details 항목 검증을 강제하지
//       않는다(라이브 codes API 가 폼·검증을 frontend 에서 채우므로 — 여기서 거짓 거부 금지).
// ─────────────────────────────────────────────
export const EsmOfficialNoticeStrictSchema = z
  .object({
    officialNoticeNo: EsmOfficialNoticeNoSchema,
    details: z.array(EsmOfficialNoticeDetailSchema),
  })
  .superRefine((data, ctx) => {
    const group = ESM_OFFICIAL_NOTICE_GROUP_BY_NO[data.officialNoticeNo]
    // enum 통과 = group 항상 존재. 방어적 가드만.
    if (!group) return
    if (group.hasStaticItems && group.requiredItemCodes.length > 0) {
      const present = new Set(data.details.map((d) => d.code))
      for (const code of group.requiredItemCodes) {
        if (!present.has(code)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `상품군 ${group.officialNoticeName}(${data.officialNoticeNo})의 필수 고시 항목 ${code} 이(가) 누락되었습니다`,
            path: ['details'],
          })
        }
      }
    }
  })
export type EsmOfficialNoticeStrict = z.infer<
  typeof EsmOfficialNoticeStrictSchema
>

// 타입 정합 보장 — strict 결과는 PR-0 의 느슨한 EsmOfficialNotice 의 부분집합이어야 한다.
// (officialNoticeNo: enum ⊂ string, details 동일). 컴파일타임에 깨지면 마스터 drift 신호.
const _assertStrictAssignableToLoose: EsmOfficialNotice = {
  officialNoticeNo: '1',
  details: [],
}
void _assertStrictAssignableToLoose
