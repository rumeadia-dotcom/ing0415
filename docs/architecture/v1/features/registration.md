# features/registration.md — 상품 등록 (s3) 종합 설계 (v1)

> 본 문서는 **다중 마켓 상품 자동 등록 SaaS** 의 s3 상품 등록 도메인을 단일 파일로 정의한다. backend·security·frontend·designer·qa 5 관점을 통합한다.
> v1 의 **핵심 가치 동선**이며, 본 문서가 architect + security + backend + frontend + qa 모두 승인되기 전에는 `apps/web/src/features/registration/*` 및 `apps/api/supabase/functions/registration-*` 구현 PR 을 머지하지 않는다.
>
> **작성 책임**: backend (INTJ, 12년차) 주도. security / frontend / designer / qa 4자 리뷰.
> **승인**: architect + security + backend + frontend + qa 5자 모두.
> **차단 권한**: 본 문서가 승인 전에는 등록 도메인 구현 PR **금지**.
> **의존 (선행 ground truth)**:
> - `docs/architecture/v1/platform.md` — Edge Function 환경 / Supabase 분리
> - `docs/architecture/v1/frontend.md` — 라우팅 / TanStack Query / Realtime
> - `docs/architecture/v1/ui-system.md` — 디자인 토큰 / 상태 색상 / 마켓 색
> - `docs/architecture/v1/security.md` — RLS 헌법 / 마스킹 / 로그 키 화이트리스트
> - `docs/architecture/v1/testing.md` — 테스트 매트릭스 양식
> - `docs/architecture/v1/cross-cutting/market-adapter.md` — MarketAdapter 5메서드
> - `docs/architecture/v1/cross-cutting/registration-job-state.md` — 상태 7개 + 전이표 (ground truth, 본 문서는 인용만)
> - `docs/architecture/v1/cross-cutting/image-pipeline.md` — 이미지 변환 / Storage RLS
> - `docs/architecture/v1/cross-cutting/credential-vault.md` — 토큰 복호화 RPC
> - `docs/architecture/v1/features/auth.md` — `auth.uid()` 세션
> - `docs/architecture/v1/features/markets.md` — `market_accounts` 상태 = `active` 조건
>
> **근거**: PRD §1.1 / §1.2 / §1.3 / §1.4 / §3 / §4.3, CLAUDE.md "MVP 범위 v1" / "외부 API 로깅 패턴" / "프론트엔드 UI 일관성", `user_flow.md` s3 (n15~n25).

---

## 목차

1. 목적 · 범위 · user_flow 매핑표
2. 도메인 데이터 모델 ERD (ASCII)
3. Postgres DDL (products / product_images / product_market_mappings / shipping_policies)
4. 상태 전이 (registration-job-state.md 인용)
5. 마켓 변환 (transformProduct) 로직 및 마켓별 필수 필드
6. Edge Functions (5종) 입출력 zod 스키마
7. 오케스트레이션 시퀀스 (ASCII)
8. Realtime 구독 (frontend.md 인용)
9. 클라이언트 zod 스키마 — 단일 소스
10. UI 흐름 — 5단계 위저드 + ASCII 와이어 (데스크탑/모바일)
11. 상태 처리 — loading / data / error / empty / partial
12. 에러 매핑 — MarketError code → 한국어 메시지 + 수정 가이드
13. 보안 (security.md 인용)
14. 이미지 처리 (image-pipeline.md 인용)
15. 카테고리 매핑 (Step 3)
16. 재시도 / 마켓 제외 후 재등록 (n24 / n25)
17. 테스트 매트릭스 (testing.md 양식, 30+ 케이스)
18. 수락 기준 체크리스트 (Phase 3 PASS 표)
19. 미해결 사안

---

## 1. 목적 · 범위 · user_flow 매핑

### 1.1 목적 (3줄)

- 셀러가 **한 번 입력한 상품 정보**를 5단계 위저드로 정리한 뒤, 연결된 다중 마켓 (MVP = 네이버 스마트스토어 + 쿠팡) 에 **병렬 등록**되도록 한다.
- 한 마켓의 실패가 다른 마켓 진행을 막지 않으며, **`partial` (부분 성공)** 상태를 1급 시민으로 다루어 UI / DB / 재시도 흐름 모두 명시한다.
- 마켓 API 호출은 클라이언트가 직접 하지 않고 Edge Function 만 경유하며, 토큰·시크릿·PII 는 로그·Sentry 양쪽에서 마스킹된다 (security.md §4 / §6 / §7).

### 1.2 범위

- **포함**:
  - 화면: 5단계 위저드 (`/register/new` → step query param 1~5 또는 path) + Step 5 결과 화면 (n21 / n24 / n25).
  - 도메인 테이블: `products` / `product_images` (image-pipeline.md 정의) / `product_market_mappings` / `shipping_policies`.
  - Edge Function 5종: `registration-validate` / `registration-start` / `registration-market-worker` / `registration-retry` / `registration-cancel`.
  - Realtime 구독: `registration_jobs` + `registration_job_market_results`.
  - 클라이언트 zod 스키마 단일 소스: `apps/web/src/lib/schemas/registration.ts`.
- **제외 (다른 문서)**:
  - `registration_jobs` / `registration_job_market_results` DDL · 상태 전이표 → `cross-cutting/registration-job-state.md` (본 문서는 인용만, 신규 전이 정의 금지).
  - MarketAdapter 5메서드 / 재시도 정책 / rate limit → `cross-cutting/market-adapter.md`.
  - 이미지 업로드·변환 Edge Function (`image-upload-url`, `image-transform`) → `cross-cutting/image-pipeline.md`.
  - 토큰 복호화 (`market_credentials.decrypt_token` RPC) → `cross-cutting/credential-vault.md`.
  - 마켓 OAuth 연결 / 해제 / `market_accounts` 상태 → `features/markets.md`.
  - 템플릿 불러오기 (n22) → **v2 (s4 템플릿 도메인)** 로 보류.
- **MVP 우선**:
  - 마켓: 네이버 / 쿠팡 / G마켓 / 옥션 / 11번가 5개 전부 (2026-05-22 5마켓 정식 결정, `market-adapter.md` §0 갱신분과 정합).
  - HTML 상세설명 **v0.6 부터 Tiptap WYSIWYG** (StarterKit + Link + Image + Placeholder) + 클라이언트 DOMPurify sanitize + 서버 추가 검증 (§13.5).

### 1.3 user_flow s3 노드 매핑

`user_flow.md` s3 의 11 노드 (n15~n25) 를 5단계 위저드에 묶는다. **MVP 범위 결정 (CLAUDE.md): 5단계 위저드, n22 템플릿 불러오기는 v2.**

| Step | 화면 | user_flow 노드 | 포함 액션 |
|---|---|---|---|
| **Step 1** | 상품 정보 입력 | n15 (s3 진입), **n16 (상품 정보 입력)** | 이름 / 가격 / 브랜드 / 제조사 / 카테고리(상위) / 배송정책 / 상세설명(HTML) |
| **Step 2** | 이미지 업로드 | **n18 (이미지 업로드)** | 대표 1장 + 추가 최대 9장. image-pipeline.md 의 signed URL 흐름 |
| **Step 3** | 마켓 선택 + 카테고리 매핑 | **n17 (마켓 선택)** + **n19 (카테고리 매핑)** | `market_accounts.status='active'` 인 마켓만 토글. 마켓별 카테고리 트리 로드 (`fetchCategoryTree` 결과 캐시) |
| **Step 4** | 등록 미리보기 | **n20 (등록 미리보기)** | 마켓별 변환 결과(`transformProduct`) + 필수 필드 사전 검증 (`registration-validate`) |
| **Step 5** | 등록 결과 | **n21 (등록 결과)** + **n23 (일괄 등록 실행 트리거)** + **n24 (오류 재시도)** + **n25 (마켓 제외 등록)** | `registration-start` 호출 → Realtime 으로 마켓별 상태 갱신 → 부분 실패 시 액션 |

> **참고: 프로토타입과의 차이.**
> 프로토타입(`prototype/screens/register.jsx`) 은 5단계 (정보 → 이미지 → 마켓·카테고리 → 미리보기 → 결과) 로 단순화되어 있어 본 문서와 단계 구조가 일치한다. CLAUDE.md 의 "프로토타입은 시각 레퍼런스" 원칙에 따라 user_flow 의 11 노드를 ground truth 로 두고, 위 매핑표가 두 표현의 단일 진실 원장이다.

### 1.4 s3 외 진입점

- 대시보드(s2) "새 상품 등록" CTA → `/register/new?step=1`.
- 사이드바 "상품 등록" 메뉴 → `/register/new?step=1`.
- 이력(s6) 상세에서 "재시도" → `registration-retry` (잡 유지) 또는 "마켓 제외 등록" → 신규 잡 (`/register/new` 으로 돌아가지 않음, 직접 `registration-start` parent_job_id 지정).

---

## 2. 도메인 데이터 모델 ERD

```
                                ┌───────────────────────────┐
                                │   auth.users              │  (Supabase Auth)
                                │   id (uuid, PK)           │
                                └─────────────┬─────────────┘
                                              │ 1
                                              │
                                              ▼ N
┌──────────────────────┐    ┌─────────────────────────────────┐    ┌──────────────────────────┐
│   shipping_policies  │    │   sellers (= auth.users 투영)   │    │   market_accounts        │
│   id (uuid, PK)      │◄───┤   RLS owner key (auth.uid())    │◄───┤   id (uuid, PK)          │
│   seller_id (FK)     │ N  │                                 │  N │   seller_id (FK)         │
│   name, fee, method  │    │                                 │    │   market_id (text)       │
│   eta_days           │    │                                 │    │   status ENUM            │
└──────────────────────┘    └─────────────┬───────────────────┘    └──────────────────────────┘
                                          │ 1                                    ▲
                                          │                                      │
                                          ▼ N                                    │
              ┌────────────────────────────────────────────────────┐             │
              │   products                                         │             │
              │   id (uuid, PK)                                    │             │
              │   seller_id (FK → auth.users.id)                   │             │
              │   name, price, original_price                      │             │
              │   brand, manufacturer                              │             │
              │   description_html (text, sanitized)               │             │
              │   base_category_id (text, 내부 단일 카테고리 코드) │             │
              │   shipping_policy_id (FK → shipping_policies)      │             │
              │   status ENUM (product_status)                     │             │
              │   created_at, updated_at                           │             │
              └────────┬──────────────────┬────────────────────────┘             │
                       │ 1                │ 1                                    │
                       │                  │                                      │
                       ▼ N                ▼ N                                    │
       ┌──────────────────────────┐  ┌──────────────────────────────────────┐    │
       │   product_images         │  │   product_market_mappings            │    │
       │   (image-pipeline.md     │  │   id (uuid, PK)                      │    │
       │    참조 — 본 문서 외)    │  │   product_id (FK → products.id)      │    │
       │                          │  │   market_id (text)                   │    │
       │   id (uuid, PK)          │  │   market_category_code (text)        │    │
       │   product_id (FK)        │  │   market_name_override (text, null)  │    │
       │   storage_path (text)    │  │   market_price_override (int, null)  │    │
       │   sort_order (smallint)  │  │   market_options (jsonb)             │    │
       │   role ENUM (main/sub)   │  │   last_synced_at (timestamptz, null) │    │
       │   width, height, bytes   │  │   UNIQUE (product_id, market_id)     │    │
       │   hash (sha256)          │  └─────────┬────────────────────────────┘    │
       └──────────────────────────┘            │ N                               │
                                               │                                 │
                                               ▼ 1                               │
                              ┌──────────────────────────────────────┐           │
                              │   registration_jobs                  │           │
                              │   (registration-job-state.md 정의)   │           │
                              │   id (uuid, PK)                      │           │
                              │   seller_id, product_id              │           │
                              │   status ENUM (7개)                  │           │
                              │   parent_job_id (n25)                │           │
                              └─────────────┬────────────────────────┘           │
                                            │ 1                                  │
                                            │                                    │
                                            ▼ N                                  │
                              ┌──────────────────────────────────────┐           │
                              │   registration_job_market_results    │           │
                              │   (registration-job-state.md 정의)   │           │
                              │   job_id, market_id                  ├───────────┘
                              │   market_account_id (FK)             │
                              │   market_status ENUM (5개)           │
                              │   external_product_id, product_url   │
                              │   error_code, error_message          │
                              │   attempt_count (≤3), excluded       │
                              └──────────────────────────────────────┘
```

**카디널리티 메모:**
- `products` : `product_images` = 1 : N (대표 1 + 추가 0~9, 총 ≤ 10).
- `products` : `product_market_mappings` = 1 : N (Step 3 에서 사용자가 선택한 마켓 개수만큼 row, MVP 1~2).
- `products` : `registration_jobs` = 1 : N (재등록 가능 — `parent_job_id` 로 연결).
- `(product_id, market_id)` 는 `product_market_mappings` 에서 유일. 같은 마켓 재선택 시 row insert 가 아닌 update.
- `market_account_id` 는 `registration_job_market_results` 만 보유 (잡 시점의 어카운트를 잠금). `product_market_mappings` 는 어카운트와 무관.

---

## 3. Postgres DDL

> **소유 분리**: 본 문서는 `products` / `product_images` (image-pipeline.md 와 합의된 컬럼만 재명세) / `product_market_mappings` / `shipping_policies` 4개 테이블의 DDL 을 정의한다. `registration_jobs` / `registration_job_market_results` 는 `registration-job-state.md` §3 에서 정의되며 **본 문서가 정의하지 않는다**. 컬럼·인덱스·ENUM 충돌 시 cross-cutting 문서가 우선.

### 3.1 ENUM

```sql
-- 상품 상태
-- 'draft'      : Step 1~4 중 임시 저장
-- 'ready'      : Step 4 통과, 등록 가능
-- 'registered' : 최소 1개 마켓에 등록 성공한 이력 보유
create type product_status as enum (
  'draft',
  'ready',
  'registered'
);

-- 이미지 역할 (image-pipeline.md 와 합의)
-- 'main' : 대표 이미지 (정확히 1장 필수)
-- 'sub'  : 추가 이미지 (0~9장)
create type product_image_role as enum (
  'main',
  'sub'
);

-- 배송 방식
create type shipping_method as enum (
  'parcel',         -- 택배
  'direct',         -- 직접배송
  'quick',          -- 퀵서비스
  'visit_pickup'    -- 방문수령
);
```

### 3.2 `shipping_policies`

```sql
create table public.shipping_policies (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  fee             integer not null check (fee >= 0),     -- 원
  method          shipping_method not null,
  eta_days        smallint not null check (eta_days between 0 and 30),
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint shipping_policies_name_len check (char_length(name) between 1 and 50)
);

-- 기본 배송정책은 셀러당 최대 1개
create unique index shipping_policies_default_per_seller
  on public.shipping_policies (seller_id)
  where is_default = true;

create index shipping_policies_seller_idx
  on public.shipping_policies (seller_id);

-- RLS
alter table public.shipping_policies enable row level security;

create policy shipping_policies_select_own
  on public.shipping_policies for select
  using (seller_id = auth.uid());

create policy shipping_policies_insert_own
  on public.shipping_policies for insert
  with check (seller_id = auth.uid());

create policy shipping_policies_update_own
  on public.shipping_policies for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy shipping_policies_delete_own
  on public.shipping_policies for delete
  using (seller_id = auth.uid());
```

### 3.3 `products`

```sql
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references auth.users(id) on delete cascade,

  -- 기본 정보
  name                text not null,
  price               integer not null check (price >= 0),                -- 판매가 (원)
  original_price      integer check (original_price is null or original_price >= price),  -- 정가 (할인 전)
  brand               text,
  manufacturer        text,
  description_html    text,                                               -- DOMPurify 통과한 sanitized HTML

  -- 카테고리 (내부 단일 카테고리 — Step 1 입력. 마켓별 매핑은 product_market_mappings 에)
  base_category_id    text not null,                                      -- 자체 내부 카테고리 코드 (PRD §1.1.1)

  -- 배송
  shipping_policy_id  uuid references public.shipping_policies(id) on delete restrict,

  -- 상태
  status              product_status not null default 'draft',

  -- 메타
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- 제약
  constraint products_name_len           check (char_length(name) between 2 and 100),
  constraint products_brand_len          check (brand is null or char_length(brand) <= 50),
  constraint products_manufacturer_len   check (manufacturer is null or char_length(manufacturer) <= 50),
  constraint products_description_len    check (description_html is null or char_length(description_html) <= 50000)
);

create index products_seller_idx        on public.products (seller_id);
create index products_seller_status_idx on public.products (seller_id, status);
create index products_seller_updated    on public.products (seller_id, updated_at desc);

-- RLS
alter table public.products enable row level security;

create policy products_select_own
  on public.products for select
  using (seller_id = auth.uid());

create policy products_insert_own
  on public.products for insert
  with check (seller_id = auth.uid());

create policy products_update_own
  on public.products for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy products_delete_own
  on public.products for delete
  using (seller_id = auth.uid());

-- updated_at 트리거
create or replace function set_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function set_updated_at();
```

### 3.4 `product_images` (image-pipeline.md 단일 출처)

> **DDL 은 `cross-cutting/image-pipeline.md` §3 단독 정의를 단일 출처로 한다.** 본 문서는 도메인 관점의 사용 규약만 명시한다. 변환본 메타는 별도 테이블 `product_image_variants` (image-pipeline.md) 에 분리.

**본 도메인 한정 운영 규약 (image-pipeline.md DDL 위에서 동작):**
- 멱등 키: `product_images.hash_sha256` (이미지 파일 SHA-256). 동일 hash 재업로드는 기존 row 재사용.
- `role='main'` row 는 상품당 1장 강제 (image-pipeline.md unique index 인용).
- `sort_order` 는 상품 내 유일 (image-pipeline.md unique index 인용).
- RLS: `seller_id = auth.uid()` (image-pipeline.md §3 RLS 정책 인용).

### 3.5 `product_market_mappings`

마켓별 변환 결과 캐시 + 사용자 오버라이드 저장.

```sql
create table public.product_market_mappings (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null references public.products(id) on delete cascade,
  seller_id               uuid not null references auth.users(id) on delete cascade,
  market_id               text not null check (market_id in ('naver','coupang','11st','gmarket','auction')),

  -- 카테고리 매핑 (Step 3)
  market_category_code    text not null,                              -- 마켓별 카테고리 트리의 leaf 코드

  -- 사용자 오버라이드 (선택)
  market_name_override    text,                                       -- null = products.name 사용
  market_price_override   integer check (market_price_override is null or market_price_override >= 0),

  -- 마켓 고유 옵션 (마켓별 quirks. transformProduct 입력)
  market_options          jsonb not null default '{}'::jsonb,

  -- 변환 마지막 검증 시점 (registration-validate 결과)
  last_validated_at       timestamptz,
  last_validation_errors  jsonb,                                      -- null = 검증 성공

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint pmm_unique_per_product_market unique (product_id, market_id),
  constraint pmm_override_name_len check (
    market_name_override is null or char_length(market_name_override) between 2 and 100
  )
);

create index pmm_product_idx on public.product_market_mappings (product_id);
create index pmm_seller_idx  on public.product_market_mappings (seller_id);
create index pmm_market_idx  on public.product_market_mappings (market_id);

-- RLS
alter table public.product_market_mappings enable row level security;

create policy pmm_select_own
  on public.product_market_mappings for select
  using (seller_id = auth.uid());

create policy pmm_insert_own
  on public.product_market_mappings for insert
  with check (seller_id = auth.uid());

create policy pmm_update_own
  on public.product_market_mappings for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy pmm_delete_own
  on public.product_market_mappings for delete
  using (seller_id = auth.uid());

create trigger pmm_set_updated_at
  before update on public.product_market_mappings
  for each row execute function set_updated_at();
```

### 3.6 인덱스 요약

| 테이블 | 인덱스 | 용도 |
|---|---|---|
| `products` | `(seller_id)` | RLS 가속 |
| `products` | `(seller_id, status)` | Step 진행 / 이력 필터 |
| `products` | `(seller_id, updated_at desc)` | 대시보드 최근 목록 |
| `product_images` | `(product_id)` where role='main' UNIQUE | 대표 1장 강제 |
| `product_images` | `(product_id, sort_order)` UNIQUE | 순서 보장 |
| `product_market_mappings` | `(product_id, market_id)` UNIQUE | 마켓당 1행 강제 |
| `shipping_policies` | `(seller_id)` where is_default UNIQUE | 기본 1개 강제 |

---

## 4. 상태 전이 (registration-job-state.md 인용)

**본 문서는 새로운 상태 / 새로운 전이를 정의하지 않는다.** 모든 잡 상태·마켓 결과 상태·전이 규칙은 `cross-cutting/registration-job-state.md` §3 ~ §5 가 단일 진실 원장이다.

| 잡 상태 (`registration_job_status`) | 의미 | 본 문서에서의 발생 시점 |
|---|---|---|
| `pending` | INSERT 직후, 마켓 호출 전 | `registration-start` 함수가 잡 INSERT 직후 |
| `running` | 하나 이상 마켓 in-flight | `registration-market-worker` 첫 진입 시 RPC `mark_job_running(job_id)` |
| `partial` | 모든 결과 종료 + 일부 성공/실패 | RPC `recompute_job_status(job_id)` (등록-job-state.md §5.3) |
| `succeeded` | 모든 마켓 결과 = success | 동일 RPC |
| `failed` | 모든 마켓 결과 = failure (retry 한도 초과 포함) | 동일 RPC |
| `retrying` | 잡 단위 자동 재시도 진행 중 | `registration-retry` 함수가 `retry_count++` 와 함께 set |
| `cancelled` | 사용자 명시 취소 | `registration-cancel` 함수 |

| 마켓 결과 상태 (`market_result_status`) | 의미 |
|---|---|
| `pending` | row INSERT 직후 |
| `in_flight` | worker 진입 |
| `success` | `adapter.createProduct` 성공 |
| `failed` | 5xx / 429 / network — worker가 자동 재시도 큐로 (`attempt_count < 3`) |
| `failed_final` | validation / auth / 한도 초과 — 더 시도 안 함 |

전이 규칙 / 재계산 SQL / 동시성 제어(advisory lock) 는 `registration-job-state.md` §5 참조. 본 문서 §7 의 오케스트레이션 시퀀스는 그 규칙을 따른다.

---

## 5. 마켓 변환 (transformProduct) 로직 및 마켓별 필수 필드

### 5.1 호출 위치

`MarketAdapter.transformProduct(product, mapping)` 은 `market-adapter.md` §2 정의대로 **순수 함수**다. 본 도메인에서 호출되는 위치 2곳:

1. **클라이언트 Step 4 미리보기** — 클라이언트가 `apps/web/src/lib/markets/<id>/transform.ts` 의 동일 함수를 import 해서 호출. 마켓별 변환 결과 카드를 그린다. 클라이언트는 외부 마켓 API 를 호출하지 않으므로 transformProduct 만 사용 가능.
2. **Edge Function `registration-market-worker`** — `adapter.transformProduct` → `adapter.createProduct` 직전 호출. 동일 입력 → 동일 출력 (결정성) 이므로 클라이언트 / 서버 결과가 일치해야 한다 (테스트 T-T1 으로 검증).

### 5.2 입력·출력 (market-adapter.md 인용)

```ts
transformProduct(product: Product, mapping: MarketMapping): MarketPayload;
```

`Product` / `MarketMapping` / `MarketPayload` 의 zod 스키마는 `market-adapter.md` §3 참조. `Product` 는 본 문서 `products` + `product_images` + `shipping_policies` 의 조회 view 결과를 그대로 매핑.

### 5.3 마켓별 필수 필드 (Step 4 미리보기·`registration-validate` 에서 검증)

| 필드 | naver (스마트스토어) | coupang | 비고 |
|---|---|---|---|
| 상품명 | 필수, 2~100자, 특수문자 제한 | 필수, 2~100자 | products.name 또는 override |
| 판매가 | 필수, ≥ 100원 | 필수, ≥ 1000원 | products.price 또는 override |
| 정가 | 선택 (할인율 표시용) | 선택 | products.original_price |
| 카테고리 | 필수, 마켓 leaf 코드 | 필수, 마켓 leaf 코드 | product_market_mappings.market_category_code |
| 브랜드 | 일부 카테고리 필수 (의류·뷰티) | 일부 카테고리 필수 | products.brand. 누락 시 어댑터가 validation 에러 |
| 제조사 | 일부 카테고리 필수 | 일부 카테고리 필수 | products.manufacturer |
| 배송 방식 | 필수 (택배/직접/방문) | 필수 (택배/직접) | shipping_policies.method, coupang 은 quick/visit 미지원 |
| 배송비 | 필수 (≥ 0) | 필수 (≥ 0) | shipping_policies.fee |
| 대표 이미지 | 필수 1장, 640×640 이상 | 필수 1장, 500×500 이상 | product_images role='main' |
| 추가 이미지 | 최대 9장 | 최대 9장 | product_images role='sub' |
| 상세설명 HTML | 선택 (없으면 자동 기본 템플릿) | 필수 (≥ 10자) | products.description_html |
| 마켓 고유 | naver: 옵션조합 / A/S 안내 | coupang: 출고지·반품지 코드 | market_options jsonb |

### 5.4 검증 우선순위

`registration-validate` Edge Function 은 다음 순서로 검증하고, 첫 실패 시 후속 검증을 멈춘다 (오류 메시지 폭주 방지). 단 클라이언트 Step 4 미리보기는 **모든 항목 검증 후 일괄 표시**.

```
1. products 기본 필드 (name / price / category / shipping)         → app 레이어 zod
2. product_images (대표 1장 + 변환 가능한 mime/사이즈)             → image-pipeline 검증
3. product_market_mappings (각 선택된 마켓에 row 존재)              → DB 조회
4. 마켓별 어댑터 validation (transformProduct + 필수 필드 화이트박스) → adapter
5. 토큰 유효성 (market_credentials.status='active')                 → credential-vault
```

---

## 6. Edge Functions

### 6.1 함수 일람

| 함수 | 트리거 | 책임 | timeout | 인증 |
|---|---|---|---|---|
| `registration-validate` | Step 4 진입 시 클라이언트 호출 | 마켓별 사전 검증 (5.4) | 10s | seller JWT |
| `registration-start` | Step 5 "일괄 등록" 클릭 | 잡 INSERT (status=pending) + 마켓별 worker fan-out | 15s | seller JWT |
| `registration-market-worker` | `registration-start` 가 마켓별 1회씩 invoke (또는 pg_net 큐) | 단일 마켓 처리: image-transform → createProduct → 결과 적재 | 60s | service_role (내부) |
| `registration-retry` | Step 5 "재시도" 클릭 (n24) | 특정 결과 행만 재실행 (`failure_*` → `pending` → worker) | 15s | seller JWT |
| `registration-cancel` | Step 5 "취소" 클릭 | 진행 중 잡 취소 (`pending` / `running` 만) | 5s | seller JWT |

> **n25 마켓 제외 후 재등록**은 별도 함수 아님. 클라이언트가 `registration-start` 를 호출하면서 `parent_job_id` + `excluded_market_ids[]` 를 인자로 넘긴다 (§6.4).

### 6.2 `registration-validate`

```ts
// apps/api/supabase/functions/registration-validate/index.ts
import { z } from 'zod';

const RequestSchema = z.object({
  productId: z.string().uuid(),
  marketIds: z.array(
    z.enum(['naver','coupang','11st','gmarket','auction'])
  ).min(1).max(5),
});

const ValidationIssueSchema = z.object({
  marketId: z.string(),
  code: z.enum([
    'product_name_invalid',
    'product_price_invalid',
    'category_missing',
    'category_not_leaf',
    'brand_required',
    'manufacturer_required',
    'shipping_method_unsupported',
    'image_main_missing',
    'image_size_too_small',
    'description_required',
    'market_options_missing',
    'token_expired',
    'token_revoked',
    'mapping_not_found',
  ]),
  field: z.string(),
  message: z.string(),         // 한국어 (§12 매핑)
  hint: z.string().optional(), // 수정 가이드
});

const ResponseSchema = z.object({
  ok: z.boolean(),
  issues: z.array(ValidationIssueSchema),
  // 마켓별 변환 미리보기 (성공한 마켓만)
  previews: z.array(z.object({
    marketId: z.string(),
    payload: z.unknown(),       // MarketPayload (어댑터별)
    estimatedFee: z.number().nullable(),  // 마켓 등록 수수료 추정 (null 가능)
  })),
});
```

- 실패 모드: `400 invalid_request` (zod fail) / `401 unauthorized` / `403 forbidden_product` (RLS) / `404 product_not_found` / `503 market_unavailable` (어댑터 timeout).
- 토큰 만료 발견 시 즉시 토큰 refresh 시도 (credential-vault `decrypt_token` + adapter `refreshToken`). 갱신 실패 시 `token_expired` issue.

### 6.3 `registration-start`

```ts
const RequestSchema = z.object({
  productId: z.string().uuid(),
  marketIds: z.array(z.string()).min(1).max(5),
  // n25 마켓 제외 후 재등록 시 채움
  parentJobId: z.string().uuid().optional(),
  // n25 에서 제외할 마켓 (이번 잡에 포함하지 않을 마켓)
  // 본 함수에서는 사용 안 함 (이미 marketIds 에서 빠져 있어야 함).
  // parentJobId 만 추적용으로 저장.
});

const ResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal('pending'),
  marketResults: z.array(z.object({
    marketId: z.string(),
    marketAccountId: z.string().uuid(),
    status: z.literal('pending'),
  })),
});
```

- **중복 트리거 방지**:
  - 같은 (`seller_id`, `product_id`) 의 `pending` / `running` / `retrying` 잡이 있으면 `409 job_in_progress` 반환.
  - DB 레벨 advisory lock: `pg_try_advisory_xact_lock(hashtext(seller_id || product_id))` (registration-job-state.md §5.7).
- **fan-out**:
  - 본 함수는 잡 INSERT + `registration_job_market_results` 각 row INSERT (status=pending) 후, 마켓당 `registration-market-worker` 를 `supabase.functions.invoke(...)` 로 비동기 호출 (await 없이 fire-and-forget).
  - timeout 15s 안에 끝남 (DB write 만). 실제 마켓 호출은 worker 가 담당.
- **로그 (security.md 화이트리스트)**:
  ```ts
  logger.info({
    event: 'registration_start',
    jobId, sellerId, productId, marketIds, correlationId,
  }, '→ registration start');
  ```

### 6.4 `registration-market-worker`

```ts
const RequestSchema = z.object({
  jobId: z.string().uuid(),
  marketId: z.string(),
  marketResultId: z.string().uuid(),
  attempt: z.number().int().min(1).max(3),   // 어댑터 단위 재시도 (market-adapter.md withRetry 와 별개)
  correlationId: z.string().uuid(),
});

const ResponseSchema = z.object({
  marketResultId: z.string().uuid(),
  finalStatus: z.enum(['success','failed','failed_final']),
  externalProductId: z.string().optional(),
  productUrl: z.string().url().optional(),
  errorCode: z.string().optional(),
});
```

- **인증**: service_role (셀러 JWT 없음). seller_id 는 `jobId` 로부터 조회. **security.md §RLS-Bypass 예외 경로**로 명시 등록 필수.
- **흐름**:
  1. `mark_job_running(jobId)` RPC.
  2. `update registration_job_market_results set market_status='in_flight'`.
  3. `decrypt_token(market_account_id)` (credential-vault.md).
  4. 만료 시 `adapter.refreshToken` → `market_credentials` 업데이트.
  5. `image-transform` 호출 (image-pipeline.md, 이미지 N장 × 마켓 1 = N invoke).
  6. `adapter.transformProduct(product, mapping)`.
  7. `withRetry(adapter.createProduct(payload), { maxAttempts: 5, backoff: 'exp' })` (market-adapter.md §재시도).
  8. 결과를 `registration_job_market_results` 에 UPDATE (success / failure_*).
  9. `recompute_job_status(jobId)` RPC (registration-job-state.md §5.3).
- **로그**:
  ```ts
  logger.info({ event:'market_worker_start', jobId, marketId, attempt }, '→ worker');
  logger.info({ market:marketId, method, url, sellerId, correlationId, jobId }, '→ market request');
  logger.info({ market:marketId, status }, '← market response');
  logger.error({ market:marketId, err: maskError(e) }, '← market error');
  ```

### 6.5 `registration-retry`

```ts
const RequestSchema = z.object({
  jobId: z.string().uuid(),
  // 비우면 모든 failure_* 결과를 재시도. 채우면 그 결과만.
  marketResultIds: z.array(z.string().uuid()).optional(),
});

const ResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal('retrying'),
  retried: z.array(z.object({
    marketResultId: z.string().uuid(),
    marketId: z.string(),
  })),
});
```

- 대상 결과 행이 `failed_final` 이면 거부 (`422 not_retryable`).
- 잡 단위 `retry_count++` (max 5, 초과 시 `429 retry_exceeded`).
- 잡 status 를 `retrying` 으로 set 후 worker 재 invoke.

### 6.6 `registration-cancel`

```ts
const RequestSchema = z.object({
  jobId: z.string().uuid(),
  reason: z.string().max(200).optional(),
});

const ResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal('cancelled'),
  cancelledAt: z.string().datetime(),
});
```

- `pending` / `running` / `retrying` 잡만 취소 가능. 종료 잡(`partial`/`succeeded`/`failed`)은 `409 already_finalized`.
- in_flight worker 는 outer cancel signal 을 polling. registration-job-state.md §6 의 협조적 취소 (cooperative cancel) 모델 따름.

---

## 7. 오케스트레이션 시퀀스

### 7.1 happy path (2마켓 동시 성공)

```
 Client                Edge Fn               Postgres              Worker (naver)     Worker (coupang)    Market API
   │                  registration-start         │                      │                  │                   │
   │ ─ POST ─────────────►│                       │                      │                  │                   │
   │                      │ advisory_lock          │                      │                  │                   │
   │                      │ INSERT registration_jobs (status=pending)    │                  │                   │
   │                      │ INSERT market_results × 2 (status=pending)   │                  │                   │
   │                      │ functions.invoke worker (naver)              │                  │                   │
   │                      │ functions.invoke worker (coupang)            │                  │                   │
   │                      │                       │                      │                  │                   │
   │ ◀─ 200 jobId ────────│                       │                      │                  │                   │
   │                      │                       │                      │                  │                   │
   │   (Realtime subscribe registration_jobs + market_results)           │                  │                   │
   │                      │                       │                      │                  │                   │
   │                      │                       │                      │ ─ decrypt_token ─►                   │
   │                      │                       │                      │ ◀ token         ─                    │
   │                      │                       │ ◀ UPDATE running ────│                  │ ─ refreshToken ──►│
   │                      │                       │                      │                  │ ◀ tokenSet ──────│
   │                      │                       │ ◀ UPDATE in_flight ──│                  │                   │
   │ ◀─ Realtime "running" │                       │                      │ ─ image-transform│ ─ image-transform│
   │                      │                       │                      │ ─ adapter.create►│ ─ adapter.create►│
   │                      │                       │                      │ ◀ {externalId} ──│ ◀ {externalId} ──│
   │                      │                       │ ◀ UPDATE success ────│ ◀ UPDATE success │                   │
   │                      │                       │ ─ recompute_status ──┤                  │                   │
   │                      │                       │ jobs.status='succeeded'                 │                   │
   │ ◀─ Realtime "succeeded"                       │                      │                  │                   │
```

### 7.2 partial path (naver 성공, coupang 5xx → 5회 재시도 후 실패)

```
   ...                   (worker fan-out 동일)
   │                      │                       │                      │ ─ adapter.create►│ ─ adapter.create►│
   │                      │                       │                      │ ◀ 200 ──────────│ ◀ 500 ──────────│
   │                      │                       │                      │                  │ withRetry: backoff
   │                      │                       │                      │                  │ ─ adapter.create►│ × 4 회 추가
   │                      │                       │                      │                  │ ◀ 500 / 503 ────│
   │                      │                       │ ◀ success (naver) ───│                  │                   │
   │                      │                       │ ◀ failed             │                  │                   │
   │                      │                       │   (coupang, attempt=3)                  │                   │
   │                      │                       │ ─ recompute_status ──┤                  │                   │
   │                      │                       │ jobs.status='partial'                   │                   │
   │ ◀─ Realtime "partial" │                       │                      │                  │                   │
   │                                              │                      │                                      │
   │   [Step 5 UI: 재시도 / 마켓 제외 등록 액션 노출]                                                              │
```

### 7.3 격리 원칙

- worker 는 서로의 상태를 직접 참조하지 않는다. `recompute_job_status(jobId)` RPC 만이 잡 status 의 단일 결정자.
- naver worker 가 image-transform 실패해도 coupang worker 는 계속 진행. 격리 단위 = `registration_job_market_results` row.

### 7.4 재시도 정책 (market-adapter.md 인용)

- **어댑터 내부 (`withRetry`)**: 5xx / 429 / network → exponential backoff (1s → 2s → 4s → 8s → 16s, jitter ±25%), max 5 회.
- **워커 단위 재시도 (잡 단위 retry_count)**: 사용자가 Step 5 에서 명시 "재시도" 클릭 시 (`registration-retry`). 자동 아님. max 5 회 (잡 retry_count ≤ 5).
- **dead letter**: retry_count=5 + 마켓 결과 = failed_final → 알림(v2 에서 이메일), v1 은 UI 빨간 배지만.

---

## 8. Realtime 구독

### 8.1 채널 구독 (frontend.md 인용)

클라이언트(Step 5 화면) 는 `registration-start` 응답으로 `jobId` 를 받은 직후 두 채널을 구독한다.

```ts
// apps/web/src/features/registration/hooks/useRegistrationJobRealtime.ts
const channel = supabase
  .channel(`reg-job-${jobId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'registration_jobs',
    filter: `id=eq.${jobId}`,
  }, (payload) => {
    queryClient.setQueryData(['registrationJob', jobId], payload.new);
  })
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'registration_job_market_results',
    filter: `job_id=eq.${jobId}`,
  }, (payload) => {
    queryClient.invalidateQueries({ queryKey: ['registrationJobResults', jobId] });
  })
  .subscribe();
```

### 8.2 RLS 와의 호환

- Realtime 은 SELECT RLS 정책을 그대로 적용. 셀러는 자신의 잡만 구독 가능.
- service_role 로 worker 가 UPDATE 하더라도 Realtime broadcast 는 셀러 JWT 로 receive 권한 검증.

### 8.3 fallback

- WebSocket 끊김 / 5s 안에 메시지 없음 → TanStack Query 의 `refetchInterval: 3000` (terminal status 도달 시 stop) 으로 polling fallback.

---

## 9. 클라이언트 zod 스키마 (단일 소스)

> 위치: `apps/web/src/lib/schemas/registration.ts`. RHF + Supabase insert + Edge Function 요청 / 응답 검증 모두 본 스키마 재사용.
>
> **본 zod 스키마는 `apps/web/src/lib/schemas/registration.ts` 단일 소스.** 다른 features 문서(dashboard.md, history.md 등) 는 정의를 재선언하지 않고 본 모듈에서 `import` 만 한다. ENUM 값 변경은 본 문서 + `cross-cutting/registration-job-state.md` §3.1 동시 갱신.

### 9.1 단계별 부분 스키마

```ts
// apps/web/src/lib/schemas/registration.ts
import { z } from 'zod';

// ─────────────────────────────────────────────
// 도메인 기본 타입
// ─────────────────────────────────────────────
export const MarketIdSchema = z.enum([
  'naver','coupang','11st','gmarket','auction',
]);
export type MarketId = z.infer<typeof MarketIdSchema>;

export const ProductStatusSchema = z.enum(['draft','ready','registered']);
export const ShippingMethodSchema = z.enum(['parcel','direct','quick','visit_pickup']);

// ─────────────────────────────────────────────
// Step 1: 상품 정보 입력 (n16)
// ─────────────────────────────────────────────
export const Step1Schema = z.object({
  name: z.string().min(2, '상품명은 2자 이상').max(100, '상품명은 100자 이하'),
  price: z.number().int().min(100, '판매가는 100원 이상'),
  originalPrice: z.number().int().min(0).nullable(),
  brand: z.string().max(50).nullable(),
  manufacturer: z.string().max(50).nullable(),
  descriptionHtml: z.string().max(50000).nullable(),
  baseCategoryId: z.string().min(1, '내부 카테고리를 선택하세요'),
  shippingPolicyId: z.string().uuid('배송정책을 선택하세요'),
}).refine(
  (d) => d.originalPrice === null || d.originalPrice >= d.price,
  { message: '정가는 판매가 이상이어야 합니다', path: ['originalPrice'] },
);

// ─────────────────────────────────────────────
// Step 2: 이미지 (n18) — image-pipeline.md 와 합의
// ─────────────────────────────────────────────
export const ImageMetaSchema = z.object({
  id: z.string().uuid(),
  storagePath: z.string(),
  role: z.enum(['main','sub']),
  sortOrder: z.number().int().min(0).max(9),
  width: z.number().int().min(100),
  height: z.number().int().min(100),
  bytes: z.number().int().min(1).max(10 * 1024 * 1024),
  mimeType: z.enum(['image/jpeg','image/png','image/webp']),
  hashSha256: z.string().length(64),
});

export const Step2Schema = z.object({
  images: z.array(ImageMetaSchema)
    .min(1, '이미지를 1장 이상 업로드해주세요')
    .max(10, '이미지는 최대 10장까지'),
}).refine(
  (d) => d.images.filter((i) => i.role === 'main').length === 1,
  { message: '대표 이미지를 1장 지정해주세요', path: ['images'] },
);

// ─────────────────────────────────────────────
// Step 3: 마켓 선택 + 카테고리 매핑 (n17 + n19)
// ─────────────────────────────────────────────
export const MarketSelectionSchema = z.object({
  marketId: MarketIdSchema,
  marketAccountId: z.string().uuid(),
});

export const CategoryMappingSchema = z.object({
  marketId: MarketIdSchema,
  marketCategoryCode: z.string().min(1, '마켓 카테고리를 선택하세요'),
  marketNameOverride: z.string().max(100).nullable(),
  marketPriceOverride: z.number().int().min(0).nullable(),
  marketOptions: z.record(z.unknown()).default({}),
});

export const Step3Schema = z.object({
  selections: z.array(MarketSelectionSchema)
    .min(1, '마켓을 1개 이상 선택해주세요')
    .max(5, '마켓은 최대 5개'),
  mappings: z.array(CategoryMappingSchema)
    .min(1, '카테고리 매핑이 필요합니다'),
}).refine(
  (d) => d.selections.length === d.mappings.length,
  { message: '선택한 마켓 수와 카테고리 매핑 수가 일치해야 합니다', path: ['mappings'] },
);

// ─────────────────────────────────────────────
// Step 4: 미리보기 (n20) — validate 응답 매핑
// ─────────────────────────────────────────────
export const ValidationIssueSchema = z.object({
  marketId: z.string(),
  code: z.enum([
    'product_name_invalid',
    'product_price_invalid',
    'category_missing',
    'category_not_leaf',
    'brand_required',
    'manufacturer_required',
    'shipping_method_unsupported',
    'image_main_missing',
    'image_size_too_small',
    'description_required',
    'market_options_missing',
    'token_expired',
    'token_revoked',
    'mapping_not_found',
  ]),
  field: z.string(),
  message: z.string(),
  hint: z.string().optional(),
});

export const Step4ValidationSchema = z.object({
  ok: z.boolean(),
  issues: z.array(ValidationIssueSchema),
  previews: z.array(z.object({
    marketId: MarketIdSchema,
    payload: z.unknown(),
    estimatedFee: z.number().nullable(),
  })),
});

// ─────────────────────────────────────────────
// Step 5: 등록 결과 (n21 / n24 / n25)
// ─────────────────────────────────────────────
export const MarketResultStatusSchema = z.enum([
  'pending','in_flight','success','failed','failed_final',
]);

export const MarketResultSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  marketId: MarketIdSchema,
  marketAccountId: z.string().uuid(),
  marketStatus: MarketResultStatusSchema,
  externalProductId: z.string().nullable(),
  productUrl: z.string().url().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attemptCount: z.number().int().min(0).max(3),
  excluded: z.boolean(),
  lastAttemptedAt: z.string().datetime().nullable(),
});

export const RegistrationJobStatusSchema = z.enum([
  'pending','running','partial','succeeded','failed','retrying','cancelled',
]);

export const RegistrationJobSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  productId: z.string().uuid(),
  status: RegistrationJobStatusSchema,
  retryCount: z.number().int().min(0).max(5),
  errorSummary: z.string().nullable(),
  parentJobId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

// ─────────────────────────────────────────────
// 전체 위저드 종합 (Step 4 validate 입력 / Step 5 start 입력)
// ─────────────────────────────────────────────
export const ProductDraftSchema = Step1Schema.and(z.object({
  images: Step2Schema.shape.images,
  selections: Step3Schema.shape.selections,
  mappings: Step3Schema.shape.mappings,
}));

export type ProductDraft = z.infer<typeof ProductDraftSchema>;
export type ImageMeta = z.infer<typeof ImageMetaSchema>;
export type MarketSelection = z.infer<typeof MarketSelectionSchema>;
export type CategoryMapping = z.infer<typeof CategoryMappingSchema>;
export type ShippingPolicy = z.infer<typeof Step1Schema.shape.shippingPolicyId> extends string ? unknown : never;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type MarketResult = z.infer<typeof MarketResultSchema>;
export type RegistrationJob = z.infer<typeof RegistrationJobSchema>;
```

### 9.2 점진적 검증 (단계 이동 가드)

- Step N → Step N+1 이동은 `Step<N>Schema.safeParse` 통과해야 함. 실패 시 에러 메시지를 RHF 의 `setError` 로 표시.
- Step 4 의 `Step4ValidationSchema` 는 사용자 입력이 아니라 서버 응답 검증 — 통과 못 한 마켓은 Step 5 진입 시 자동 제외 (확인 다이얼로그).

---

## 10. UI 흐름 — 5단계 위저드

### 10.1 라우팅 (frontend.md 인용)

| URL | 화면 | 동작 |
|---|---|---|
| `/register/new` | 위저드 진입 (Step 1) | 새 `products` row INSERT (status=draft) 후 query param `productId` 부여 |
| `/register/new?step=2&productId=<uuid>` | Step 2 (이미지) | productId 로 draft 조회 (RLS 검증) |
| `/register/new?step=3&productId=<uuid>` | Step 3 (마켓+카테고리) | 동일 |
| `/register/new?step=4&productId=<uuid>` | Step 4 (미리보기) | `registration-validate` 호출 |
| `/register/new?step=5&jobId=<uuid>` | Step 5 (결과) | `registration-start` 응답으로 받은 jobId. Realtime 구독 |

라우팅 변경 시 query param 은 zod 로 검증 (frontend.md §URL Schema).

### 10.2 공통 위저드 셸 (ASCII 데스크탑)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  사이드바  │  ① 정보 ─── ② 이미지 ─── ③ 마켓·카테고리 ─── ④ 미리보기 ─── ⑤ 결과 │
│   [생략]   │  ●━━━━━━━━━●━━━━━━━━━━━━○━━━━━━━━━━━━━━━○━━━━━━━━━━━━━━━○   │
├───────────┴─────────────────────────────────────────────────────────────┤
│                                                                          │
│                          [ 현재 단계 본문 (10.3~10.7) ]                   │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│   [ ← 이전 ]                                              [ 다음 → ]      │
│                                                          [ blockingReasons │
│                                                            tooltip 영역 ] │
└──────────────────────────────────────────────────────────────────────────┘
```

- `[다음]` 버튼은 해당 단계 zod 통과 시만 활성. 비활성 사유는 `blockingReasons[]` 로 tooltip (CLAUDE.md "실행류 버튼 비활성 사유 표시").
- `[이전]` 은 항상 활성 (Step 5 진행 중 잡 제외).
- 진행 인디케이터: 완료 단계는 ● + 색상 토큰 `--color-state-success`, 현재 단계는 강조 ring, 미완료는 ○.
- 모바일 (≤767px): 상단 stepper 가 dot 으로 축소, "1/5 단계" 텍스트 우측. CTA 는 footer fixed.

### 10.3 Step 1 — 상품 정보 입력 (n16)

**데스크탑 와이어:**

```
┌────────────────────────────── Step 1: 상품 정보 입력 ──────────────────────────────┐
│                                                                                     │
│  상품명 *           [_______________________________________________________]       │
│                     2~100자, 특수문자 일부 제한                                    │
│                                                                                     │
│  판매가 *           [______ 원]      정가     [______ 원]  (선택)                  │
│                                                                                     │
│  브랜드             [______________]  제조사  [______________]                     │
│                                                                                     │
│  내부 카테고리 *    [ 패션의류 > 여성의류 > 원피스           ▼ ]                   │
│                                                                                     │
│  배송정책 *         [ 기본 배송정책 (택배 / 3000원 / 2일)    ▼ ]  [+ 새 정책]      │
│                                                                                     │
│  상세설명 (HTML)    ┌─────────────────────────────────────────────────────────┐    │
│                     │  Tiptap WYSIWYG 에디터 (v0.6 ~)                         │    │
│                     │  [B] [I] [Link] [Img] | 본문 영역                       │    │
│                     │  ─────────────────────────────────────────────────────  │    │
│                     │  <p>여기에 HTML 입력. WYSIWYG 적용됨.</p>              │    │
│                     │                                                         │    │
│                     │  (RichTextEditor + 우측 [ 미리보기 ] 토글)             │    │
│                     └─────────────────────────────────────────────────────────┘    │
│                     ⓘ 50,000자 이내, DOMPurify 로 외부 스크립트/iframe 자동 제거.   │
│                                                                                     │
│                                                              [ 다음 → ]            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**모바일 와이어 (단일 컬럼):**

```
┌─────────── 1/5: 상품 정보 ───────────┐
│ 상품명 *                              │
│ [_______________________________]    │
│                                       │
│ 판매가 *           정가              │
│ [_______]          [_______]          │
│                                       │
│ 브랜드                                │
│ [_______________________________]    │
│                                       │
│ 제조사                                │
│ [_______________________________]    │
│                                       │
│ 내부 카테고리 *                       │
│ [ 패션의류 > 여성의류 > 원피스 ▼ ]   │
│                                       │
│ 배송정책 *                            │
│ [ 기본 배송정책 ▼ ]   [+ 새 정책]   │
│                                       │
│ 상세설명 (HTML)                       │
│ ┌─────────────────────────────────┐  │
│ │ <p>...</p>                      │  │
│ └─────────────────────────────────┘  │
├───────────────────────────────────────┤
│        [ 다음 → ] (fixed)             │
└───────────────────────────────────────┘
```

**shadcn 매핑:**

| 요소 | shadcn 컴포넌트 |
|---|---|
| 텍스트 입력 | `<Input>` |
| 가격 입력 | `<Input type="number">` + 우측 단위 텍스트 (수동 prefix) |
| 카테고리 선택 | `<Combobox>` (cmdk 기반) |
| 배송정책 선택 | `<Select>` + 트리거 버튼 |
| 상세설명 | `<Textarea>` + 별도 `Preview` 토글 (Tabs) |
| `[다음]` | `<Button variant="default">` (실행류는 아님, "진행"이라 default) |
| `[+ 새 정책]` | `<Button variant="outline">` + `<Dialog>` |

**blockingReasons (Step1Schema 미통과 시):**

- `name` 누락 → "상품명은 2자 이상이어야 합니다"
- `price` < 100 → "판매가는 100원 이상이어야 합니다"
- `originalPrice` < `price` → "정가는 판매가 이상이어야 합니다"
- `baseCategoryId` 빈 값 → "내부 카테고리를 선택하세요"
- `shippingPolicyId` 빈 값 → "배송정책을 선택하세요"

### 10.4 Step 2 — 이미지 업로드 (n18)

**데스크탑 와이어:**

```
┌────────────────────────────── Step 2: 이미지 업로드 ──────────────────────────────┐
│                                                                                     │
│  대표 이미지 1장 + 추가 최대 9장 (총 10장). JPG/PNG/WebP, 각 10MB 이하.             │
│                                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │  [대표]     │  │             │  │             │  │             │                │
│  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │  │      +      │                │
│  │  │ image │  │  │  │ image │  │  │  │ image │  │  │   추가      │                │
│  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │  │             │                │
│  │  ⋮ 메뉴     │  │  ⋮ 메뉴     │  │  ⋮ 메뉴     │  │             │                │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                                     │
│  ⓘ 대표 변경: 카드 ⋮ 메뉴 → "대표로 설정". 드래그로 순서 변경.                     │
│                                                                                     │
│  업로드 상태:                                                                      │
│    ● 3 / 10 업로드 완료                                                            │
│    ◐ 변환 대기 중 (등록 시점에 마켓별 변환됩니다)                                  │
│                                                                                     │
│         [ ← 이전 ]                                            [ 다음 → ]            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**이미지 카드 상세:**

```
┌─────────────────────┐
│   [대표] 뱃지       │ ← role='main' 일 때만 표시
│ ┌─────────────────┐ │
│ │                 │ │
│ │   썸네일 200px  │ │
│ │                 │ │
│ └─────────────────┘ │
│ 1024 × 1024 · 234KB │
│         ⋮ 메뉴      │
└─────────────────────┘
  메뉴: 대표로 설정 / 삭제
```

**모바일:** 2열 그리드 (카드 크기 ↓), 드래그 대신 ⋮ 메뉴에 "위/아래로 이동".

**shadcn 매핑:**

| 요소 | 컴포넌트 |
|---|---|
| 업로드 드롭존 | 커스텀 (`<div role="button">`) + react-dropzone |
| 이미지 카드 | `<Card>` + `<DropdownMenu>` |
| 진행 인디케이터 | `<Progress>` (업로드 % per file) |

**blockingReasons:**

- 이미지 0장 → "이미지를 1장 이상 업로드해주세요"
- 대표 미지정 → "대표 이미지를 지정해주세요" (시스템이 첫 업로드를 자동 대표로 지정하므로 발생하지 않아야 함)
- 11장 이상 → "이미지는 최대 10장까지"
- 업로드 진행 중 → "이미지 업로드가 끝날 때까지 기다려주세요"

### 10.5 Step 3 — 마켓 선택 + 카테고리 매핑 (n17 + n19)

**데스크탑 와이어:**

```
┌────────────────────── Step 3: 마켓 선택 + 카테고리 매핑 ──────────────────────┐
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐    │
│  │  연결된 마켓에만 등록할 수 있어요.   [ 마켓 연결 관리 → ]              │    │
│  └───────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌─ 네이버 스마트스토어 ────────────────────────────────────────[ ☑ 선택 ]─┐  │
│  │  연결 상태: ● 정상 (만료까지 27일)                                       │  │
│  │                                                                          │  │
│  │  카테고리 *    [ 패션의류 > 여성의류 > 원피스 > 미니원피스       ▼ ]   │  │
│  │                ⓘ 자동 추천: "여성 원피스" (키워드 매칭)                 │  │
│  │                                                                          │  │
│  │  상품명 오버라이드  [ (기본: products.name 사용)                  ]     │  │
│  │  판매가 오버라이드  [ (기본: products.price 사용)                 ]     │  │
│  │                                                                          │  │
│  │  ▶ 마켓 고유 옵션 (옵션조합·A/S안내·원산지)                            │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ 쿠팡 ──────────────────────────────────────────────────────[ ☑ 선택 ]─┐    │
│  │  연결 상태: ● 정상                                                       │  │
│  │  카테고리 *    [ 패션의류/잡화 > 여성 > 원피스                   ▼ ]   │  │
│  │  ...                                                                     │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌─ 11번가 ─────────────────────────────────────────────────────[ ☑ 선택 ]─┐  │
│  │  연결 상태: ● 정상                                                       │  │
│  │  카테고리 *    [ 패션의류 > 여성의류 > 원피스                    ▼ ]   │  │
│  │  ...                                                                     │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│         [ ← 이전 ]                                            [ 다음 → ]        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**모바일:** 마켓 카드가 세로 단일 컬럼. 카테고리 선택은 풀스크린 모달.

**shadcn 매핑:**

| 요소 | 컴포넌트 |
|---|---|
| 마켓 카드 | `<Card>` + 우상단 `<Checkbox>` (선택 토글) |
| 마켓 고유 옵션 (펼치기) | `<Accordion>` |
| 카테고리 선택 | `<Combobox>` (계층) — 마켓별 트리를 별도 hook 으로 fetch |
| 연결 상태 뱃지 | `<Badge>` |

**카테고리 자동 추천 (v1):**

- 단순 키워드 매칭: `products.name` 토큰을 마켓 카테고리 leaf 이름에 부분 매칭. 최상위 점수 1개를 추천.
- v1 한계 명시: "자동 추천이 정확하지 않을 수 있어요. 직접 확인해주세요" 마이크로 카피.
- v2 에서 ML 기반 추천 (별도 PR).

**blockingReasons:**

- 선택 마켓 0 → "마켓을 1개 이상 선택해주세요"
- 선택 마켓 중 카테고리 미지정 → "<MarketName> 카테고리를 선택해주세요"
- 선택 마켓의 `market_accounts.status` ≠ 'active' → "<MarketName> 연결이 만료되었어요. 다시 연결해주세요" + 마켓 연결 페이지 deep link
- (PR-3.5) 마켓별 동적 required 등록필드 미입력 → 어댑터 메타의 `blockingReason` 문구 (예: ESM "배송 프로필 선택 필요")

#### 10.5.1 MarketOptionsCard — 카테고리 + 마켓별 동적 등록필드 (PR-3.5, 구현 완료)

기존 `CategoryMappingCard` 를 **`MarketOptionsCard`** 로 일반화했다(`CategoryMappingCard` 제거).
마스터: `docs/architecture/v1/features/esm.md §4.6 / §5 / §6`, `cross-cutting/market-adapter.md §9.8`.

- **렌더**: 카테고리 매핑 row(기존) + 어댑터가 선언한 동적 등록필드를 카드 하단에 동적 렌더.
- **마켓 하드코딩 분기 0**: UI 는 동기 resolver `getRegistrationFieldsForMarket(marketId)`(`apps/web/src/lib/markets/registration-fields.ts`)가 돌려준 `RegistrationFieldMeta[]` 의 `kind` 로만 분기. `getRegistrationFields()` 가 순수·정적(mock↔real parity 보장)이므로 무거운 async `getMarketAdapter` 를 await 하지 않는다.
  - ESM(gmarket/auction) → `getEsmRegistrationFields()` = `shippingProfile` 필드 1개. 그 외 → `[]`(카테고리만, 하위호환 회귀 없음).
- **필드 kind 별 렌더**: `shippingProfile` → 배송 프로필 select(`useEsmShippingProfiles(marketAccountId)` 재사용, 4상태: loading/error/data(`status='active'`만)/empty(`/settings/shipping/esm-profiles` deep link CTA)). `number`/`text`/`select`/`officialNotice`(PR-5 전 placeholder) → shadcn `Input` 기본 렌더(확장 대비).
- **값 적재**: 동적 필드 값은 `CategoryMapping.marketOptions[fieldKey]`(zod `z.record`)에 적재.
- **검증(단일 소스)**: `Step3Schema` → `makeStep3Schema(requiredKeysFor)` 빌더. 어댑터가 `required` 로 선언한 fieldKey 가 비어있으면 zod fail. UI 페이지(`StepMarketsCategoriesPage`)는 `getRegistrationFieldsForMarket` 기반 provider 를 주입해 검증·blockingReasons·다음버튼 tooltip 에 공유. 기본 `Step3Schema`(provider 미주입)는 추가필드 검증 skip(하위호환).
- **i18n**: `RegistrationFieldMeta.label`/`helpText`/`blockingReason` 은 i18n key(`markets.registrationFields.*`) → `resolveKoPath()`(`apps/web/src/lib/i18n.ts`)로 해석. 하드코딩 금지.

### 10.6 Step 4 — 등록 미리보기 (n20)

진입 시 `registration-validate` 호출. 응답을 마켓별 카드로 표시.

**데스크탑 와이어 (전체 OK):**

```
┌──────────────────────── Step 4: 등록 미리보기 ────────────────────────┐
│                                                                         │
│  ✓ 2/2 마켓 검증 통과. 등록 가능합니다.                                │
│                                                                         │
│  ┌─ 네이버 스마트스토어 ─────────────────────────[ ✓ 검증 OK ]─┐     │
│  │  상품명: 가을 미니 원피스 (블랙)                                │     │
│  │  판매가: 29,900 원   정가: 39,000 원   할인율: 23%             │     │
│  │  카테고리: 패션의류 > 여성의류 > 원피스 > 미니원피스           │     │
│  │  배송: 택배 / 3,000 원 / 2일                                    │     │
│  │  대표 이미지: [ thumbnail ] (변환 후: 640×640 JPEG)             │     │
│  │  추가 이미지: 3장                                              │     │
│  │  예상 등록 수수료: 자료 없음                                   │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─ 쿠팡 ───────────────────────────────────────[ ✓ 검증 OK ]─┐       │
│  │  ...                                                          │       │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│         [ ← 이전 ]                                  [ 일괄 등록 → ]    │
└─────────────────────────────────────────────────────────────────────────┘
```

**데스크탑 와이어 (1마켓 검증 실패):**

```
┌──────────────────────── Step 4: 등록 미리보기 ────────────────────────┐
│                                                                         │
│  ⚠ 1/2 마켓에서 문제가 발견되었습니다.                                 │
│                                                                         │
│  ┌─ 네이버 스마트스토어 ─────────────────────────[ ✗ 검증 실패 ]─┐    │
│  │                                                                   │  │
│  │  ✗ 브랜드 입력이 필요해요                                        │  │
│  │     "여성의류 > 원피스" 카테고리는 브랜드가 필수입니다.           │  │
│  │     [ Step 1 로 돌아가 수정하기 → ]                              │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─ 쿠팡 ───────────────────────────────────────[ ✓ 검증 OK ]─┐       │
│  │  ...                                                          │       │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│         [ ← 이전 ]    [ 쿠팡만 등록 ]                [ 일괄 등록 → ]    │
│                       (실패한 마켓은 자동 제외)        (모든 선택 마켓)  │
└─────────────────────────────────────────────────────────────────────────┘
```

**shadcn 매핑:**

| 요소 | 컴포넌트 |
|---|---|
| 검증 결과 카드 | `<Card>` + 상단 status badge |
| 일괄 등록 CTA | `<Button variant="default" size="lg">` |
| "Step 1 로 돌아가 수정" | `<Button variant="link">` (라우터 query param 변경) |

**`[일괄 등록]` 버튼 동작:**

- 클릭 시 `registration-start` 호출 → 응답 jobId 받으면 Step 5 로 이동 (`?step=5&jobId=...`).
- 검증 실패가 있으면 비활성. blockingReasons: "검증을 통과한 마켓이 없습니다" 또는 "검증 실패한 마켓이 있어요" + `[검증 통과 마켓만 등록]` 보조 CTA.

### 10.7 Step 5 — 등록 결과 (n21 + n23 + n24 + n25)

**진입 직후 (잡 pending → running, Realtime 구독 중):**

```
┌──────────────────────── Step 5: 등록 진행 ───────────────────────────┐
│                                                                       │
│  잡 #a3f9-... 진행 중                                  [ 취소 ]      │
│  ⏳ 0/2 완료                                                          │
│                                                                       │
│  ┌─ 네이버 스마트스토어 ─────────────────────────────────────────┐  │
│  │  ◐ 등록 중...                                                   │  │
│  │  시도 1 / 5                                                     │  │
│  │  이미지 변환 → 등록 요청 전송                                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─ 쿠팡 ────────────────────────────────────────────────────────┐   │
│  │  ◐ 등록 중...                                                   │  │
│  │  시도 1 / 5                                                     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ⓘ 이 화면을 닫아도 등록은 계속 진행됩니다. 결과는 [이력]에서 확인.   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

**완료 — succeeded (2/2 성공):**

```
┌──────────────────────── Step 5: 등록 완료 ────────────────────────────┐
│                                                                        │
│  ✓ 모든 마켓에 등록되었습니다 (2/2)                                   │
│                                                                        │
│  ┌─ 네이버 스마트스토어 ─────────────────────[ ✓ 성공 ]──────────┐  │
│  │  상품 ID: 1234567890                                             │  │
│  │  [ 마켓에서 보기 → ]                                             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─ 쿠팡 ────────────────────────────────────[ ✓ 성공 ]──────────┐    │
│  │  상품 ID: COUPANG-9876                                          │  │
│  │  [ 마켓에서 보기 → ]                                             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│         [ 새 상품 등록 ]      [ 이력으로 이동 ]    [ 대시보드로 ]    │
└────────────────────────────────────────────────────────────────────────┘
```

**완료 — partial (1 성공, 1 실패):**

```
┌──────────────────────── Step 5: 부분 등록 완료 ───────────────────────┐
│                                                                        │
│  ⚠ 부분 등록 — 1/2 성공                                                │
│                                                                        │
│  ┌─ 네이버 스마트스토어 ─────────────────────[ ✓ 성공 ]──────────┐  │
│  │  상품 ID: 1234567890   [ 마켓에서 보기 → ]                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─ 쿠팡 ────────────────────────────────────[ ✗ 실패 ]──────────┐    │
│  │  쿠팡 서버 일시 오류로 등록에 실패했어요 (시도 5/5)             │  │
│  │  [ 자세히 보기 ▼ ]                                              │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │ error_code: market_server                                  │ │  │
│  │  │ error_message: HTTP 503 from coupang-api                  │ │  │
│  │  │ last_attempted_at: 2026-05-18 14:23:11                    │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │                                                                  │  │
│  │  [ 이 마켓만 재시도 ]   [ 쿠팡 제외하고 완료 처리 ]              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  [ 모든 실패 마켓 재시도 (n24) ]   [ 실패 마켓 제외 후 재등록 (n25) ] │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**완료 — failed (2/2 실패):**

```
┌──────────────────────── Step 5: 등록 실패 ────────────────────────────┐
│                                                                        │
│  ✗ 모든 마켓 등록 실패 (0/2)                                          │
│                                                                        │
│  ┌─ 네이버 ────────────────────────[ ✗ 실패 ]─[ 자세히 ▼ ]────────┐  │
│  ┌─ 쿠팡 ──────────────────────────[ ✗ 실패 ]─[ 자세히 ▼ ]────────┐  │
│                                                                        │
│  [ 모두 재시도 (잡 retry 1/5) ]    [ 처음부터 다시 (새 잡) ]           │
└────────────────────────────────────────────────────────────────────────┘
```

**액션 분기:**

| 사용자 액션 | 호출 API | user_flow 노드 |
|---|---|---|
| `[이 마켓만 재시도]` | `registration-retry` (marketResultIds=[id]) | n24 |
| `[모든 실패 마켓 재시도]` | `registration-retry` (marketResultIds=undefined) | n24 |
| `[실패 마켓 제외 후 재등록]` | `registration-start` (parentJobId=현재 jobId, marketIds=성공+미시도 마켓) | n25 |
| `[취소]` | `registration-cancel` | (취소 흐름) |
| `[새 상품 등록]` | `/register/new` 진입 | (s3 재시작) |
| `[이력으로 이동]` | `/history?jobId=...` | s6 |
| `[대시보드로]` | `/dashboard` | s2 |

**shadcn 매핑:**

| 요소 | 컴포넌트 |
|---|---|
| 마켓 결과 카드 | `<Card>` |
| 상태 뱃지 | `<Badge variant="success" | "destructive" | "secondary">` |
| 오류 펼치기 | `apps/web/src/components/ui/error-message.tsx` (`<ErrorMessage>` 접기 기본, CLAUDE.md 강제) |
| 재시도 / 제외 CTA | `<Button variant="default">` (실행류) + 비활성 시 tooltip |
| 취소 | `<Button variant="ghost">` + `<AlertDialog>` 확인 |

---

## 11. 상태 처리 — loading / data / error / empty / partial

CLAUDE.md "프론트엔드 UI 일관성" §4상태 + partial 처리 에 따라 본 도메인은 **5상태 전부** 명시 처리.

| 상태 | Step 별 발생 | UI |
|---|---|---|
| **loading** | Step 4 validate 호출 / Step 5 진입 직후 / `registration-start` 호출 / Realtime 도착 전 | 스켈레톤 카드 + `<Spinner>` |
| **data** | 정상 진행 / 정상 완료 | 본문 와이어 (§10) |
| **error** | API 호출 실패 (network/5xx) | `<ErrorMessage>` + 재시도 버튼 (자동 재시도 별개) |
| **empty** | Step 1 진입 시 마켓 연결 0개 | 빈 상태 카드 + "마켓 연결하기 →" deep link |
| **partial** | Step 5 잡 상태 = `partial` | §10.7 partial 와이어 + 재시도/제외 액션 |

### 11.1 partial 시각화 ASCII

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠ 부분 등록   1 / 2 성공                                    │ ← banner: 색상 토큰 --color-state-warning
│                                                                │   (ui-system.md 인용)
├──────────────────────────────────────────────────────────────┤
│  [naver]  ● 성공         외부 ID: 12345  [마켓에서 보기 →]  │ ← 마켓 색 dot (#03C75A)
│  [coupang] ● 실패        시도 5/5        [자세히 ▼]           │ ← 마켓 색 dot (#F11F44)
└──────────────────────────────────────────────────────────────┘
```

마켓 색·아이콘은 `ui-system.md` §marketTokens 인용 (naver=#03C75A / coupang=#F11F44 / 11st=#FF0038 / gmarket=#00B147 / auction=#E73936).

### 11.2 4상태 + partial 의 빈 상태 (empty) 케이스

- 셀러가 마켓 1개도 연결하지 않은 채 `/register/new` 진입 → Step 3 진입 시 모든 카드가 "v2 예정" 또는 "연결 필요". → Step 3 의 blockingReasons 가 "마켓 연결이 필요합니다" + 마켓 연결 deep link 만 표시. Step 1·2 작성은 가능하나 Step 4 진입 차단.

---

## 12. 에러 매핑 — `jmr.error_code` → 사용자 한국어 메시지

> `market-adapter.md` §7 의 `MarketError` 6코드 → 본 도메인 `registration_job_market_results.error_code` 10코드 분류는 **`registration-job-state.md` §6.2.1 매핑 표** 가 단일 출처. 본 절은 분류 결과인 `jmr.error_code` 를 사용자 한국어 메시지로 변환하는 표만 정의한다. 재시도 가능 여부 / 상태 매핑은 본 표에서 정의하지 않고 `registration-job-state.md` §6.2 참조.

| jmr.error_code | 한국어 메시지 (사용자) | 수정 가이드 (UI hint) |
|---|---|---|
| `validation` | 입력값이 마켓 기준에 맞지 않아요 | `field` 표시 + Step 으로 돌아가 수정 |
| `oauth_expired` | 마켓 인증이 만료되었어요. 자동 갱신 중입니다 | (자동 처리, 실패 시 oauth_revoked 로 분류 전환) |
| `oauth_revoked` | 마켓 인증이 끊겼어요 | "마켓 다시 연결하기 →" deep link |
| `rate_limit` | 마켓 요청 한도에 걸렸어요. 잠시 후 재시도해요 | 자동 재시도 진행 표시 |
| `market_5xx` | 마켓 서버 일시 오류 | 자동 재시도 진행 (최대 3회) |
| `timeout` | 마켓 응답이 늦어요 | 자동 재시도 진행 |
| `image_invalid` | 이미지가 마켓 규격에 맞지 않아요 | "Step 2 로 돌아가 다른 이미지 사용" |
| `duplicate` | 마켓에 이미 같은 상품이 등록되어 있어요 | 외부 상품 ID 표시 + "기존 상품 보기" |
| `quota_exceeded` | 마켓 일일 등록 한도를 초과했어요 | "내일 다시 시도해주세요" |
| `unknown` | 알 수 없는 오류가 발생했어요 | "잠시 후 다시 시도해주세요" + 잡 ID 표시 (Sentry 추적용) |

추가 마켓 고유 코드는 어댑터별 매핑 테이블 (`apps/web/src/lib/markets/<id>/errors.ts`) 에서 한국어 메시지로 변환 후 `errorMessage` 로 적재.

---

## 13. 보안 (security.md 인용)

### 13.1 클라이언트 → 마켓 API 직접 호출 금지

- 클라이언트는 `supabase.functions.invoke('registration-*')` 만 호출. 마켓 도메인 (api.naver.com, api.coupang.com 등) 에 직접 fetch 하는 코드는 ESLint 룰 `no-restricted-imports` + `no-restricted-globals` 로 차단 (frontend.md §lint-rules 인용).
- CORS: 마켓 도메인은 셀러 브라우저에서 호출되지 않으므로 CORS 설정 불필요. Edge Function 의 `allow-origin` 은 자체 도메인만.

### 13.2 토큰 접근 (credential-vault.md 인용)

- `registration-market-worker` 만 `market_credentials.decrypt_token(market_account_id)` RPC 호출 가능. RPC 는 service_role 검증 + `auth.uid()` ≠ null 조건. credential-vault.md §RPC 정의 인용.
- 토큰 사용 후 메모리에서 즉시 폐기 (Deno V8 GC 의존 + try/finally 에서 `tokenSet = null`).
- 토큰 refresh 발생 시 `market_credentials` UPDATE 는 동일 함수 내에서. 새 access_token 이 log / Sentry 로 새지 않도록 `beforeSend` 마스킹 (security.md §beforeSend) + 로그 화이트리스트 키 제한.

### 13.3 로그 마스킹 + correlationId / jobId

모든 `registration-*` Edge Function 의 외부 호출은 다음 키만 기록 (CLAUDE.md "외부 API 로깅 패턴"):

```ts
logger.info({
  event: 'market_request',
  market,            // 'naver' | 'coupang'
  method,            // 'POST'
  urlHost,           // host 만 (path/query 제외)
  sellerId,          // UUID (PII 아님)
  jobId,
  correlationId,
  attempt,
}, '→ market request');

logger.info({
  event: 'market_response',
  market,
  httpStatus,
  durationMs,
  sellerId, jobId, correlationId,
}, '← market response');

logger.error({
  event: 'market_error',
  market,
  err: maskError(e),   // code / message 만 — security.md maskError
  sellerId, jobId, correlationId,
}, '← market error');
```

**금지 키 (Sentry beforeSend / logger filter 둘 다 차단):**
- `accessToken` / `refreshToken` / `apiKey` (전체 토큰)
- `email` / `phone` / `password` / `name` (셀러 PII)
- `tokenLength` 만 허용 (디버그용)

### 13.4 RLS bypass 경로 명시

- `registration-market-worker` 는 service_role 사용. **security.md §RLS-Bypass-Allowlist 에 등록 필수**. 검수 항목:
  - seller_id 는 jobId 조회로만 결정 (요청자가 임의 지정 불가).
  - 토큰 복호화 RPC 호출 전에 `auth.users(id)` 존재 확인.
  - audit 로그 (`registration_audit_log` v2) 에 함수 호출 1건당 1줄.

### 13.5 HTML 상세설명 XSS 방지

- Step 1 의 `descriptionHtml` 은 클라이언트에서 DOMPurify 통과 (browser sanitize) 후 서버 전송.
- 서버 측 정합 검증: `registration-validate` 가 동등 sanitize (Deno-compatible sanitize 라이브러리, 예: `isomorphic-dompurify`). 결과가 다르면 `validation` 에러로 거부.
- `<script>` / `<iframe>` / `on*=` / `javascript:` URL 모두 제거.

---

## 14. 이미지 처리 (image-pipeline.md 인용)

본 절은 image-pipeline.md 의 흐름을 본 도메인 시점으로 인용한다. 변환 로직·DDL·Storage 경로는 image-pipeline.md 가 단일 진실 원장.

### 14.1 Step 2 업로드 흐름

1. 사용자가 파일 선택 → 클라이언트가 `image-upload-url` Edge Function 호출 → signed PUT URL 수령.
2. 클라이언트가 Storage 에 PUT (브라우저 → Supabase Storage 직접).
3. 클라이언트가 `product_images` INSERT (RLS = 본인 seller_id 강제).
4. Step 2 zod 검증 통과 (대표 1장 + 1~10장).

### 14.2 잡 시작 시 변환 트리거

- `registration-market-worker` 가 마켓별로 `image-transform` Edge Function 을 호출.
- 멱등 키 = `(image_id, market_id)`. 이미 변환본이 있으면 skip.
- 변환본은 `product-images-transformed/<sellerId>/<productId>/<market>/<imageId>.<ext>` 에 저장.
- 변환 결과는 `adapter.transformProduct` 의 `mapping.imageUrls` 로 전달.

### 14.3 실패 처리

- `image-transform` 실패 → 해당 마켓 결과 `failed` (error_code=`image_invalid` 분류 시 즉시 `failed_final`) 로 마킹.
- 다른 마켓 worker 는 자기 image-transform 만 영향 (격리).
- 재시도: `registration-retry` 호출 시 image-transform 도 다시 실행 (멱등 키 hit 시 skip).

---

## 15. 카테고리 매핑 (Step 3)

### 15.1 마켓별 카테고리 트리 로드

- 클라이언트가 마켓 선택 시 `MarketAdapter.fetchCategoryTree()` 결과를 가져옴.
- 클라이언트는 마켓 API 직접 호출 금지 → Edge Function `markets-category-tree` (features/markets.md §category-tree) 경유.
- 응답은 `market_category_cache` (features/markets.md §cache) 에 24h TTL 캐시. Hit 시 즉시 응답, miss 시 어댑터 호출 후 적재.
- `CategoryNode` 스키마는 market-adapter.md §3 정의.

### 15.2 자동 추천 (v1 단순 키워드 매칭)

```ts
// apps/web/src/features/registration/lib/categoryAutoMatch.ts
function suggestCategory(
  productName: string,
  tree: CategoryNode[]
): CategoryNode | null {
  const tokens = productName.toLowerCase().split(/\s+/);
  let bestScore = 0;
  let best: CategoryNode | null = null;

  function walk(node: CategoryNode) {
    if (node.isLeaf) {
      const nameLower = node.name.toLowerCase();
      const score = tokens.filter((t) => nameLower.includes(t)).length;
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    node.children?.forEach(walk);
  }
  tree.forEach(walk);

  return bestScore >= 1 ? best : null;
}
```

- 점수가 0 이면 추천 표시하지 않음. 사용자가 직접 선택.
- v2: ML 기반 (PRD §1.2.1 자동 매칭 알고리즘 — v2 백로그).

### 15.3 카테고리 유효성

- 마켓 leaf 코드만 허용. 중간 노드 선택 시 zod `category_not_leaf` 에러.
- 클라이언트 `<Combobox>` 가 leaf 만 선택 가능하도록 비활성 처리.

---

## 16. 재시도 / 마켓 제외 후 재등록 (n24 / n25)

### 16.1 n24 — 재시도 (registration-retry)

- **대상**: 현재 잡의 `failed` 결과 행. `failed_final` 행은 거부.
- **동작**:
  1. `registration_jobs.retry_count++` (max 5).
  2. 잡 status = `retrying`.
  3. 대상 결과 행의 `market_status = 'pending'`, `attempt_count = 0` 리셋.
  4. `registration-market-worker` 재 invoke.
- **사용자 UI**: Step 5 의 `[이 마켓만 재시도]` / `[모든 실패 마켓 재시도]` 버튼.
- **자동 재시도 vs 수동 재시도**: 어댑터 내부 `withRetry` (5회) 는 자동. 그 5회가 모두 실패 → 마켓 결과 = `failed` (재시도 가능 코드인 경우) 또는 `failed_final` (재시도 불가 코드인 경우). 그때부터는 **사용자 명시적 재시도** 만 trigger.

### 16.2 n25 — 마켓 제외 후 재등록 (`registration-start` + parentJobId)

- **새 잡 생성**. 기존 잡은 그대로 유지 (감사 추적용).
- 클라이언트가 `registration-start({ productId, marketIds: 성공+미시도 마켓, parentJobId: 기존 잡 })` 호출.
- 기존 잡의 실패 마켓 (excluded=true 로 마킹) 은 새 잡에서 빠짐.
- registration-job-state.md §parentJob 인용 — 부모-자식 잡 추적은 같은 product_id 에 N잡 허용 (advisory lock 은 productId 만 잠그므로 부모 잡 종료 후만 새 잡 생성 가능).

### 16.3 결정 인용

> `registration-job-state.md` §6.4 "n25 의 새 잡은 부모 잡의 product_id 가 같지만 별도 `registration_jobs` row 로 생성한다. 부모 잡이 `partial` / `failed` / `cancelled` 일 때만 허용. `pending` / `running` / `retrying` 부모에서는 거부 (advisory lock 충돌)."

---

## 17. 테스트 매트릭스 (testing.md 양식)

| ID | 대상 | 시나리오 | 입력 | 기대 결과 | 도구 |
|---|---|---|---|---|---|
| **R-H1** | E2E happy | 2마켓 동시 성공 | 정상 product + naver/coupang 선택 | 잡 status=succeeded, market_results 둘 다 success, externalId 받음 | Playwright |
| **R-H2** | E2E happy | 1마켓만 선택 (naver) → 성공 | 정상 product + naver 만 | 잡 status=succeeded | Playwright |
| **R-P1** | partial | 2마켓 중 1 실패 (coupang 5xx 5회) | MSW: coupang 5회 500 | 잡 status=partial, naver=success, coupang=failed, attempt=5 | Vitest + MSW |
| **R-P2** | partial UI | partial 화면 액션 노출 | R-P1 상태 | `[재시도]` + `[마켓 제외 등록]` 버튼 보임, naver 카드는 외부 ID 링크 표시 | Playwright |
| **R-RT1** | retry 자동 (어댑터 withRetry) | rate_limit 후 자동 재시도 성공 | MSW: 1회 429 → 200 | 마켓 결과=success, attempt_count=2 (어댑터 내부) | Vitest + MSW |
| **R-RT2** | retry 자동 한도 초과 | 5회 모두 5xx | MSW: 5회 500 | 마켓 결과=failed, errorCode=market_5xx, attempt=5 | Vitest + MSW |
| **R-RT3** | retry 수동 (n24) | partial 잡에서 재시도 클릭 → 성공 | R-P1 → `registration-retry` | 잡 status=succeeded, retry_count=1 | Playwright |
| **R-RT4** | retry 수동 한도 초과 | 잡 retry 5회 초과 시도 | retry_count=5 → 또 재시도 | 422 retry_exceeded, UI 비활성 + 사유 표시 | Vitest |
| **R-EX1** | n25 마켓 제외 등록 | partial 잡 → 실패 마켓 제외 후 새 잡 | R-P1 → `[마켓 제외 등록]` | 새 잡 생성, parent_job_id 채워짐, marketIds=[naver] (naver 는 이미 성공이라 v1 에서도 새 잡으로 진행) | Playwright + Vitest |
| **R-C1** | cancel | 사용자 취소 | running 잡에서 `[취소]` | 잡 status=cancelled, in_flight worker 가 cancel signal 감지 후 결과=failed_final(cancelled) | Vitest |
| **R-C2** | cancel terminal | 종료 잡 취소 시도 | succeeded 잡에서 cancel | 409 already_finalized | Vitest |
| **R-IMG1** | 이미지 변환 실패 | naver 이미지 변환 실패 | image-transform 500 (naver만) | naver=failed_final(image_invalid), coupang=success → partial | Vitest + MSW |
| **R-IMG2** | 이미지 멱등 | 같은 이미지 재변환 | image-transform 재호출 (hash hit) | skip + 캐시 hit 로그, 결과 동일 | Vitest |
| **R-IMG3** | 이미지 0장 | Step 2 통과 시도 | images=[] | Step2Schema fail, `[다음]` 비활성 | Vitest (RHF) |
| **R-IMG4** | 대표 미지정 | 대표 이미지 없음 | role='sub' 만 5장 | Step2Schema fail | Vitest |
| **R-TOK1** | 토큰 만료 자동 갱신 | access_token expired | refreshToken → 새 토큰 → createProduct 성공 | 마켓 결과=success, credentials 갱신 | Vitest + MSW |
| **R-TOK2** | refresh 실패 | refreshToken 도 401 | 사용자 재인증 요구 | 마켓 결과=failed_final(oauth_revoked), UI 에 "마켓 다시 연결" deep link | Vitest |
| **R-V1** | validate happy | Step 4 진입 시 검증 통과 | 모든 필드 채움 | issues=[], previews 마켓 수만큼 | Vitest |
| **R-V2** | validate brand 누락 | 의류 카테고리 + brand=null | validate 호출 | issues=[brand_required], `[일괄 등록]` 비활성 | Vitest |
| **R-V3** | validate 카테고리 leaf 아님 | 중간 노드 선택 | validate | issues=[category_not_leaf] | Vitest |
| **R-V4** | validate token_expired | market_account expired | validate | issues=[token_expired] + 재연결 hint | Vitest |
| **R-CONC1** | 동시 잡 충돌 | 같은 productId 로 2회 동시 start | 두 번째 호출 | 409 job_in_progress (advisory lock) | Vitest |
| **R-CONC2** | 다른 product 병렬 | productA / productB 동시 start | 둘 다 성공 | 잡 2개 모두 running → succeeded | Vitest |
| **R-RLS1** | RLS 다른 셀러 잡 조회 | sellerA 가 sellerB 의 jobId 조회 | SELECT | 0 row (RLS 차단) | Vitest (Supabase) |
| **R-RLS2** | RLS 다른 셀러 product 등록 | sellerA 가 sellerB productId 로 start | start 호출 | 403 forbidden_product | Vitest |
| **R-RT5** | Realtime broadcast | running → succeeded 전이 | DB UPDATE | 클라이언트 Realtime 메시지 ≤2s 내 도착, UI 갱신 | Playwright (Realtime) |
| **R-RT6** | Realtime fallback | WebSocket 끊김 | 5s 안에 메시지 없음 | TanStack Query polling 으로 fallback, terminal 도달 시 stop | Playwright |
| **R-ERR1** | 에러 메시지 한국어 | 어댑터 `MarketError('rate_limit')` | UI 노출 | "마켓 요청 한도에 걸렸어요" + 자동 재시도 표시 | Vitest |
| **R-ERR2** | 긴 에러 메시지 접기 | createProduct 가 긴 raw 응답 | UI | `<ErrorMessage>` 접기 기본, 펼치기 클릭 시 stack 전체 | Playwright |
| **R-SEC1** | 로그 마스킹 | createProduct 호출 로그 | log capture | accessToken / refreshToken / email / phone 없음, tokenLength 만 | Vitest |
| **R-SEC2** | Sentry 마스킹 | 어댑터 throw 시 Sentry transport | Sentry breadcrumb | 금지 키 없음 | Vitest (Sentry test transport) |
| **R-SEC3** | XSS sanitize | description_html 에 `<script>` | Step 1 입력 → 서버 검증 | 클라이언트·서버 둘 다 `<script>` 제거 | Vitest |
| **R-A11Y1** | 키보드 동선 | Step 1~5 전체를 키보드만 | Tab/Enter/Space | 모든 input/button reachable, focus ring 보임 | Playwright + axe |
| **R-A11Y2** | 색상 대비 | partial 뱃지 색상 | axe-core | 대비 ≥ 4.5:1 | Playwright + axe |

### 17.1 골든 패스 (qa 강제, Playwright)

CLAUDE.md "qa 룰" 의 골든 패스 (s1 로그인 → s5 마켓 연결 → s3 등록 6단계 → s6 이력 확인) 의 s3 구간은 **R-H1 (2마켓 동시 성공)** 으로 자동화.

---

## 18. 수락 기준 체크리스트 (Phase 3 PASS 표)

본 문서가 머지되려면 아래 모두 ✓ 표기.

| 항목 | 기준 | 검증 방법 | PASS |
|---|---|---|---|
| 1 | user_flow s3 (n15~n25) 11 노드 매핑표 존재 | §1.3 표 | ☐ |
| 2 | ERD 가 5개 핵심 테이블 + 외부 참조 모두 포함 | §2 | ☐ |
| 3 | 4개 신규 테이블 DDL + RLS 정책 4종 (S/I/U/D) 명시 | §3 | ☐ |
| 4 | 상태 전이는 registration-job-state.md 인용만, 신규 정의 없음 | §4 | ☐ |
| 5 | 마켓별 필수 필드 표 (naver/coupang) 존재 | §5.3 | ☐ |
| 6 | 5개 Edge Function 의 zod request/response 스키마 정의 | §6.2~6.6 | ☐ |
| 7 | happy / partial / 격리 / 재시도 시퀀스 ASCII 존재 | §7 | ☐ |
| 8 | Realtime 채널 2개 + RLS 호환 + polling fallback | §8 | ☐ |
| 9 | 단일 zod 소스 (`apps/web/src/lib/schemas/registration.ts`) 의 Step 별 스키마 | §9 | ☐ |
| 10 | 5단계 위저드 와이어 데스크탑+모바일 ASCII | §10 | ☐ |
| 11 | shadcn 컴포넌트 매핑 표 단계별 존재 | §10 | ☐ |
| 12 | `blockingReasons` 단계별 명시 | §10 | ☐ |
| 13 | loading/data/error/empty/**partial** 5상태 처리 | §11 | ☐ |
| 14 | MarketError code → 한국어 메시지 + 수정 가이드 표 | §12 | ☐ |
| 15 | 클라이언트 → 마켓 API 직접 호출 차단 (lint+CORS+CSP) 명시 | §13.1 | ☐ |
| 16 | 토큰 접근은 credential-vault.md RPC 만 + 메모리 폐기 | §13.2 | ☐ |
| 17 | 로그 화이트리스트 + Sentry 마스킹 명시 | §13.3 | ☐ |
| 18 | RLS bypass (service_role) 경로 명시 + audit | §13.4 | ☐ |
| 19 | XSS sanitize 클라이언트+서버 양쪽 | §13.5 | ☐ |
| 20 | 이미지 변환 트리거 + 멱등 + 격리 | §14 | ☐ |
| 21 | 카테고리 자동 추천 v1 한계 명시 + v2 백로그 표기 | §15 | ☐ |
| 22 | n24 / n25 분리 정의 (retry vs 새 잡) | §16 | ☐ |
| 23 | 테스트 매트릭스 30+ 케이스 (E2E + 단위 + 보안 + 접근성) | §17 | ☐ |
| 24 | 골든 패스에 R-H1 포함 | §17.1 | ☐ |
| 25 | 미해결 사안 명시 (있다면) | §19 | ☐ |
| 26 | security 리뷰 요청 (§13 전체) | PR reviewer | ☐ |
| 27 | qa 리뷰 요청 (§17 매트릭스) | PR reviewer | ☐ |
| 28 | frontend 리뷰 요청 (§10 와이어) | PR reviewer | ☐ |
| 29 | designer 리뷰 요청 (§10 + §11 partial 시각) | PR reviewer | ☐ |
| 30 | architect 승인 | 최종 머지 게이트 | ☐ |

---

## 19. 미해결 사안

본 문서 머지 후 별도 PR / 의사결정 필요한 항목.

1. **카테고리 자동 추천 v2** — ML 모델 (예: 토픽 분류) 도입 여부. v1 은 키워드 매칭. 정확도 KPI 기준치 미정 → 베타 운영 데이터 수집 후 결정 (PRD §1.2.1).
2. **잡 단위 재시도 한도 5회의 적정성** — 현재 `retry_count ≤ 5` (registration-job-state.md). 베타 단계에서 사용자 행동 데이터로 조정. 베이스라인 측정용 메트릭은 `events` 테이블에 적재 (CLAUDE.md "KPI 측정").
3. **`registration-market-worker` 의 60s timeout 으로 충분한가** — 마켓별 P95 응답 시간 측정 후 결정. 부족하면 분할 (image-transform 1회 + createProduct 1회 = 2 호출) 으로 쪼개야 함. 본 v1 은 단일 worker 가 둘 다 처리.
4. **잡 cancel 시 in_flight worker 의 idempotent rollback** — 마켓에 이미 createProduct 가 200 으로 돌아온 직후 cancel 이 들어왔을 때, 외부 상품을 자동 삭제할지 / 사용자에게 알리고 수동 정리 시킬지. v1 은 **수동 알림** (외부 상품은 그대로 두고 마켓 결과 = `success`, 잡 status = `cancelled` 모순 → registration-job-state.md §6.5 가 처리). v2 에서 `adapter.deleteProduct` 메서드 추가 검토.
5. **n25 새 잡의 product_id 동일 + 부모-자식 추적의 이력 UI 표현** — s6 (history) 에서 잡 목록을 어떻게 그룹핑할지. features/history.md 에서 결정.
6. **마켓별 카테고리 트리 캐시 TTL** — 24h (features/markets.md §cache) 가 적절한지, 마켓의 카테고리 개편 빈도에 따라 재조정. v2 에서 webhook 기반 invalidation 검토.
7. **`product_market_mappings.market_options` jsonb 의 스키마 검증** — 현재 free-form jsonb. 마켓별 어댑터에서 자체 검증하지만, DB 레벨 CHECK 가 없다. 추후 마켓별 jsonschema 도입 가능성.
8. **이미지 변환의 비용** — image-transform 함수가 Edge Function timeout 안에 끝나는지 (이미지 크기 / 마켓 수 / 등록 수 증가 시). 별도 워커 큐로 분리 필요성은 베타 모니터링 후 판단.

---

> **본 문서는 v1 의 가장 두꺼운 산출물이며, architect + security + backend + frontend + qa 5자 승인 전까지 `apps/web/src/features/registration/*` 및 `apps/api/supabase/functions/registration-*` 구현 PR 은 머지되지 않는다.**
