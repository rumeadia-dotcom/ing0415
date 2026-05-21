# s2. 대시보드 — 디자인 리뉴얼 화면 정의

> 이 문서는 외부 디자이너에게 넘기기 위한 **화면 정의 / 기능 / 워크플로우** 정리입니다.
> 실제 디자인(시안·토큰·컴포넌트 스타일)은 본 문서를 입력으로 별도 작업합니다.
> 본 문서는 코드의 현재 동작을 기준으로 작성되었으며, 디자인 변경 시에도 **기능 / 데이터 의존 / 워크플로우 / 상태 분기** 는 그대로 유지되어야 합니다.

---

## 1. 도메인 개요

| 항목 | 내용 |
|---|---|
| 도메인 | `dashboard` (s2) |
| 목적 | 셀러 로그인 직후 진입하는 홈. 등록 현황·최근 등록·마켓 연결 상태를 한눈에 보여주는 **요약 대시보드**. 다른 모든 도메인(s3 등록 / s5 마켓 / s6 이력) 의 진입 허브 역할. |
| 진입 경로 | (1) `s1` 로그인/회원가입 성공 후 → `/dashboard` 자동 진입. (2) 사이드바 "대시보드" 메뉴. (3) `/` 진입 시 `/dashboard` 로 redirect. (4) 404 / 에러 페이지의 "대시보드로" 복귀 동선. |
| user_flow 섹션 | `## s2. 대시보드` (n9~n14) — `docs/spec/user_flow.md`. **n12 "최근 등록 내역"은 v1 에서 "마켓별 주문 현황"으로 의미 변경** (등록은 1회성·s6 이력에서 충분, 주문은 매일 변동 → 대시보드 가치 ↑). |
| PRD 매핑 | §4.1 등록 현황 대시보드 (§4.1.1 실시간 자동 갱신 / §4.1.2 필터·정렬 — 필터는 s6 이력으로 위임 / §4.1.3 접근 권한 — v1 1인 셀러 모델이라 제외) + §6 주문 (대시보드 위젯 형태로 요약 표시) |
| MVP 영향 | **v1 필수**. 첫 로그인 후 즉시 노출되는 화면이라 first-impression 가중치 매우 높음. |
| 레이아웃 컨테이너 | `AppLayout` (사이드바 + 헤더 + 푸터 + Outlet) 내부에서 `<DashboardPage>` 가 main 영역을 채움. 최대 너비 `max-w-[1200px]` 중앙 정렬. |

---

## 2. 화면 목록

| 라우트 | 파일 | 화면명 |
|---|---|---|
| `/dashboard` | `apps/web/src/features/dashboard/pages/DashboardPage.tsx` | 대시보드 (s2 홈) |

> s2 는 **단일 라우트 + 위젯 컴포지션** 구조입니다. n10 등록 현황 요약 KPI / n11 마켓별 통계 / **n12 마켓별 주문 현황 (구 "최근 등록 내역", v1 에서 의미 변경)** 은 각각 별도 라우트가 아니라 한 화면 안의 **카드 위젯**입니다. n13 상세 보기 액션은 마켓 카드 클릭 → `/orders/list?market=<marketId>` 이동, n14 새로고침은 Supabase Realtime 으로 자동화되어 별도 버튼 없음 (PRD §4.1.1).

---

## 3. 화면 상세 — `/dashboard`

### 3.1 메타

| 항목 | 내용 |
|---|---|
| 라우트 | `/dashboard` |
| 파일 | `apps/web/src/features/dashboard/pages/DashboardPage.tsx` |
| 페이지 헤더 | 제목 "대시보드" / 부제 "오늘의 주문과 등록 현황을 한눈에 확인하세요" / 우측 CTA "상품 등록" 버튼 → `/register` |
| 목적 | 등록 현황 KPI · **마켓별 주문 현황** · 마켓 연결 상태를 단일 화면에 요약. 다음 액션(등록 / 주문 처리 / 마켓 재연결) 으로의 분기점. |
| 진입 경로 | s1 인증 성공 / 사이드바 / `/` redirect / 에러 페이지 복귀 |
| user_flow 노드 | n9 (대시보드 main_page), n10 (등록 현황 요약 KPI), n11 (마켓별 통계 — v1 = "마켓 연결 상태" 카드로 대체, 마켓별 막대 차트는 v2), **n12 (마켓별 주문 현황 — v1 에서 "최근 등록 내역" 대체)**, n13 (마켓별 주문 상세 — 마켓 카드 클릭 → `/orders/list?market=<id>`), n14 (새로고침 — Realtime 자동) |
| PRD 근거 | §4.1, §4.1.1, §4.1.2 (필터·정렬은 s6 이력으로 위임) + §6 주문 (요약 위젯) |

### 3.2 기능

1. **KPI 요약** — 4개 숫자 카드 (오늘 등록 / 진행 중 / 7일 성공률 / 평균 소요 7일). 등록 도메인 KPI 유지 — 등록은 1회성이지만 "오늘 얼마나 진행됐는지" 직관 지표로 가치 있음.
2. **마켓별 주문 현황** — v1 정식 4마켓 (네이버 / 쿠팡 / G마켓 / 옥션) 각각 카드 표시. **11번가는 'coming_soon' placeholder** (CLAUDE.md MVP v1 결정).
   - 카드 내용: 마켓 색상 도트 + 마켓명 + **신규 주문 카운트(처리 대기)** + **오늘 주문 총합** + 마지막 동기화 시각 + 동기화 상태 뱃지 (정상 / 동기화 중 / 오류).
   - 카드 클릭 → `/orders/list?market=<marketId>` 필터 적용 진입.
   - "전체 보기" → `/orders`.
3. **마켓 연결 헬스** — 셀러가 연결한 마켓 계정의 상태(정상 / 만료 / 오류) 집계. 만료·오류 ≥1 시 경고 박스 + `/markets` 재연결 링크.
4. **실시간 자동 갱신** — `orders` / `registration_jobs` / `market_accounts` Postgres changes 구독 → TanStack Query cache invalidate. **사용자 수동 새로고침 불필요** (PRD §4.1.1).
5. **빈 상태 hero** — 마켓 0건 OR 주문 0건 분기 (§3.6.empty 참조). KPI 4카드는 항상 유지.
6. **카드 클릭 동선** — 마켓 주문 카드 → `/orders/list?market=<id>` / "전체 보기" → `/orders` / 마켓 헬스 경고 → `/markets` / 헤더 CTA → `/register`.
7. **v2 자리표시** — 마켓별 상세 통계 차트(`<V2PlaceholderCard>`)는 dimmed 카드로 자리만 비워둠.

### 3.3 워크플로우

1. **진입** — `/dashboard` 마운트 → 3개 hook 동시 실행 (`useDashboardSummary` / `useMarketOrdersSummary` / `useMarketHealth`).
2. **로딩 단계** — 각 위젯 독립적으로 skeleton 표시 (서로 블로킹 안 함).
3. **데이터 도착** — 마켓 헬스 카운트(연결된 마켓 수) + 주문 총합으로 빈 상태 분기 (§3.6.empty). 빈 상태 시 본문 영역만 `<DashboardEmptyState>` 로 교체 (KPI 4카드는 유지 = 0건/—).
4. **Realtime 구독** — 세 hook 모두 자체 `supabase.channel(...)` 으로 INSERT/UPDATE 감지 → cache invalidate → 재페치.
5. **상호작용** — 마켓 주문 카드 클릭 → `/orders/list?market=<id>`. 전체 보기 → `/orders`. 헤더 CTA 클릭 → `/register`. 마켓 헬스 경고 클릭 → `/markets`.
6. **에러 처리** — 각 위젯은 독립적으로 error 상태 표시. 화면 전체가 깨지지 않음 (한 위젯 실패가 다른 위젯에 영향 없음).
7. **이탈** — 다른 라우트로 이동 시 hook unmount → Realtime 채널 해제 (`supabase.removeChannel`).

### 3.4 주요 컴포넌트 (위젯 컴포지션)

| 컴포넌트 | 파일 | 역할 | 상태 분기 |
|---|---|---|---|
| `DashboardPage` | `pages/DashboardPage.tsx` | 라우트 컨테이너. 3개 hook 호출 + 레이아웃 조립. | 빈 상태 / 일반 상태 |
| `PageHeader` | `components/layout/PageHeader.tsx` | 공통 페이지 헤더 (제목 + 부제 + 우측 액션 슬롯) | — |
| `SummaryCard` | `components/SummaryCard.tsx` | KPI 단일 카드 (label / value / hint / icon) | loading / data / error / empty |
| `MarketOrdersSummaryCard` | `components/MarketOrdersSummaryCard.tsx` | **(신규)** 마켓별 주문 현황 컨테이너 (Card + grid). 4 마켓 카드 + 11번가 placeholder + "전체 보기" 링크. | loading / data / error / empty |
| `MarketOrderItemCard` | `components/MarketOrderItemCard.tsx` | **(신규)** 단일 마켓 주문 카드 (색상 도트 + 마켓명 + 신규 주문 카운트 + 오늘 총합 + 동기화 상태 뱃지 + 마지막 sync 시각). 카드 클릭 → `/orders/list?market=<id>` | loading / data / error / empty (해당 마켓 0건) |
| `MarketHealthCard` | `components/MarketHealthCard.tsx` | 마켓 연결 상태 (정상·만료·오류 dl). 경고 시 `/markets` 링크 | loading / data / error + 내부 0건 분기 |
| `MarketDotStack` | `components/MarketDotStack.tsx` | 마켓 5개 색상 도트 (활성 마켓 강조) | — |
| `DashboardEmptyState` | `components/DashboardEmptyState.tsx` | 빈 상태 hero CTA. 마켓 0건 / 주문 0건 분기 (§3.6) | — (정적) |
| `V2PlaceholderCard` | `pages/DashboardPage.tsx` 내부 | "마켓별 통계 — v2" dimmed 카드 | — |

### 3.5 데이터 의존

| 위젯 | hook | API | Supabase 소스 | Query Key | staleTime | Realtime 구독 |
|---|---|---|---|---|---|---|
| KPI 4카드 | `useDashboardSummary` | `fetchDashboardSummary` | `rpc_get_dashboard_summary()` (maybeSingle) | `['dashboard', 'summary']` | 30s | `registration_jobs:seller_id=eq.<sellerId>` INSERT/UPDATE/DELETE |
| 마켓별 주문 현황 | `useMarketOrdersSummary` | `fetchMarketOrdersSummary` | **클라이언트 합성** — `orders_with_dispatch_summary.by_market` (신규/대기 카운트) + `orders` today SELECT (오늘 총합) + `market_accounts` (sync 상태·last_verified_at) 세 SELECT 합성. RPC 없음 (Backend OPEN-DSH-007 에서 단일 RPC 합치기 검토). | `['dashboard', 'market-orders']` | 15s | `orders:seller_id=eq.<sellerId>` INSERT/UPDATE/DELETE + `market_accounts:seller_id=eq.<sellerId>` UPDATE (sync 상태) |
| 마켓 헬스 | `useMarketHealth` | `fetchMarketHealth` | `market_accounts.status` SELECT + 클라이언트 groupBy | `['dashboard', 'market-health']` | 60s | `market_accounts:seller_id=eq.<sellerId>` UPDATE |

**zod 스키마 단일 소스**: `apps/web/src/lib/schemas/dashboard-summary.ts` (`DashboardSummarySchema` / `MarketOrdersSummarySchema` (신규) / `MarketHealthSchema`).

**`MarketOrdersSummarySchema` (신규) 형태 (제안)**:
```ts
{
  markets: [
    { marketId: 'naver' | 'coupang' | 'gmarket' | 'auction',
      newOrdersCount: number,            // 처리 대기 (status='new' OR 발송준비)
      todayTotalCount: number,           // 오늘 들어온 총 주문
      lastSyncedAt: string | null,       // ISO 시각
      syncStatus: 'idle' | 'syncing' | 'error',
      syncError: string | null }
  ],
  comingSoon: ['11st']                   // v1 placeholder 마켓
}
```

### 3.6 상태 처리

`partial` 은 RegistrationJob / Dispatch 잡 단일 잡 화면에서만 의미 있는 상태입니다. 대시보드는 **집계**라 카드 단위의 partial 은 없습니다. 단 마켓 카드의 `syncStatus === 'error'` 는 별도 시각 시그널 (붉은 뱃지 + 마지막 성공 sync 시각).

| 위젯 | loading | data | error | empty | 비고 |
|---|---|---|---|---|---|
| `SummaryCard` x4 | `Skeleton h-8 w-20` | 큰 숫자 + 보조 hint | "불러오기 실패" 단문 | "—" 회색 | 카드 4개 동시 표기 (4상태 일치) |
| `MarketOrdersSummaryCard` | 4 카드 스켈레톤 grid | 4 마켓 카드 + 11번가 placeholder | 컨테이너 단문 에러 (role=alert) | "주문이 아직 없어요" 안내 + 마켓 연결 0건이면 `/markets` 링크 우선 | "전체 보기" → `/orders` 링크는 항상 노출 |
| `MarketOrderItemCard` (마켓당) | 카드 스켈레톤 | 카운트 + 동기화 뱃지 | 카드 영역만 단문 에러 (다른 마켓 카드에 영향 없음) | `newOrdersCount=0 && todayTotalCount=0` 시 "신규 없음" 회색 표시 | `syncStatus='error'` 시 붉은 뱃지 + 재인증 유도 (`/markets`) |
| `MarketHealthCard` | 2줄 스켈레톤 | 정상/만료/오류 3분할 dl + 경고 영역 | 단문 에러 (role=alert) | "아직 연결된 마켓이 없어요" + `/markets` 링크 | 만료·오류 ≥1 시 경고, 0 시 "모두 정상" 표시 |
| `DashboardEmptyState` | — | hero CTA 카드 | — | — | (a) 연결 마켓 0건 → "먼저 마켓 연결하기" 강조 / (b) 마켓 ≥1 이지만 주문 0건 + 잡 0건 → "첫 상품을 등록해 보세요" |

### 3.7 접근성

- 페이지 진입 시 H1 = "대시보드" (PageHeader 내부).
- KPI 카드 4개는 grid 로 나란히. 라벨 = `<span>`, 값 = `<div>` 큰 글자. 스크린리더가 "오늘 등록 0건" 순서로 읽도록 label → value 순서 유지.
- 잡 행은 `<Link>` 로 키보드 Tab 동선 들어옴. `focus-visible:ring-2 ring-inset` 적용.
- 스켈레톤은 `role="status"` + `aria-live="polite"` + `aria-label`.
- 에러 단문은 `role="alert"`.
- 마켓 도트는 `<MarketDotStack>` 가 마켓명을 aria-label 로 노출 (시각만 의존 금지).

### 3.8 반응형

| 브레이크포인트 | 레이아웃 |
|---|---|
| ~767px (mobile) | KPI 4카드 = 2×2 grid (`grid-cols-2`). 본문 = 1컬럼 세로 스택 (마켓 주문 현황 → 마켓 헬스 → v2 placeholder). 마켓 주문 카드 = 2×2 grid (네이버/쿠팡/G마켓/옥션) + 11번가 placeholder 하단 1행. 헤더 CTA 풀폭. 사이드바는 햄버거(Sheet 드로어). |
| 768~1199px (tablet) | KPI 4카드 = 4×1. 본문 = 1컬럼 유지 (lg 미만 단일 컬럼). 마켓 주문 카드 = 4×1 grid (마켓별 4카드 가로). |
| 1200px+ (desktop) | KPI 4카드 = `lg:grid-cols-4`. 본문 = `lg:grid-cols-3` 2:1 split (좌 = 마켓 주문 현황 col-span-2 = 2×2 grid 4 마켓 + 하단 11번가 placeholder, 우 = 마켓 헬스 + v2 placeholder 세로 스택). 컨테이너 max-w 1200px 중앙 정렬. |

터치 타겟 ≥ 44×44px 유지 (PRD §5.2): 마켓 카드 클릭 영역 전체 = `min-h-[88px]` 권장, 헤더 CTA / 빈상태 CTA = `size="lg"`.

---

## 4. 위젯 / 카드 인벤토리

| # | 위젯명 | 위치 (desktop) | 데이터 소스 | 갱신 정책 | 클릭 시 이동 | user_flow 노드 |
|---|---|---|---|---|---|---|
| 1 | 오늘 등록 KPI | 상단 1/4 | `rpc_get_dashboard_summary.jobs_today_count` | Realtime + 30s stale | 없음 (정적 KPI) | n10 |
| 2 | 진행 중 KPI | 상단 2/4 | `rpc_get_dashboard_summary.jobs_in_progress_count` | Realtime + 30s stale | 없음 | n10 |
| 3 | 7일 성공률 KPI | 상단 3/4 | `jobs_7d_succeeded / jobs_7d_count` (클라이언트 계산) | Realtime + 30s stale | 없음 | n10 |
| 4 | 평균 소요 7일 KPI | 상단 4/4 | `avg_duration_sec_7d` (`formatDurationSec`) | Realtime + 30s stale | 없음 | n10 |
| 5 | **마켓별 주문 현황** | 좌측 본문 (2/3) | `fetchMarketOrdersSummary()` 클라이언트 합성 (4 마켓: 네이버/쿠팡/G마켓/옥션) | Realtime (orders + market_accounts) + 15s stale | 마켓 카드 → `/orders/list?market=<id>` (n13) / "전체 보기" → `/orders` | n12 / n13 |
| 5a | 11번가 placeholder | 5번 내부 하단 | — (정적, `comingSoon` 배열) | — | 없음 (dimmed) | n12 (v2 본 구현) |
| 6 | 마켓 연결 상태 | 우측 상단 (1/3) | `market_accounts.status` SELECT | Realtime (UPDATE) + 60s stale | 경고 박스 / 0건 → `/markets` | n11 (대체) |
| 7 | 마켓별 통계 v2 (placeholder) | 우측 하단 (1/3) | — (정적) | — | — | n11 (v2 본 구현) |
| 8 | 빈 상태 hero | 본문 전체 (조건부) | 마켓 0건 OR (마켓 ≥1 + 주문 0건 + 잡 0건) | — | (a) 마켓 0건 → `/markets` 강조, (b) 주문/잡 0건 → `/register` 강조 | — |
| 9 | 헤더 CTA "상품 등록" | 페이지 헤더 우측 | — | — | `/register` (s3 진입) | s2 → s3 엣지 |

**새로고침 정책 통일**: 사용자가 명시적으로 호출하는 "새로고침 버튼"은 v1 에 두지 않는다 (n14 액션은 Realtime 으로 자동화 충족). 단 네트워크 장애 후 복구 시 TanStack Query 의 `refetchOnWindowFocus` (기본값) 가 보조 동작.

---

## 5. 도메인 워크플로우

```
[s1 인증 성공] ─▶ /dashboard 진입
                    │
                    ├─ useDashboardSummary        (RPC + Realtime: registration_jobs)
                    ├─ useMarketOrdersSummary     (RPC + Realtime: orders + market_accounts)
                    └─ useMarketHealth            (SELECT + Realtime: market_accounts)
                    │
                    ▼
            [PageHeader 렌더] ─▶ "상품 등록" 버튼 → /register
                    │
                    ▼
            [KPI 4카드 grid 렌더]  (각 카드 독립 4상태)
                    │
            (연결 마켓 0) OR (주문·잡 모두 0) ?
              ├─ YES ─▶ <DashboardEmptyState> ─▶ /markets 또는 /register
              └─ NO  ─▶ 2-column split:
                          ├─ <MarketOrdersSummaryCard>    (좌, 2/3)
                          │     ├─ 네이버 카드 ─▶ /orders/list?market=naver       (n13)
                          │     ├─ 쿠팡 카드   ─▶ /orders/list?market=coupang
                          │     ├─ G마켓 카드  ─▶ /orders/list?market=gmarket
                          │     ├─ 옥션 카드   ─▶ /orders/list?market=auction
                          │     ├─ 11번가 placeholder (dimmed)
                          │     └─ "전체 보기" ─▶ /orders                    (s7)
                          ├─ <MarketHealthCard>            (우 상단, 1/3)
                          │     ├─ 0건 ─▶ /markets (연결 유도)
                          │     └─ 만료/오류 ≥1 ─▶ /markets (재연결)
                          └─ <V2PlaceholderCard>           (우 하단, dimmed, no action)

[Postgres changes] ─▶ Realtime push ─▶ Query invalidate ─▶ 자동 재페치 (n14 충족)
```

**도메인 경계 진입 동선** (s2 → 타 도메인):
- s2 → **s3** 상품 등록: 헤더 CTA / 빈 상태 hero CTA (잡 0건 분기)
- s2 → **s5** 마켓 계정: 마켓 헬스 0건/경고 / 마켓 카드 sync 오류
- s2 → **s7** 주문 현황: 마켓 주문 카드 클릭 (필터 적용) / "전체 보기" (목록)
- s2 → **s6** 등록 이력: 별도 사이드바 메뉴로 진입 (대시보드 위젯에서는 더 이상 직접 진입 동선 없음 — 등록 잡 상세가 필요한 사용자는 사이드바 사용)

---

## 6. 디자인 리뉴얼 시 고려사항

### 6.1 위젯 그리드 반응형

- **데스크탑 2/3 + 1/3 split** 이 유지 구조. 좌측 본문 = 마켓별 주문 현황 (2×2 grid 4 카드 + 11번가 placeholder), 우측 보조 = 마켓 헬스 + v2 placeholder.
- 마켓 카드 4개는 데스크탑에서 2×2 / 모바일에서도 2×2 유지 (마켓이 4개 고정이라 그리드 변화 없음). 11번가 placeholder 는 항상 4 카드 아래 별도 1행.
- 모바일에서는 우측 보조 위젯이 하단으로 내려가는 순서가 자연스러움.
- 마켓 카드 자체의 **시각 hierarchy**: ① 마켓 색상 도트 + 마켓명 → ② 신규 주문 카운트 (큰 숫자) → ③ 오늘 총합 (보조 숫자) → ④ 마지막 sync 시각 + 상태 뱃지 (작은 글자). 디자이너가 순서를 흔들면 "지금 처리할 일" 인지가 흐려짐 → 신규 카운트가 가장 큰 시각 weight.
- v2 placeholder 카드는 우측 하단에 차트 자리 표시 유지.

### 6.2 빈 상태 (empty)

빈 상태 분기는 **2 가지** 입니다 (마켓 주문 도입으로 단순 "잡 0건" 분기보다 정교화 필요):

| 조건 | 우선순위 | hero 메시지 | 주 CTA | 보조 CTA |
|---|---|---|---|---|
| 연결 마켓 0건 | 1 (최우선) | "먼저 마켓을 연결하면 주문이 자동으로 들어옵니다" | "마켓 연결하기" → `/markets` | "상품 등록 둘러보기" → `/register` |
| 마켓 ≥1 + 주문 0건 + 잡 0건 | 2 | "첫 상품을 등록해 보세요" | "상품 등록 시작" → `/register` | "마켓 추가하기" → `/markets` |
| 마켓 ≥1 + 주문 0건 + 잡 ≥1 | — | (빈 상태 hero 표시 안 함) | — | — |

- KPI 4카드는 빈 상태에서도 유지 (PRD §4.1 "한눈에 확인" 가치).
- 마켓 주문 카드 컨테이너는 빈 상태에서도 **placeholder 4 카드** 표시 (회색 + "주문 대기" 문구) — 진입 후 처음 주문이 들어올 때까지의 기대치를 시각적으로 학습시킴.

### 6.3 오버뷰 vs 상세 동선

- 대시보드는 **읽기 전용 오버뷰**. 주문을 직접 조작(발송 처리 / 송장 입력)하는 행위는 모두 `/orders` 또는 `/shipping/dispatch` 에서 일어남.
- 마켓 카드에서 hover 시 "일괄 발송 처리" 같은 액션 버튼을 띄우자는 제안이 나올 수 있으나, **클릭=필터 적용 이동** 단순 인터랙션 유지. 모바일에서 hover 가 없어 동작이 일관되지 않음 → 권장 거부.
- 단 마켓 카드의 `syncStatus === 'error'` 는 카드 자체의 색상 강조(좌측 컬러바·붉은 테두리 등)가 좋은 시그널 — 토큰 활용.
- 신규 주문 카운트가 0 이 아닌 카드는 시각 가중치 ↑ (글자 굵기 또는 카운트 색상 강조). 0 인 카드는 dim 처리해 "지금 처리할 일이 있는 마켓"이 한눈에 들어오도록.

### 6.4 마켓별 통계 시각화 (v1 vs v2)

- v1 의 n11 "마켓별 통계"는 **마켓 연결 헬스 카드**로 축소 구현됨 (정상/만료/오류 카운트). 마켓별 성공률·실패 유형·기간별 추이 차트는 v2 로 보류 (`V2PlaceholderCard` 가 그 자리).
- 디자이너가 v1 시점부터 "마켓별 막대 차트"를 제안할 가능성 높음 → v1 범위 아님을 분명히 차단. 단 placeholder 카드 자체의 **dimmed 비주얼**(차트 자리 예시 + "v2 예정" 뱃지)은 사용자에게 로드맵을 시그널링하므로 유지 권장.
- v2 진입 시 placeholder 위치(우측 하단)와 동일한 자리에 막대 차트가 들어가는 가정으로 디자인. 그 영역의 **세로 높이가 너무 작으면 차트 시안과 충돌**할 수 있어 디자이너에게 미리 고지.

### 6.5 실시간 갱신 시각 시그널

- 현재는 데이터가 조용히 갱신됨 (스피너·플래시 없음). 사용자가 "방금 새 주문이 들어왔다" 를 인지하기 어려울 수 있음.
- 디자이너에게 **변경 시 짧은 강조** 추가 검토 요청: (a) 신규 주문 카운트 증가 시 카드 1초 강조 색, (b) sync 상태가 `syncing → idle` 전이 시 마지막 sync 시각 fade-in, (c) KPI 숫자 증가 시 1초 강조.
- 과도한 애니메이션은 WCAG `prefers-reduced-motion` 존중 필요.
- 청각·시각 모두 없이는 인지 어려운 케이스 → 브라우저 탭 타이틀에 "(N)" 신규 카운트 표시 검토 (모바일·백그라운드 인지용).

### 6.6 컨테이너 최대 너비

- 현재 `max-w-[1200px]` 중앙 정렬. 24인치 이상 모니터에서는 좌우 여백이 크다는 피드백 가능성. 마켓 카드 grid 가 가로로 늘어나면 카드당 너비 과대로 가독성 저하 → 최대 너비 유지 권장.

### 6.7 KPI 카드 표기 일관성

- `formatDurationSec` 으로 "Xm Ys" 포맷. 디자인 리뉴얼 시 단위 표기를 큰 글자(숫자) + 작은 글자(단위) 로 분리할지, 현재처럼 일체형으로 둘지 결정 필요.
- "—" placeholder (집계 데이터 없음) 와 0 의 시각적 구분이 약함. 디자이너에게 두 상태를 색상·굵기로 구분하는 시안 요청.

### 6.8 마켓 카드 색상 표준

- 마켓 카드 좌측 색상 도트는 **CLAUDE.md "프로토타입 (legacy v0)" 의 마켓 색상 표준** 준수:
  - 네이버 `#03C75A` / 11번가 `#FF0038` / G마켓 `#00B147` / 옥션 `#E73936` / 쿠팡 `#F11F44`.
- 디자이너가 마켓 카드 배경색에 마켓 컬러를 옅게 깔자고 제안할 수 있으나, 5개 마켓 동시 노출 시 색 충돌 → **도트와 카드 좌측 보더만 컬러, 배경은 중성색** 권장.
- 11번가 placeholder 는 마켓 컬러 사용 금지 (회색 + "오픈 준비중" 뱃지).

### 6.9 s7 OrdersDashboardPage 와의 경계

- s7 도메인에는 별도의 **`OrdersDashboardPage` (라우트: `/orders` index)** 가 존재 — 주문 도메인의 자세한 대시보드. s2 의 "마켓별 주문 현황" 위젯은 더 압축된 형태 (마켓별 카드만).
- 디자이너에게 두 화면의 정보 밀도 차이 명확히 전달 필요:
  - **s2 위젯** = "지금 마켓별로 처리할 일이 얼마나 있나" 4 카드 + 동기화 상태.
  - **s7 OrdersDashboardPage** = 주문 도메인의 KPI / 차트 / 기간별 트렌드 (s7-orders.md 참조).
- s2 위젯의 "전체 보기" 링크 destination: `/orders` (= s7 OrdersDashboardPage). 마켓 카드 클릭 destination: `/orders/list?market=<id>` (= OrdersListPage 필터 적용).

---

## 7. 작업 시 참조 파일

- 코드 구현: `apps/web/src/features/dashboard/` (pages / components / hooks / api) — **신규**: `MarketOrdersSummaryCard`, `MarketOrderItemCard`, `useMarketOrdersSummary`
- 주문 도메인 코드: `apps/web/src/features/orders/` (s2 위젯이 참조하는 orders 데이터)
- zod 스키마: `apps/web/src/lib/schemas/dashboard-summary.ts` (`MarketOrdersSummarySchema` 신규)
- 라우팅: `apps/web/src/app/router.tsx` (`/dashboard` 등록)
- 레이아웃: `apps/web/src/app/layouts/AppLayout.tsx`
- 영구 설계: `docs/architecture/v1/features/dashboard.md` (§3.3 fetchMarketOrdersSummary 조립 로직 / RLS 정책 / 빈 상태 2분기)
- 마이그레이션: `apps/api/supabase/migrations/20260521000011_drop_seller_recent_jobs.sql` (구 RPC/view 제거)
- s7 주문 도메인 정의: `docs/design-renewal/s7-orders.md` (OrdersDashboardPage / OrdersListPage 와의 경계 §6.9)
- 요구사항: `docs/spec/PRD.md` §4.1 + §6 (주문)
- 플로우: `docs/spec/user_flow.md` `## s2. 대시보드` + `## s7. 주문 현황`
- 시각 레퍼런스 (v0): `docs/legacy/prototype-v0/screens/dashboard.jsx` + `styles.css` (디자인 토큰만 참고)
