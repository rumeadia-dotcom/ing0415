# s6 등록 이력 — 디자인 리뉴얼 화면 정의

> **목적**: 외부 디자이너에게 넘길 **화면 정의 / 기능 / 워크플로우** 정리. 디자인 작업은 본 문서를 받는 디자이너 트랙에서 진행.
> **금지**: 본 문서에서는 시각 디자인(색·여백·타이포·구체적 컴포넌트 룩)을 결정하지 않는다.
> **소스 오브 트루스**:
> - `docs/spec/PRD.md` §4.3 (재시도·제외) / §4.4 (이력 검색·통계·내보내기)
> - `docs/spec/user_flow.md` s6 (n41~n46)
> - `docs/architecture/v1/features/history.md` (데이터·API·zod·테스트 매트릭스)
> - `apps/web/src/features/history/` (현재 v1 구현)

---

## 1. 도메인 개요

### 1.1 목적

셀러가 **과거 등록 잡 전체** 를 조회·필터·상세 추적하고, partial/failed 잡에서 **재시도 또는 마켓 제외 후 재등록** 을 같은 화면에서 트리거할 수 있도록 한다. 등록(s3) 결과 흐름의 사후 보정 진입점이며, 대시보드(s2)·등록 결과(s3 n21)의 후속 경로다.

### 1.2 진입 경로

| 진입원 | 경로 | 비고 |
|---|---|---|
| 글로벌 사이드바 "이력" | `/history` | 1차 진입 |
| 대시보드 최근 등록 카드(n12) | `/history/:jobId` | 직링크 |
| 등록 결과 페이지(n21) | `/history/:jobId` | "이력으로 이동" |
| 알림 토스트(재시도 결과) | `/history/:jobId` | 부분 실패 알림에서 deep link |

### 1.3 user_flow 매핑

| user_flow 노드 | 의미 | 구현 |
|---|---|---|
| n41 등록 이력 (main_page) | 도메인 루트 | `/history` |
| n42 이력 목록 (page) | 필터 + 리스트 | `HistoryListPage` |
| n43 이력 상세 (page) | 잡 메타 + 마켓 결과 | `HistoryDetailPage` (탭 `result`) |
| n44 오류 분석 (page) | 에러 모음 | `HistoryDetailPage` (탭 `errors`) |
| n45 기간별 필터 (action) | preset + custom | 필터 사이드바 |
| n46 마켓별 필터 (action) | 5 마켓 다중 선택 | 필터 사이드바 |

### 1.4 PRD 매핑

| PRD | 요구사항 | v1 구현 |
|---|---|---|
| §4.3.1 | 오류 수정 후 즉시 재시도 | 상세 화면 "재시도" (단일·전체) |
| §4.3.2 | 오류 마켓 제외 후 나머지 일괄 등록 | 상세 화면 "제외 후 재등록" → 새 잡 분기 |
| §4.4.1 | 이력 상세 검색 (다중 조건) | 기간/마켓/상태/검색어 4종 필터 |
| §4.4.2 | 오류 유형별 통계 차트 | **v2 carry-over** (error_code 분포 안정화 후) |
| §4.4.3 | CSV/Excel 내보내기 | **v2 carry-over** (PII 외부 노출 정책 미정) |

---

## 2. 화면 목록

| 라우트 | 파일 | 화면명 |
|---|---|---|
| `/history` | `apps/web/src/features/history/pages/HistoryListPage.tsx` | 등록 이력 목록 |
| `/history/:jobId` | `apps/web/src/features/history/pages/HistoryDetailPage.tsx` | 등록 이력 상세 (탭: 결과 / 에러) |

---

## 3. 화면별 상세

### 3.1 HistoryListPage — `/history`

#### 라우트 / 파일
- **라우트**: `/history?period=&from=&to=&market=&status=&q=&cursor=&cursorId=&pageSize=`
- **파일**: `apps/web/src/features/history/pages/HistoryListPage.tsx`

#### 목적
잡 전체 리스트를 4종 필터(기간 / 마켓 / 상태 / 검색어)로 좁혀 보고, 각 행에서 상세로 진입할 수 있게 한다. URL search params 가 필터의 단일 ground truth (뒤로가기·새로고침·딥링크 호환).

#### 진입 경로
- 사이드바 "이력" 메뉴
- 대시보드의 "이력 더보기"
- 등록 결과 화면 "이력으로 이동"
- 알림 toast 의 "이력 보기"

#### 기능
1. 좌측 필터 사이드바 (데스크탑) / 모바일은 bottom sheet
2. 우측 목록 영역 (PageHeader + 총 개수 + 행 N개 + 페이지네이션 / "더 불러오기")
3. 행 클릭 → `/history/:jobId` 이동
4. 필터 변경 시 URL params 갱신 → TanStack Query 키 변화 → refetch
5. Realtime 수신 (현재 가시 페이지 내 잡 UPDATE 시 행 패치)
6. partial 잡은 좌측 컬러 바 + "N성공 / M실패" 카운트 + retry 카운트 표시
7. failed 잡 중 자식 재등록 잡이 있으면 "재등록 N건 있음" 링크
8. v2: CSV/Excel 내보내기 버튼 자리만 확보 (`carry-over`)

#### 워크플로우

```
사이드바 "이력" 클릭
  ↓
URL: /history?period=30d (기본)
  ↓
RPC list_registration_jobs(filter)
  ↓
loading → data | empty | error
  ↓
[행 클릭] → /history/:jobId
[필터 변경] → URL params 갱신 → refetch
[더 불러오기] → cursor 갱신 → 다음 페이지 append
[필터 초기화] → URL params 제거 → 기본(30d) 로 복원
```

#### 주요 컴포넌트 (현재 구현)

| 컴포넌트 | 책임 |
|---|---|
| `PageHeader` | 제목 + 부제 (총 N건 / 표시 중 M건) |
| `HistoryFilterSidebar` | 4종 필터 + 적용/초기화 |
| `HistoryListTable` | 행 리스트 + 페이지네이션 + 로딩/에러 상태 |
| `HistoryEmptyState` | 절대 빈 상태 vs 필터 결과 0건 구분 |
| `HistoryListRow` | 단일 행 (썸네일 + 상품명 + 상태 뱃지 + 마켓 스택 + 타임스탬프 + 상세 링크) |

#### 데이터 의존
- Postgres RPC `list_registration_jobs` (cursor 페이지네이션 + total_count)
- zod 스키마 `jobSummarySchema` (`apps/web/src/lib/schemas/history.ts`)
- TanStack Query key `['history', 'list', filter]`
- Realtime 채널 `seller-jobs-list-{sellerId}` (history 화면 한정 구독)

#### 상태 처리 (4상태)

| 상태 | 표시 |
|---|---|
| `loading` | Skeleton 행 5개. 필터 사이드바는 즉시 인터랙티브 |
| `data` | 행 N개. partial 잡은 좌측 컬러 바 + 카운트 |
| `error` | 중앙 `ErrorMessage` + "다시 시도" 버튼 |
| `empty` | 절대 빈(잡 0건) → "상품 등록하러 가기" CTA / 필터 결과 0건 → "필터 초기화" CTA — 2가지 구분 |

#### PRD 근거
PRD §4.4.1 (이력 상세 검색 + 다중 조건 필터링) — v1 핵심.

#### user_flow 노드
n41, n42, n45, n46.

---

### 3.2 HistoryDetailPage — `/history/:jobId`

#### 라우트 / 파일
- **라우트**: `/history/:jobId?tab=result|errors`
- **파일**: `apps/web/src/features/history/pages/HistoryDetailPage.tsx`

#### 목적
단일 잡의 메타(상태·타임스탬프·retry·부모/자식 잡)와 마켓별 결과(N개)를 보여주고, **재시도 / 마켓 제외 후 재등록** 액션을 트리거한다. partial 의 손실 회피 UX (실패 카드 1차 배치) 가 디자인 핵심.

#### 진입 경로
- 목록 행 클릭
- 대시보드 최근 등록 카드
- 등록 결과 화면(n21) "이력으로 이동"
- 알림 toast (부분 실패 알림 → deep link)

#### 기능
1. 잡 메타 헤더 — 썸네일 + 상품명 + 상태 뱃지 + created/completed + retry_count + correlation_id(debug 모드만)
2. 부모/자식 잡 링크 — `parent_job_id` 있으면 "부모 잡 보기", `children` 있으면 "하위 재등록 잡 N건 → 보기"
3. 탭 — "결과" / "에러 (N)" 2탭 (URL `?tab=` 동기화)
4. 마켓 결과 카드 N개 — 카드별 상태 뱃지, externalId, productUrl, errorCode/errorMessage(긴 메시지는 `ErrorMessage` 로 접힘), 시도 횟수, 마지막 시도 시각, **단일 마켓 재시도 / 단일 마켓 제외** 버튼
5. 하단 액션 — `[전체 실패 마켓 재시도]` / `[제외 후 재등록]` / `[전체 잡 취소]` (취소는 진행 중 잡만)
6. Realtime 수신 — `registration_jobs.status` / `registration_job_market_results.market_status` 변경 시 자동 패치
7. partial 시각화 — 헤더 partial 뱃지 + 실패 카드 1차 배치, 성공 카드는 보조 배치

#### 워크플로우

```
/history/:jobId 진입
  ↓
RPC get_registration_job(jobId)
  ↓
loading → data | error | empty(notFound/forbidden)
  ↓
[이 마켓만 재시도] → confirm dialog → registration-retry({jobId, marketResultIds:[id]})
                                       → loading toast → Realtime 으로 retrying/running/완료 수신
[전체 실패 마켓 재시도] → confirm → registration-retry({jobId}) (marketResultIds 생략)
[이 마켓 제외하고 재등록] → 마켓 선택 Sheet/Dialog
                          → registration-start({productId, marketIds, parentJobId:jobId})
                          → 새 jobId 응답 → /history/:newJobId 로 이동
[전체 잡 취소] → confirm → registration-cancel({jobId}) (진행 중일 때만)
[← 이력으로] → /history (필터 보존)
```

#### 주요 컴포넌트 (현재 구현)

| 컴포넌트 | 책임 |
|---|---|
| `HistoryDetailHeader` | 메타 + 부모/자식 잡 링크 + actions 슬롯 |
| `HistoryRetryDialog` | 재시도 confirm + mutation |
| `HistoryExcludeDialog` | 마켓 선택 + 제외 후 재등록 mutation |
| `HistoryErrorTabs` | "결과" / "에러" 탭 |
| `HistoryMarketResultCard` | 마켓별 결과 카드 (상태 뱃지 + ErrorMessage + 단건 액션) |
| `ErrorMessage` (공용 UI) | 긴 마켓 오류 메시지 접기/펼치기 |

#### 데이터 의존
- Postgres RPC `get_registration_job(jobId)` → `jobDetailSchema`
- Edge Function `registration-retry` (재시도)
- Edge Function `registration-start` (제외 후 재등록, `parentJobId` 동봉)
- Edge Function `registration-cancel` (잡 취소, 진행 중만)
- TanStack Query key `['history', 'detail', jobId]`
- Realtime 채널 (registration-job-state.md §8 인용) — `seller-jobs-{sellerId}` + 행 단위 필터

#### 상태 처리 (4 + partial)

| 상태 | 표시 |
|---|---|
| `loading` | 헤더 Skeleton + 마켓 카드 Skeleton 2개 |
| `data` | 헤더 + 탭 + 마켓 카드 리스트 |
| `error` | 전체 `ErrorMessage` ("이력을 불러오지 못했습니다") + 목록으로 / 다시 시도 |
| `empty` | RLS 차단 또는 미존재 → "잡을 찾을 수 없습니다" + 목록으로 |
| **`partial`** | 헤더 partial 뱃지 (warning 토큰) + "1성공 1실패" 카운트 + 실패 카드 우선 배치 |

#### PRD 근거
- §4.3.1 (재시도)
- §4.3.2 (제외 후 재등록)
- §4.4.1 (상세 조회)

#### user_flow 노드
n43, n44 (탭 `?tab=errors`).

---

## 4. 검색·필터 인벤토리

PRD §4.4.1 "다중 조건" 의 v1 구현. **URL search params 가 단일 ground truth** (`useSearchParams` ↔ `historyFilterSchema`).

| 필터 | 타입 | 기본값 | URL search params | 비고 |
|---|---|---|---|---|
| 기간 preset | radio (1택) | `30d` | `period=today\|7d\|30d\|custom` | n45 |
| 기간 from (custom) | date | (custom 일 때 필수) | `from=YYYY-MM-DD` | period=custom 일 때만 |
| 기간 to (custom) | date | (custom 일 때 필수) | `to=YYYY-MM-DD` | period=custom 일 때만 |
| 마켓 | checkbox 다중 (5종) | 전체 (필터 없음) | `market=naver&market=coupang…` | n46. 11번가/G마켓/옥션 v1 데이터 미생성이나 스키마에는 포함 |
| 상태 | checkbox 다중 (7종) | 전체 (필터 없음) | `status=partial&status=failed…` | `pending`/`running`/`partial`/`succeeded`/`failed`/`retrying`/`cancelled` |
| 검색어 | text | (없음) | `q=상품명` | 상품명 ILIKE 부분 일치. max 100자. 전문 검색은 v2 |
| 페이지 cursor | timestamptz | (없음) | `cursor=<ISO>` | keyset 페이지네이션 |
| 페이지 cursor tie-breaker | uuid | (없음) | `cursorId=<uuid>` | (created_at, id) 동률 시 분기 |
| 페이지 크기 | enum(20\|50) | `20` | `pageSize=20\|50` | RPC `least(limit, 50)` 강제 |

**필터 인터랙션 규약**:
- 체크박스/라디오 변경은 **디바운스 300ms 후 자동 적용** (URL 갱신).
- 검색어는 **Enter 또는 검색 버튼** 으로 트리거 (모바일 키보드 닫기 + 즉시 적용).
- `[필터 초기화]` 는 URL params 전체 제거 → 기본(30d) 로 복원.

---

## 5. 오류 통계 (PRD §4.4.2) — **v2 carry-over**

### 5.1 v1 범위
- v1 = 에러 탭(n44)에서 **실패 마켓 결과 카드 나열** 만 제공 (결과 탭의 실패 카드 필터 뷰).
- 통계 차트 없음.

### 5.2 v2 계획

| 항목 | 내용 |
|---|---|
| 차트 종류 | (a) error_code 분포 도넛 차트 / (b) 마켓별·기간별 성공률 라인 차트 |
| 데이터 소스 | Postgres view (예: `v_error_code_distribution`, `v_market_success_rate_by_day`) |
| 진입 위치 | `/history?tab=stats` 또는 별도 `/history/stats` (디자이너 결정) |
| 보류 사유 | 베타 운영 데이터 부족, error_code 분포 안정화 후 |
| expires | 2026-12-31 |

### 5.3 디자인 자리 확보 요청
- 목록 화면 상단 또는 별도 탭에 "오류 통계" 위젯 영역(placeholder)을 v1 디자인에서 미리 잡아두면 v2 이행 비용 감소.

---

## 6. 재시도 / 마켓 제외 후 등록 동선

### 6.1 단일 마켓 재시도 (n24 + §4.3.1)

```
HistoryDetailPage 마켓 카드의 [이 마켓만 재시도]
  → HistoryRetryDialog (ResponsiveDialog)
     "쿠팡에서 재시도하시겠습니까? retry_count: 1 → 2"
     [취소] [재시도]
  → registration-retry({jobId, marketResultIds:[id]})
  → 200 → success toast + Realtime 으로 status='retrying' 수신
       422 not_retryable → ErrorMessage
       429 retry_exceeded → "재시도 한도(5회) 도달" toast
       401/forbidden → /login?redirect=/history/:jobId
```

### 6.2 전체 실패 마켓 재시도

- 같은 mutation, `marketResultIds` 생략 → 서버에서 `market_status in ('failure_retryable','failure_final')` 자동 선택.

### 6.3 마켓 제외 후 재등록 (n25 + §4.3.2) — **새 잡 분기**

```
[이 마켓 제외하고 재등록]
  → HistoryExcludeDialog (Dialog 또는 bottom Sheet)
     ☑ 네이버 (이전 잡: 성공)   ← 기본 체크
     ☐ 쿠팡   (이전 잡: 실패)   ← 기본 미체크
     "포함 1 / 제외 1"
     [취소] [재등록 시작]
  → registration-start({productId, marketIds:['naver'], parentJobId:jobId})
  → 200 { jobId: newJobId } → /history/:newJobId 로 즉시 이동
       409 job_in_progress → "이 상품에 진행 중인 잡이 있습니다"
       422 no_markets_selected → "최소 1개 마켓이 필요합니다"
```

- **새 잡 ID 가 생성됨** (기존 잡 수정이 아님). 부모 잡 상세에 "하위 재등록 잡 N건" 표시 (v1 = 카운트만, v2 = 트리 시각화).

### 6.4 실행류 비활성 사유 (`blockingReasons`)

CLAUDE.md "프론트엔드 UI 일관성" 강제. 모든 실행류 버튼은 disabled 시 hover/focus tooltip 으로 사유 노출.

| 버튼 | 비활성 사유 (한국어 t() 키) |
|---|---|
| 단일 재시도 | "성공한 마켓은 재시도할 수 없습니다" / "이미 종료된 잡입니다" / "재시도 한도(5회)에 도달했습니다" |
| 전체 실패 재시도 | "재시도할 실패 마켓이 없습니다" / "재시도 한도(5회)에 도달했습니다" |
| 제외 후 재등록 | "기존 잡이 종료될 때까지 기다려주세요" / "최소 1개 마켓이 있어야 재등록할 수 있습니다" / "이 상품에 진행 중인 잡이 있습니다" |
| 잡 취소 | "이미 종료된 잡입니다" |

---

## 7. CSV/Excel 내보내기 (PRD §4.4.3) — **v2 carry-over**

| 항목 | 내용 |
|---|---|
| v1 범위 | **미구현** |
| 트리거 위치 (v2) | 목록 화면 상단 우측 `[내보내기 ▾]` 드롭다운 → CSV / Excel 선택 |
| 파일 포맷 (v2) | CSV (UTF-8 BOM + RFC 4180 escape) / Excel (.xlsx, SheetJS) |
| 포함 컬럼 | 잡 ID / 상품명 / 생성/완료 시각 / 상태 / retry / 마켓별 결과 요약 (성공/실패) / errorCode |
| 보류 사유 | PII 외부 노출 정책 미정 (security 미검토) |
| expires | 2026-12-31 |

### 7.1 디자인 자리 확보 요청
- 목록 헤더 우측에 `[내보내기]` 버튼 자리를 placeholder 로 표시해두면 v2 진입 비용 감소.

---

## 8. 도메인 워크플로우 다이어그램

```
                       ┌───────────────────────────────┐
                       │   사이드바 "이력" / 대시보드  │
                       │   "최근 등록" / 결과(n21)      │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
                      ┌────────────────────────────────────┐
                      │  /history  (HistoryListPage, n41-n42)│
                      │  4종 필터 (기간/마켓/상태/검색)      │
                      │  page list + cursor pagination     │
                      └───┬───────────────────┬────────────┘
                          │ 행 클릭            │ 필터 변경
                          │                   │ → URL 갱신
                          ▼                   ▼
            ┌─────────────────────────────┐   (refetch)
            │ /history/:jobId             │
            │ HistoryDetailPage (n43, n44)│
            │ 헤더 + 마켓결과 카드 N      │
            │ 탭: 결과 / 에러             │
            └──┬──────────┬──────────┬────┘
               │          │          │
       [단건/전체]  [제외 후 재등록] [전체 잡 취소]
        재시도       (새 잡 분기)     (진행 중만)
               │          │
               │          │
               ▼          ▼
        ┌─────────────┐  ┌───────────────────────────┐
        │ registration│  │ registration-start         │
        │   -retry    │  │   + parentJobId            │
        │ (기존 잡)   │  │ → 새 jobId 응답            │
        └──────┬──────┘  │ → /history/:newJobId 이동  │
               │         └────────────────────────────┘
               ▼
        Realtime ← registration_jobs UPDATE / market_results UPDATE
               │
               ▼
        ['history','detail',jobId] + ['history','list',*] invalidate
```

---

## 9. 디자인 리뉴얼 시 고려사항

### 9.1 긴 리스트 가상화
- 한 셀러 누적 잡이 수천 건 이상으로 늘어날 수 있음. v1 은 cursor 기반 페이지네이션 + "더 불러오기" 로 시각 진입을 한정하지만, **행 렌더링은 가상화 (예: `@tanstack/react-virtual`) 적용 여지** 를 디자인 단계에서 검토. 행 높이가 가변(부모/자식 잡 링크 유무, 마켓 스택 개수)이므로 디자이너는 **행 높이를 2~3 단계로 제한** 하는 가이드 필요.

### 9.2 마켓별 상태 뱃지
- 마켓 5종 × 결과 상태 (성공 / 재시도 가능 실패 / 최종 실패 / 제외 / 보류) 의 조합. 색상 토큰 표준은 CLAUDE.md "마켓 라인업 색상 표준" 인용 (네이버 `#03C75A` / 11번가 `#FF0038` / G마켓 `#00B147` / 옥션 `#E73936` / 쿠팡 `#F11F44`).
- **색에만 의존 금지** (WCAG 2.1 AA + ui-system.md §10) — 아이콘 + 한국어 텍스트 + 색 3중 표시 강제.

### 9.3 부분 실패(partial) 표시
- partial 잡은 "성공도 실패도 아닌 중간 상태" 라는 점이 셀러에게 직관적이지 않음. 디자이너는 **헤더에서 partial 의미 한 줄 설명** ("일부 마켓만 등록 성공") + **실패 카드를 1차 배치** + 성공 카드는 보조 영역에 배치하는 손실 회피 UX 권장.

### 9.4 차트 반응형 (v2 대비)
- v2 오류 통계 차트(도넛 + 라인) 영역을 v1 시점에 placeholder 로 잡아둘 것. 모바일(≤767px)에서는 차트가 가로 스크롤 또는 카드 변형으로 전환되도록 디자인 단계에서 미리 명시.

### 9.5 모바일 필터 sheet
- 모바일은 좌측 사이드바 대신 **bottom Sheet** 로 필터 전환 (ui-system.md §7 `ResponsiveDialog`). 활성 필터 칩(예: `30일 · 네이버,쿠팡 · partial+failed`)으로 닫힌 상태에서도 무엇이 적용됐는지 보여줘야 함.

### 9.6 긴 에러 메시지
- 마켓 API raw response 가 수백~수천 자에 달함. 공용 `ErrorMessage` 컴포넌트의 "접힘 기본 / 펼치기" 동작 유지. 디자이너는 펼친 상태의 최대 높이 + 스크롤 가이드를 함께 정의.

### 9.7 재시도/제외 dialog 의 confirm UX
- `HistoryRetryDialog` / `HistoryExcludeDialog` 모두 **변경 결과를 미리 노출** 해야 한다 (예: "retry_count: 1 → 2", "포함 1 / 제외 1"). 단순 yes/no confirm 으로는 부족 — 디자이너는 dialog 본문에 변화량 시각화 권장.

### 9.8 부모/자식 잡 트리
- v1 = "부모 잡 보기" / "하위 재등록 잡 N건" 단순 링크. v2 = 잡 트리 시각화 (재등록이 3회 누적되면 부모-자식-손자 체인). 디자이너는 v2 시점에 트리 컴포넌트 디자인 추가 검토.

### 9.9 접근성 (WCAG 2.1 AA)
- 필터 사이드바 키보드 동선: Tab 순서 = 기간 → 마켓 → 상태 → 검색어 → 적용/초기화.
- 마켓 카드 키보드 동선: 카드 헤더 → 외부 URL → 재시도 → 제외.
- 모든 실행류 버튼은 `aria-describedby` 로 blockingReasons tooltip 노출.
- 색 대비 4.5:1 (특히 상태 뱃지 텍스트).

### 9.10 다크 모드
- CLAUDE.md "라이트·다크 처음부터 병행" — 마켓 컬러 토큰의 다크 모드 변형 + 상태 뱃지 다크 모드 변형 디자이너 책임.
