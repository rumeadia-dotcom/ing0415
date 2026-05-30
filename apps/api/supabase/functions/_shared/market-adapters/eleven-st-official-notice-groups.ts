/**
 * 11번가(11st) 상품정보고시(ProductNotification) 상품군 마스터 (Edge Function 측 미러).
 *
 * Web 원본: apps/web/src/lib/markets/real/11st/official-notice-groups.ts (구조 동일 — parity).
 * 마스터: docs/architecture/v1/features/11st.md §1 결정4 / §4.1 / §7 PR-4 / §9(C4 backlog).
 * 근거 원문: docs/architecture/v1/features/11st-api/product/product-manage-1003.md
 *   - `ProductNotification` 필수(Y): type(예시 "891011") + item[{code(예 "23759468"), name(예 "나일론")}].
 *   - 41군 전체 type/item 코드는 spec 첨부파일 → 우리 docs 미포함(C4 backlog). 확보 군은 891011 1개뿐.
 *
 * 추측 코드 금지: 미확보 군은 셀러 free-form. item 정적 필수항목 없음(첨부파일 의존).
 */

export interface ElevenStNoticeGroup {
  readonly type: string
  readonly name: string
  readonly docVerified: boolean
}

export const ELEVEN_ST_NOTICE_GROUPS: readonly ElevenStNoticeGroup[] = [
  {
    type: '891011',
    name: '일반 상품 (예시 군 · 891011)',
    docVerified: true,
  },
] as const

export const ELEVEN_ST_NOTICE_GROUP_BY_TYPE: Readonly<
  Record<string, ElevenStNoticeGroup>
> = Object.fromEntries(ELEVEN_ST_NOTICE_GROUPS.map((g) => [g.type, g]))

export const ELEVEN_ST_NOTICE_ALLOW_FREEFORM = true
