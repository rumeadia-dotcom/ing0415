/**
 * ESM(G마켓·옥션) 상품정보고시 41개 상품군 마스터 상수 (Edge / Deno 측 미러).
 *
 * Web 미러(ground truth): apps/web/src/lib/markets/real/esm/official-notice-groups.ts (구조 동일).
 * 마스터: docs/architecture/v1/features/esm.md §4.4
 * 근거 원문: docs/architecture/v1/features/esm-api/product/161.md
 *
 * 변경 시 양쪽 동시 갱신(Zod Mirror Check 대상 — ESM_OFFICIAL_NOTICE_NOS).
 * 데이터 출처 경계·필드 의미·항목코드 포맷은 Web 미러 헤더 주석 참조.
 */

import { z } from 'npm:zod@3.23.8'
import {
  EsmOfficialNoticeDetailSchema,
  type EsmOfficialNotice,
} from '../schemas.ts'

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

export interface EsmOfficialNoticeGroup {
  readonly officialNoticeNo: EsmOfficialNoticeNo
  readonly officialNoticeName: string
  readonly requiredItemCodes: readonly string[]
  readonly hasStaticItems: boolean
  readonly docVerified: boolean
}

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
    requiredItemCodes: ['41-1'],
    hasStaticItems: false,
    docVerified: true,
  },
] as const

export const ESM_OFFICIAL_NOTICE_GROUP_BY_NO: Readonly<
  Record<EsmOfficialNoticeNo, EsmOfficialNoticeGroup>
> = Object.fromEntries(
  ESM_OFFICIAL_NOTICE_GROUPS.map((g) => [g.officialNoticeNo, g]),
) as Record<EsmOfficialNoticeNo, EsmOfficialNoticeGroup>

// 강검증 스키마 (Web 미러: official-notice-groups.ts). 규칙·레이어링 근거는 Web 미러 주석 참조.
export const EsmOfficialNoticeStrictSchema = z
  .object({
    officialNoticeNo: EsmOfficialNoticeNoSchema,
    details: z.array(EsmOfficialNoticeDetailSchema),
  })
  .superRefine((data, ctx) => {
    const group = ESM_OFFICIAL_NOTICE_GROUP_BY_NO[data.officialNoticeNo]
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

const _assertStrictAssignableToLoose: EsmOfficialNotice = {
  officialNoticeNo: '1',
  details: [],
}
void _assertStrictAssignableToLoose
