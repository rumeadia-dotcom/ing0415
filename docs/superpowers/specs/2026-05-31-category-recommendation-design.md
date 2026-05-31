# 카테고리 추천(최근 사용 + 타이핑 검색) 설계

> 작성: 2026-05-31 · 도메인: s3 상품 등록 3단계(마켓·카테고리) · 상태: 설계 승인 완료, 스펙 검토 대기
> 상위 원칙: CLAUDE.md `## Rules` → **설계 원칙 — 사용자 편의 우선**. 본 설계의 모든 결정은 "셀러가 깊은 카테고리 트리를 매번 끝까지 파지 않고, 적은 수고로 정확한 leaf 를 고르게" 하는 것을 최우선으로 한다.

## 1. 배경 / 문제

s3 3단계의 마켓별 카테고리 선택은 단계별 cascading 드롭다운(`CategoryCascader`)으로만 가능하다. 쿠팡·11번가 트리는 5~6단계로 깊어 매 상품마다 끝까지 파야 하고, 같은 카테고리를 반복 등록하는 셀러도 매번 처음부터 드릴해야 한다. 사용자 피드백(2026-05-31): "카테고리 너무 많아서 선택하기 힘들다 / 최근 등록한 카테고리가 추천으로 떴으면 / 텍스트로 칠 때마다 추천이 떴으면".

추가로, 현재 cascader 자체에 마켓별 버그가 있어(아래 Phase 0) 선행 수정이 필요하다.

## 2. 범위 / 단계

본 작업은 두 단계로 분리한다. 각 단계는 별도 PR/구현 계획으로 진행한다.

- **Phase 0 — cascader 버그 수정 (선행, 별도 PR)**: 카테고리 fetch 계층이 5개 마켓에서 정상 동작하도록 고친다. Phase 1 의 전제.
- **Phase 1 — 카테고리 추천 (이번 기능)**: 카테고리 인덱스 + 타이핑 검색 + 최근 카테고리.

비범위(YAGNI): 네이버 카테고리 검색·최근(카테고리 조회 자체 미구현이므로 제외). 카테고리 즐겨찾기/핀(별도 기능). 마켓 간 카테고리 자동 매핑 추천(AI 매핑은 v2+).

---

## 3. Phase 0 — cascader 버그 수정

근거 진단(2026-05-31, 공식 스펙 원문 + 어댑터 코드 대조):

### 3.1 쿠팡 — root 부터 카테고리가 안 나옴 (응답 필드명 미스매치)
- 실제 쿠팡 `GET .../display-categories/{code}` 응답(`카테고리-조회.md` / `카테고리-목록조회.md`): 자식 = `child`, 코드 = `displayCategoryCode`(예시 JSON 은 `displayItemCategoryCode`), 이름 = `name`, **`isLeafCategory` 필드 없음**.
- 어댑터 `coupang-category.ts` 의 `coerceCoupangCategory` 는 `categoryId`/`displayCategoryName`/`isLeafCategory`/`subCategories` 를 읽음 → 전부 미스 → 빈 배열 → `CategoryCascader` 가 "하위 카테고리가 없습니다" 표시.
- per-code 응답은 1-depth 자식만 주고 각 자식의 `child` 는 항상 `[]`(2-depth 미표시) → 응답만으로 자식의 leaf 판정 불가.

**수정**:
- `coupang-category.ts` 파싱을 `child[]` + (`displayCategoryCode ?? displayItemCategoryCode`) + `name` 으로 재작성. `/0` 호출이 최상위 카테고리를 정상 반환하므로 root 부터 나온다.
- 자식 노드의 leaf 는 응답으로 알 수 없으므로 `leaf=false`(드릴 가능)로 두고, 실제 leaf 판정은 §3.3 의 "드릴 결과 자식 0개 → 부모 자동 확정"이 담당.

### 3.2 11번가 — 끝까지 골라도 "선택 필요" (lazy 드릴이 1617 아닌 1001 반복)
- `leafYn` 의미는 코드가 스펙대로 맞음(`category-1001.md`: `N`=말단, `Y`=하위있음).
- 그러나 `eleven-st.ts`의 `fetchCategoryChildren` 가 parentId 와 무관하게 항상 `buildElevenStCategoryUrl()`(=1001 전체)만 호출하고 트리에서 직계만 슬라이스. 1001 은 깊은 레벨에서 끊겨, `leafYn=Y`(non-leaf)인데 1001 에 자식이 없는 경계 노드를 만나면 `›` 표시 → 선택 시 다음 단계 추가 → 또 빈 배열 → `onChange('')` 영구 미확정 → "선택 필요". (주석의 "부모별 직계 조회 endpoint 가 없어"는 사실 오류 — 1617 `/cateservice/category/{dispCtgrNo}` 가 그 endpoint.)

**수정**:
- `fetchCategoryChildren(parentId)` 가 비-root 일 때 `buildElevenStCategoryUrl(parentId)`(1617)를 호출하도록 변경. root(parentId=null)는 1001 유지. 1617 은 1001 이 빠뜨린 깊은 레벨과 정확한 `leafYn` 을 포함하므로 끝까지 확정된다. 잘못된 주석 정정.

### 3.3 CategoryCascader 견고성 — 자식 0개 → 부모 자동 확정 (공통)
- 현재 `CategoryCascader` 의 empty 분기는 안내문만 띄우고 부모 선택을 확정하지 않음 → non-leaf 인데 자식이 비는 모든 케이스가 dead-end.

**수정**:
- 비-root 단계의 직계 자식 조회 결과가 0개면, 직전 단계에서 선택된 부모 노드를 leaf 로 간주해 `onChange(parentNodeId, pathLabels)` 로 **자동 확정**한다(empty 안내는 "현재 선택이 최하위 분류" 로 유지하되 미확정 상태로 두지 않는다). 쿠팡의 "드릴 → 빈 child = 말단" 모델과 정합.
- root(첫 단계) 결과가 0개면 확정 대상 부모가 없으므로 기존 안내만(진짜 빈 카테고리/에러 방어).

### 3.4 Phase 0 테스트
- BE 단위: 쿠팡 `child`/`name`/`displayCategoryCode` 파싱(루트 15개 정상 매핑), 11번가 1617 드릴(깊은 leaf 까지 확정), mock↔real parity.
- FE 단위: CategoryCascader "자식 0개 → 부모 자동 확정" 1 pass + 1 fail(root 0개는 확정 안 함).

---

## 4. Phase 1 — 카테고리 추천

### 4.1 데이터 모델

전역 캐시 테이블(셀러 무관, 마켓 공통 1벌). 카테고리 트리는 모든 셀러에게 동일하므로 per-seller 가 아닌 전역으로 둔다.

```sql
create table public.market_category_index (
  market_id   text not null,            -- 'coupang' | '11st' | 'gmarket' | 'auction'
  code        text not null,            -- leaf 포함 모든 노드 코드
  name        text not null,
  parent_code text,
  depth       int  not null,
  leaf        bool not null,
  path_text   text not null,            -- "패션의류잡화 > 여성패션 > 여성의류 > 티셔츠"
  path_labels jsonb not null,           -- ["패션의류잡화","여성패션","여성의류","티셔츠"]
  updated_at  timestamptz not null default now(),
  primary key (market_id, code)
);

create table public.market_category_index_meta (
  market_id        text primary key,
  status           text not null,       -- 'building' | 'ready' | 'failed'
  built_at         timestamptz,
  node_count       int,
  source_account_id uuid,               -- 빌드에 사용한 market_accounts.id (감사용)
  error            text
);
```

- `pg_trgm` 확장 활성 + `market_category_index(path_text gin_trgm_ops)` / `(name gin_trgm_ops)` GIN 인덱스 → ILIKE 검색 가속. `(market_id, leaf)` 보조 인덱스.
- **RLS**: 두 테이블 모두 카테고리는 공개 정보이므로 `select` 는 authenticated 전역 허용. `insert/update/delete` 는 service_role(Edge)만. (RLS 없는 테이블 거부 룰 충족 — 읽기 전역 허용 정책을 명시적으로 둔다.)
- **최근 라벨 복원**: `product_market_mappings.market_category_code` ⋈ `market_category_index (market_id, code)` join 으로 `path_labels` 복원. → 기존 테이블에 컬럼 추가 불필요(코드만 저장하는 현 구조 유지).

### 4.2 백엔드

#### 인덱스 빌드 — `markets-category-index-build` (Edge)
- 입력 `{ marketId, marketAccountId }`. 해당 마켓 트리를 평탄화해 `market_category_index` upsert + meta 갱신.
- 11번가(1001 1콜)·쿠팡(풀트리 endpoint 1콜)은 단발 완결.
- **ESM(gmarket/auction)**: 게이트웨이 콜이 많아 top-level 분할 **재개 가능 빌드**. meta 에 진행상태 적재. Edge timeout 내 미완결 시 다음 트리거가 이어받음(resumable).
- 트리거: **cron pre-warm 우선**(아래) + lazy fallback(검색 시 meta stale(>7일) 또는 missing 이면 백그라운드 빌드 큐잉).

#### ESM pre-warm (cron) — 사용자 편의 우선 결정
- lazy-only 면 첫 ESM 검색 셀러가 대기한다(편의 저하). 따라서 **ESM 인덱스를 cron 으로 미리 데워둔다** → 어떤 셀러도 검색에서 기다리지 않는다. lazy 는 cron 실패 시 fallback.
- cron 은 연결된 ESM 계정 중 하나의 자격증명으로 빌드(카테고리는 마켓 공통). 연결 계정이 0개면 skip(검색 시 lazy).
- 11번가·쿠팡도 동일 cron 에 포함(단발이라 비용 낮음). 갱신 주기 7일.

#### 검색 — `markets-category-search` (Edge)
- 입력 `{ marketId, query }`(query ≥ 2자). `market_category_index` 에서 `leaf = true AND path_text ILIKE '%query%'` 상위 20개 → `{ code, name, path_text, path_labels }`.
- meta.status ≠ 'ready' 면 `{ status: 'building' }` 류 응답 → 프론트가 "색인 준비 중" 표시(graceful).
- zod 스키마 FE/BE 공유(`apps/web/src/lib/schemas/`).

#### 최근 — `get_recent_categories` (RPC)
- 입력 `p_market_id`. 호출 셀러의 `product_market_mappings` 에서 `market_category_code` distinct, `created_at desc`, **6개**. `market_category_index` join 으로 `path_labels` 동봉. `security invoker` + `seller_id = auth.uid()` 격리.
- 인덱스에 없는 과거 코드는 path_labels null → 프론트는 코드만 표시(fallback).

### 4.3 프론트엔드 (A안 — cascader 위에 얹기)

`MarketOptionsCard` 의 카테고리 영역 상단에 추가(기존 `CategoryCascader` 는 그 아래 유지):

1. **검색 입력**: 디바운스 250ms, `markets-category-search` 호출. 결과 리스트는 `path_text` 표시. 항목 클릭 → `marketCategoryCode = code`, `pathLabels = path_labels` 확정.
2. **최근 칩 6개**: `get_recent_categories` 결과를 `경로 > leaf` 라벨 칩으로. 클릭 → 동일하게 확정.
3. **CategoryCascader**: 그대로 유지(fallback / 미세조정). 검색·칩으로 확정 시 cascader 도 그 경로로 sync(가능하면) 하거나 확정 표시.
4. shadcn/ui 컴포넌트 사용(`Input`, 결과 리스트/칩은 기존 토큰). 검색은 "검색/필터류"(즉시 갱신, variant 구분).

상태: `loading / data / error / empty(검색 무결과) / building(색인 준비 중)`. WCAG 2.1 AA — 검색 입력 `aria-label`, 결과 리스트 키보드 이동(↑↓/Enter), 칩 44×44px, 대비 4.5:1. i18n `locales/ko.ts` path 참조(하드코딩 금지).

### 4.4 에러 / 엣지 (사용자 관점 복구 경로 포함)
- 인덱스 building/stale: 검색칸은 "카테고리 색인 준비 중 — 잠시 후 가능, 아래에서 직접 선택하세요" 안내 + cascader 그대로 사용 가능(기능 저하 graceful).
- 검색 무결과: "일치하는 카테고리 없음 — 단어를 줄이거나 직접 선택" 안내(막다른 길 금지).
- 최근 0건(신규 셀러): 최근 칩 영역 숨김(빈 칩 노출 안 함).
- 네이버: 검색·최근 미노출.
- 빌드 실패(meta.failed): 검색칸 숨기고 cascader 폴백 + Sentry 알림.

### 4.5 테스트
- BE: 인덱스 빌드 평탄화(마켓별 parity — mock↔real), 검색 ILIKE(leaf-only·상위 20), 최근 RPC(소유권 격리 1 pass + 타 셀러 격리 1 fail), ESM resumable 빌드 진행상태.
- FE: 검색 디바운스·선택→코드 확정, 최근 칩 렌더·선택, 5상태(building 포함). 신규 라우트 없음(기존 s3 카드 내 — a11y ROUTES 추가 불필요, 단 카드 단위 axe 회귀).
- pgTAP: `market_category_index` / `_meta` RLS(읽기 전역 허용·쓰기 service_role 한정), `get_recent_categories` 격리.
- 골든패스: s3 카테고리 선택이 검색·최근 경로로도 통과하는지 회귀(기존 cascader 경로 유지).

## 5. 컴포넌트 경계 / 단일 책임
- `category-index` 빌드 로직(평탄화)은 어댑터별 순수 함수로 분리(Deno 의존 0 → Vitest 회귀). 어댑터의 트리 fetch 와 분리.
- 검색/최근 API 클라이언트는 기존 `features/registration/api/category-api.ts` 에 추가(`fetchCategorySearch`, `fetchRecentCategories`) — 단일 진입점.
- 프론트 UI 는 `CategorySearchBox`, `RecentCategoryChips` 신규 컴포넌트로 분리하고 `MarketOptionsCard` 가 조합.

## 6. 미해결 / 리스크
- **ESM 빌드 비용 (2026-05-31 재조사로 하향)**: 당초 "전체 트리 노드당 1콜 → 수백 콜"로 봤으나, 문서 재확인 결과 더 싼 경로가 있음 → resumable 백그라운드 잡 불필요 가능성 큼.
  - **옥션**: 정적 전체 카테고리 XML `https://script.auction.co.kr/category/categories.xml` (인증 불필요, 트리 `ID/Name/Level/IsLeaf`) → 사실상 1콜. (probe 상 의류 위주만 보였으나 fast-model 절단 가능성 — 1B 첫 단계에서 완전성·총 노드수 확정.)
  - **G마켓**: 단일 벌크 다운로드 없음. 단 `GET /categories/sd-cats/{sdCatCode}/site-cats/full-depth`(전체 깊이 한 번에, product/13.md)로 상위 카테고리당 서브트리 통째 수집 → 노드당 1콜이 아니라 **대분류 수만큼(수십 콜)**. (구 `site-cats/{code}` 재귀가 "수백 콜"의 원인이었음.)
  - 1B spike 검증 항목: 옥션 XML 완전성·게이트웨이 호스트(`script.auction.co.kr`) 허용 또는 직접 fetch, G마켓 `full-depth`를 루트/대분류에서 호출 가능한지, 두 site 의 site-cats 트리 분리(JWT ssi `A`/`G`).
  - 결론: ESM 도 11번가·쿠팡처럼 **단발성 빌드(옥션 XML + G마켓 full-depth 루프)** 로 충분할 가능성 → cron pre-warm 은 "있으면 좋은" 최적화로 격하, 필수 아님.
- 인덱스 갱신 주기 7일 동안 마켓이 카테고리를 바꾸면 stale — 검색 결과 코드가 등록 시점에 거부될 수 있음. 등록 단계의 마켓 필수필드 검증이 최종 방어선(기존). 필요 시 주기 단축.

## 7. 2개 산출물 동기화 대상 (구현 시)
- 설계문서: `docs/architecture/v1/features/category-sync.md`(또는 registration.md) — 데이터 모델·API 시그니처 반영. `docs/design-renewal/s3-*.md` — 검색/최근 UI 정의.
- `docs/spec/user_flow.md` — s3 카테고리 노드에 "검색/최근 선택" 진입 보조 경로(신규 화면 아님, 보조 인터랙션) 주석.
- 구현: `apps/web/src/features/registration/`(UI·hook·api) + `apps/api/supabase/`(migration·functions·rpc).

## 8. 수락 기준 (요약)
- [ ] Phase 0: 쿠팡 root 부터 카테고리 노출 / 11번가 깊은 leaf 까지 "매핑 완료" 확정 / cascader 자식 0개 시 부모 자동 확정.
- [ ] Phase 1: 5개 중 4개 마켓(네이버 제외)에서 타이핑 검색으로 leaf 직접 선택 가능, 검색 대기 없음(ESM 포함 pre-warm).
- [ ] 마켓 카드별 최근 6개 칩(최근순) 노출·선택 시 즉시 확정·읽을 수 있는 경로 라벨.
- [ ] graceful 저하(building/실패/무결과)에서 cascader 폴백으로 항상 등록 가능.
- [ ] 테스트(BE/FE/pgTAP/골든패스) 통과, no-explicit-any/lint/typecheck green.
