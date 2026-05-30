/**
 * 11번가(11st) 상품정보고시(ProductNotification) 상품군 마스터 (Web 측 단일 소스).
 *
 * 마스터: docs/architecture/v1/features/11st.md §1 결정4 / §4.1(ProductNotification) / §7 PR-4 / §9(C4 backlog).
 * 근거 원문: docs/architecture/v1/features/11st-api/product/product-manage-1003.md
 *   - `ProductNotification`(상품정보제공고시) = object, **필수(Y)**.
 *       `type`(유형코드, string, Y, 예시 "891011")
 *       `item`(항목정보, object[], Y) > `code`(항목코드, Y, 예시 "23759468") + `name`(항목값, Y, 예시 "나일론")
 *   - spec 본문: "아래 첨부파일을 참조 부탁 드립니다." — **41개 상품군 전체 type/item 코드는 외부 첨부파일**이며
 *     우리 docs(`11st-api/`)에는 포함돼 있지 않다(#265 spec import 범위 밖).
 *
 * Edge 미러: apps/api/supabase/functions/_shared/market-adapters/eleven-st-official-notice-groups.ts
 *            (구조 동일 — 동일 군 코드/명칭 집합).
 *
 * ── 데이터 출처 경계 (INTJ: 근거 없는 결정 금지 / 추측 코드 금지) ──────────────────
 * ESM(`esm/official-notice-groups.ts`)은 라이브 API(`/official-notice/groups`)로 41군을 받지만,
 * 11번가는 **type/item 코드 마스터가 spec 첨부파일**이고 조회 API 도 우리 spec 에 없다. 따라서:
 *   1. spec 1003 이 **직접 예시로 확인한 단 1개 군**(`type` "891011", 예시 item `23759468`)만
 *      `docVerified: true` 로 정적 박는다. 그 외 40군은 코드를 **날조하지 않는다**(C4 backlog).
 *   2. 미확보 군은 셀러가 **free-form**(type 직접 입력 + item code/name 직접 입력)으로 채운다
 *      (`OfficialNoticeField` 의 항목 추가 행 + 11번가 전용 자유 type 입력). v1 범위.
 *   3. item `code`/`name` 은 군마다 다르고 첨부파일에만 있으므로, 정적 필수항목(`requiredItemCodes`)은
 *      두지 않는다(빈 배열 = "런타임/free-form 입력" 이지 "항목 없음" 이 아님).
 *
 * UI 값 형태(공용): officialNotice 동적 필드는 ESM 과 동일한 generic 형태
 *   `{ officialNoticeNo: string, details: [{ code, value }] }` 로 marketOptions 에 적재된다
 *   (OfficialNoticeField 재사용 + isMarketOptionValuePresent 공용 완성도 판정).
 *   11번가 `ProductNotification`(`{ type, item:[{code,name}] }`)으로의 변환은 transformProduct
 *   (map.ts `normalizeElevenStOfficialNotice`)가 수행한다 — officialNoticeNo→type, details→item(value→name).
 */

/**
 * 11번가 상품군(ProductNotification.type) 1건 + 우리 측 정적 보강.
 *  - type: 유형코드(string). UI generic 형태의 officialNoticeNo 로 매핑.
 *  - name: 상품군 명칭(셀러 표시용 라벨).
 *  - docVerified: spec 1003 이 type/item 을 직접 예시로 보여준 군인지.
 */
export interface ElevenStNoticeGroup {
  readonly type: string
  readonly name: string
  readonly docVerified: boolean
}

/**
 * 11번가 상품군 마스터.
 *
 * ⚠️ C4 backlog (11st.md §9): spec 1003 의 ProductNotification 41군 type/item 전체 코드는 외부
 *   첨부파일이라 우리 docs 에 없다. **확보된 군은 spec 예시 1개(`891011`)뿐**이며, 나머지는 셀러
 *   free-form 으로 처리한다(코드 날조 금지). 첨부파일/조회 API 확보 시 본 배열을 보강한다.
 *
 * 명칭: spec 예시 항목값이 "나일론"(소재) → 의류/패션 계열 군으로 추정되나, 첨부파일 명칭 표가
 *   없으므로 표시 라벨은 보수적으로 "일반 상품(예시 군)" 으로 둔다(군 명칭 추측 금지).
 */
export const ELEVEN_ST_NOTICE_GROUPS: readonly ElevenStNoticeGroup[] = [
  {
    type: '891011',
    // spec 1003 예시(type 891011 / item 나일론) — 명칭표 미확보라 보수적 라벨.
    name: '일반 상품 (예시 군 · 891011)',
    docVerified: true,
  },
] as const

/** type → 상품군 1건 (O(1) 조회). */
export const ELEVEN_ST_NOTICE_GROUP_BY_TYPE: Readonly<
  Record<string, ElevenStNoticeGroup>
> = Object.fromEntries(ELEVEN_ST_NOTICE_GROUPS.map((g) => [g.type, g]))

/** select 옵션용 — { value, label }[] (frontend 드롭다운 생성). */
export function getElevenStNoticeOptions(): readonly {
  value: string
  label: string
}[] {
  return ELEVEN_ST_NOTICE_GROUPS.map((g) => ({ value: g.type, label: g.name }))
}

/**
 * 확보된 정적 군 외(미확보 41군 중 나머지)를 셀러가 직접 입력할 수 있게 free-form 을 허용한다.
 * OfficialNoticeField 는 이 플래그가 true 면 상품군 select 아래에 "직접 입력(type)" 진입을 노출한다.
 * 11번가는 C4 미확보 군이 대부분이라 항상 true.
 */
export const ELEVEN_ST_NOTICE_ALLOW_FREEFORM = true
