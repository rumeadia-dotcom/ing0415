# 카테고리 조회 — 게이트웨이 경유 lazy cascading (설계)

> 마스터 문서. 2026-05-31 도입. 본 문서가 ground truth.
> 관련: `cross-cutting/market-gateway.md §3` (Edge→GW→마켓 단일 경로) · `features/registration.md §10.5` (s3 3단계 마켓·카테고리) · `cross-cutting/market-adapter.md` (어댑터 인터페이스)

## 1. 배경 · 문제

s3 상품등록 3단계(마켓·카테고리)의 카테고리 select 가 **브라우저에서 마켓 실도메인을 직접 `fetch`** 했다 (`api-gateway.coupang.com` / `api.11st.co.kr` / `sa2.esmplus.com` / `api.commerce.naver.com`). 마켓 API 는 브라우저 origin 에 CORS 헤더를 주지 않으므로 **모든 마켓에서 CORS 차단 → "카테고리를 불러오지 못했습니다"**. CLAUDE.md 함의 제약("프론트 BFF 불가 → Edge Function") + `market-gateway.md §3`("모든 마켓 호출은 Edge→Gateway 경유") 정면 위반.

배송조회(11번가 출고지/반품지, ESM 출하지/발송정책)는 이미 Edge(`eleven-st-shipping-list`/`esm-shipping-list`) 경유로 전환됐으나, **카테고리만 대응 Edge Function 이 없어 클라이언트 직접 호출로 잔존**했다(C3 real 미검증으로 여태 미발견).

### 추가 제약 — 카테고리 규모 차이
- **쿠팡·네이버**: 카테고리 수만 개. 전체 트리 한 번에 다운로드 = 게이트웨이 폭주/타임아웃 + 브라우저 메모리 부담. **부적합.**
- **11번가·ESM**: 전체 트리가 작음(1001 한 방 / site-cats depth 5).

→ 두 규모를 한 인터페이스로 흡수하려면 **부모코드 기준 직계 자식만 조회하는 lazy cascading** 이 유일한 현실적 방법.

## 2. 결정 (확정)

| 항목 | 결정 |
|---|---|
| 조회 경로 | Browser → Edge `markets-category-children` → `gatewayFetch` → Lightsail GW → 마켓 API |
| 조회 단위 | **부모코드 기준 직계 자식만** (lazy). `parentId=null` → 대분류(루트) |
| UI 패턴 | **Cascading 단계별 `<select>`** — 단계 선택 시 다음 단계 children 조회, leaf 선택 = `marketCategoryCode` 확정 |
| v1 동작 마켓 | **쿠팡 · 11번가 · G마켓 · 옥션** (스펙·어댑터 보유) |
| 네이버 | 인터페이스만 연결, 어댑터 `NOT_IMPL` 유지 → `category_not_supported` → UI "준비 중" 안내 (스펙 확보 + 키 발급 후 후속) |
| 캐싱 | 클라이언트 `useQuery` staleTime 1h, key `['registration','category-children', marketId, parentId]` |

## 3. 서버 어댑터 — 신규 메서드 `fetchCategoryChildren`

`apps/api/supabase/functions/_shared/market-adapter.ts` (인터페이스) + 각 `market-adapters/<market>.ts`.

```ts
/**
 * 부모코드 직계 자식 카테고리만 반환 (lazy cascading 용).
 * children 은 비우고 leaf 플래그로 하위 존재만 표시. parentId=null → 루트(대분류).
 * 모든 마켓 호출은 gatewayFetch 경유. hydrate() 선행 필요(11번가 제외 — 키 불필요).
 */
fetchCategoryChildren(parentId: string | null): Promise<CategoryNode[]>
```

`CategoryNode = { id, name, depth, leaf, parentId, children }` (단일 소스 `schemas.ts`). children 은 항상 `[]` (직계만), `leaf=false` 면 클라이언트가 다음 단계 조회.

| 마켓 | 구현 |
|---|---|
| **쿠팡** | `GET .../meta/display-categories/{parentId ?? 0}` → `data.subCategories` 를 CategoryNode[] 로. (네이티브 부모별) |
| **ESM(G/옥션)** | `GET /categories/site-cats`(루트) / `/categories/site-cats/{parentId}`(자식) → children. (기존 lazy 경로 재사용, 재귀 expand 제거) |
| **11번가** | `GET /cateservice/category`(1001 전체, 키 불필요) 1회 → `parentDispNo === (parentId ?? '0')` 필터 → CategoryNode[]. depth=parentId 기준 +1 |
| **네이버** | `throw MarketError('unknown', NOT_IMPL)` 유지 |

> 기존 `fetchCategoryTree()`(연결검증 핑 — 쿠팡 maxDepth=1 등)는 `markets-verify` 가 계속 사용하므로 **유지**. 신규 메서드만 추가(회귀 없음).

## 4. Edge Function `markets-category-children`

`apps/api/supabase/functions/markets-category-children/index.ts`. `esm-shipping-list` 패턴 답습.

**Request** (`POST` body — functions.invoke 규약):
```ts
{ marketId: MarketId, marketAccountId: uuid, parentId?: string | null }
```

**시퀀스**:
1. 셀러 JWT → sellerId (`requireBearer` + `getUserClient`)
2. body 검증 (`RequestSchema`)
3. `market_accounts` ownership 검증 (seller_id 일치 + market_id == marketId) → credential_id
4. `loadCredential(credential_id)` → StoredCredential (11번가는 credential 없어도 진행 — 카테고리 키 불필요)
5. `getMarketAdapter(marketId)` → `adapter.hydrate(cred)` → `adapter.fetchCategoryChildren(parentId ?? null)`
6. `CategoryNodeChildrenResponseSchema.parse({ nodes })` → `ok(200)`
7. 네이버 = `NOT_IMPL` MarketError catch → `HttpErrors.badRequest('category_not_supported', ...)`

**강제**: 모든 마켓 호출 `gatewayFetch` 경유. 토큰/키/PII 로그 금지(sellerId UUID + 노드 개수만). 조회는 멱등.

## 5. zod 스키마

`_shared/schemas.ts` (Edge) + `apps/web/src/lib/schemas/` (클라이언트) 동일 소스 재사용:
```ts
CategoryChildrenRequestSchema  = { marketId: MarketIdSchema, marketAccountId: uuid, parentId: (string|null).optional() }
CategoryChildrenResponseSchema = { nodes: CategoryNodeSchema.array() }
```

## 6. 클라이언트

### 6.1 API + hook
- `features/registration/api/category-api.ts`:
  `fetchMarketCategoryChildren(marketId, marketAccountId, parentId)` → `supabase.functions.invoke('markets-category-children', { body })` + 에러파싱(`esm-shipping-list-api` 패턴: `error.context.clone().json()`).
  **기존 `fetchMarketCategoryTree`(getMarketAdapter().fetchCategoryTree 직접) 제거.**
- `features/registration/hooks/useMarketCategoryChildren.ts`:
  `useMarketCategoryChildren(marketId, marketAccountId, parentId)` — key `['registration','category-children', marketId, parentId]`, staleTime 1h, `enabled` = marketAccountId 존재.
  기존 `useMarketCategoryTree` 제거.

### 6.2 UI — `CategoryCascader`
`features/registration/components/CategoryCascader.tsx` (신규). `MarketOptionsCard` 의 기존 flatten `<select>` 교체.
- 단계 배열 state: `[{ parentId, selectedId }]`. 진입 시 `parentId=null`(대분류) 1단계.
- 각 단계: `useMarketCategoryChildren(marketId, marketAccountId, parentId)` → `<select>` 렌더.
- 선택 시: leaf=false → 다음 단계 추가(자식 조회), leaf=true → `marketCategoryCode` 확정 → `onChange` emit + 이후 단계 제거.
- 상위 단계 재선택 → 하위 단계 reset.
- **4상태**: loading=Skeleton / error=ErrorMessage(접기) / empty(자식 없음 = 사실상 leaf) / data.
- 선택 경로 표시: `대 › 중 › 소` (기존 path UI 유지).

### 6.3 네이버 fallback
`category_not_supported` 에러코드 수신 시 → "네이버 카테고리 조회 준비 중 (API 키 발급 후 지원)" 안내 카드 + 해당 마켓 `blockingReasons` 추가(등록 차단). `ko.ts` 메시지 추가.

### 6.4 클라이언트 web real 어댑터 정리
`apps/web/src/lib/markets/real/<market>/` 의 `fetchCategoryTree` **직접 fetch 제거**(런타임 미사용 + CORS 위반 코드 원천 제거). 관련 단위테스트 정리. (createProduct/fetchOrders 등 다른 미사용 메서드는 본 scope 외 — 별도 트랙.)

## 7. 증상 A — Stepper 라벨 truncate (별개·동반 수정)

`features/registration/components/Stepper.tsx` — 데스크탑에서 5단계 라벨이 연결선(`flex-1`)과 공간 경쟁 + `truncate` 로 "마켓 · 카테고리"만 잘림. 라벨에 `whitespace-nowrap` + 연결선 너비 조정으로 잘림 해소.

## 8. 테스트 (수락 기준)

| 대상 | 케이스 |
|---|---|
| Edge `markets-category-children` | ownership 실패(403) / credential 없음(11번가 제외) / 쿠팡·11번가·ESM children 정상 / 네이버 `category_not_supported` / parentId=null 루트 |
| 서버 어댑터 `fetchCategoryChildren` (parity) | mock=real 동형 — `parity.spec` 4마켓 + 네이버 throw |
| 클라이언트 `category-api` | invoke 성공 / 에러파싱(context.json) / `category_not_supported` 매핑 |
| `CategoryCascader` | 단계 진행(leaf=false 다음단계) / leaf 확정 emit / 상위 재선택 시 하위 reset / 4상태 |
| `Stepper` | (회귀) 라벨 미잘림 — 기존 a11y/렌더 테스트 |
| `flattenCategoryTree` (§10.2) | 중첩 트리 → path_text/path_labels 누적 / 빈 트리 → [] |
| 쿠팡·ESM 순수 파서 (§10.2) | `coupangFullTreeToNodes`/`extractSiteCatList`·`siteCatToCategoryNode` 변환 + 빈/이상 |
| `category-api` 검색/최근 (§10.7) | search ready/building/err/스키마위반 / recent 배열·null·err |
| `CategorySearchBox` (§10.7) | 5상태 + 키보드 ↑↓/Enter + onPick(code, pathLabels) |
| `RecentCategoryChips` (§10.7) | leaf 라벨·title=pathText·클릭 onPick / 0개 null |
| 게이트 | `deno check` 25+ entrypoint green / 전체 vitest pass |

## 9. 비포함 (후속)
- **네이버 카테고리 real 어댑터** — 스펙 확보(`market-api-docs-import` 네이버 커머스 카테고리 API) + 키 발급 후 별도 PR.
- ~~카테고리 검색(autocomplete)~~ → **§10 카테고리 추천 Phase 1 에서 도입**(마켓 검색 endpoint 부재를 전역 인덱스 부분일치로 우회).
- ~~카테고리 서버/DB 캐시~~ → **§10 `market_category_index` 전역 캐시로 도입**.
- 클라이언트 web real 어댑터의 createProduct/fetchOrders 등 미사용 메서드 정리 — 별도 트랙.
- 마켓별 카테고리 자동매핑(PRD §1.2.1) — 현행 수동 선택 유지, v2.

## 10. 카테고리 추천 Phase 1 — 전역 인덱스 + 검색 + 최근 (4마켓, 네이버 제외)

**목표(사용자 편의):** 깊은 cascading 의 수고를 줄인다 — (1) 카테고리명을 타이핑해 leaf 를 바로 찾고, (2) 최근 등록 카테고리를 칩으로 재선택. cascader 는 graceful 폴백으로 유지.
스펙 마스터: `docs/superpowers/specs/2026-05-31-category-recommendation-design.md`.

### 10.1 전역 인덱스 테이블 (마이그 `20260601000001`)
- `market_category_index(market_id, code, name, parent_code, depth, leaf, path_text, path_labels jsonb, updated_at)` PK `(market_id, code)`. 셀러 **무관 전역 1벌**.
- `path_text`(누적 경로 "대 > 중 > 소") 에 **pg_trgm GIN** 인덱스 → 부분일치 검색. `(market_id, leaf)` 보조 인덱스.
- `market_category_index_meta(market_id PK, status, built_at, node_count, source_account_id, error, updated_at)` — 빌드 상태(building/ready/failed).
- RLS: authenticated **읽기 전역**(`using(true)`), 쓰기는 service_role 만(빌드 Edge).

### 10.2 어댑터 `fetchCategoryTreeFull()` (인덱스 빌드용 풀트리, optional)
- `MarketAdapter.fetchCategoryTreeFull?(): Promise<CategoryNode[]>`. 11번가·ESM 은 기존 풀트리 조회(`fetchCategoryTree`)에 위임, 쿠팡은 `/meta/display-categories`(코드 없음) 1콜.
- 네이버는 미구현 → `unsupported`.
- ESM(G마켓·옥션)은 동일 ESM API(site-cats 재귀, JWT site 만 G/A). 순수 파서(`extractSiteCatList`/`siteCatToCategoryNode`)는 Deno 의존 없는 `esm-category.ts` 로 분리(Vitest 회귀). 쿠팡 순수 파서는 `coupang-category.ts`.
- `flattenCategoryTree(marketId, tree)` (`_shared/category-index.ts`, 순수) — 트리 → row(`path_text`/`path_labels` 누적).

### 10.3 빌드 — 공유 헬퍼 + Edge `markets-category-index-build`
- `_shared/category-index-build.ts buildAndUpsertCategoryIndex(svc, marketId, adapter)`: `fetchCategoryTreeFull` → flatten → `delete(market_id)` → chunked insert(1000) → meta(building→ready/failed). 빌드 Edge·검색 인라인이 공유.
- Edge 호출자 2종: (a) 셀러 JWT(marketAccountId 필수 + ownership), (b) service_role/cron(미지정 시 해당 마켓 active account 1개 자동 선택). 11번가는 카테고리 키 불필요(graceful), active account 0개(non-11st)면 `skipped`, naver `unsupported`.

### 10.4 검색 Edge `markets-category-search`
- body `{marketId, marketAccountId, query}`. 셀러 JWT + ownership. user query 의 LIKE 와일드카드(`%_\`) 이스케이프.
- `meta=ready & !stale(<7일)` → 즉시 `.eq(market_id).eq(leaf,true).ilike(path_text,%q%).limit(20)` → `{status:'ready', hits:[{code,name,pathText,pathLabels}]}`.
- miss 시: **11번가·쿠팡(단발 1콜)** = 인라인 빌드 후 검색(`ready`). **ESM(콜 多)** = 빌드 Edge **async 트리거**(`EdgeRuntime.waitUntil`) + `building` 반환(이미 building 이면 재트리거 없이 대기 → 폴링 중복 방지). naver → `unsupported`.

### 10.5 최근 RPC `get_recent_categories(p_market_id)` (마이그 `20260601000002`)
- security invoker + `auth.uid()` 격리. `product_market_mappings` 의 셀러 마켓별 최근 카테고리 distinct 최신순 6개를 `market_category_index` 와 left join 해 라벨/경로 채움(인덱스 미적재 코드는 `code` fallback). 반환 키 = `CategoryHit{code,name,pathText,pathLabels}`.

### 10.6 cron pre-warm (마이그 `20260601000003`)
- `category-prewarm-daily` 매일 03:00, `unnest` 로 4마켓(coupang/11st/gmarket/auction) `markets-category-index-build` 비동기 호출. orders-sync cron 패턴(vault secret graceful, 멱등 unschedule). ESM 콜 비용을 cron + building 폴백으로 흡수 → 셀러 대기 0.

### 10.7 FE
- `category-api.ts`: `fetchCategorySearch`(→`CategorySearchResponse`) + `fetchRecentCategories`(rpc→`CategoryHit[]`). children/search 에러파싱은 `invokeCategoryEdge` 공유.
- 훅: `useCategorySearch`(250ms 디바운스, q≥2 & !naver, `building` 시 4s 폴링), `useRecentCategories`(!naver, staleTime 10m).
- 컴포넌트: `CategorySearchBox`(combobox+listbox, 5상태 idle/loading/building/empty/ready, 키보드 ↑↓/Enter, 옵션 44px), `RecentCategoryChips`(leaf 라벨 칩 6개, title=pathText, 0개 null). `MarketOptionsCard` 가 Cascader 위에 조립, `onPick=setPathLabels+emitMapping` 재사용. `marketId!=='naver'` 가드.
- 스키마 단일 소스: `_shared/schemas.ts` + `apps/web/src/lib/schemas/market.ts` 미러(`CategorySearchRequest/CategoryHit/CategorySearchResponse/CategoryIndexBuildRequest`).

### 10.8 검증 한계
- dev 에 ESM(G마켓·옥션) 테스트 계정 없음 → ESM 순수 파서/flatten 은 단위 테스트(문서 응답 형태), **라이브 빌드·검색은 운영(real) 배포 후 검증**(카테고리 조회+자체 테이블 write 라 운영 안전, 상품등록/마켓변경 없음). 11번가는 키 불필요라 dev 검증 가능, 쿠팡은 dev 계정 유무에 따라.

## 11. 변경 이력
- 2026-05-31 — 도입. CORS 버그 진단 → lazy cascading + Edge 경유 설계. 4마켓 완성 + 네이버 인터페이스만.
- 2026-05-31 — 카테고리 추천 Phase 1(§10): 전역 인덱스(`market_category_index` + pg_trgm) + 빌드/검색 Edge + 최근 RPC + cron pre-warm + FE 검색박스·최근칩. 4마켓(네이버 제외).
