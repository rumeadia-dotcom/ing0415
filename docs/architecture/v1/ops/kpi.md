# KPI 운영 설계 (v1)

> **상태**: v1 확정 / Phase 4 (backend) + Phase 6 (ops) 영향
> **소유**: ops (backend 와 공동) · security 검수 필수
> **선행 문서**: [`platform.md`](../platform.md) §7 · [`security.md`](../security.md) §6.5, §8.1 · [`cross-cutting/registration-job-state.md`](../cross-cutting/registration-job-state.md) §3 · [`features/auth.md`](../features/auth.md) §session · [`features/registration.md`](../features/registration.md) · [`features/dashboard.md`](../features/dashboard.md)
> **연관 PRD**: §1.핵심지표, §1.3.1, §2.1, §4.1.1

---

## 1. 목적·범위 + 비기능 제약

### 1.1 목적
PRD 가 명시한 4개 핵심지표(월간 총 등록 건수 / MAU / 평균 등록 시간 단축률 / NPS)를 **Supabase 내부 자원만으로** 측정·집계한다. 외부 분석 도구(PostHog · Mixpanel · Amplitude · GA · Hotjar 등) **도입하지 않음**. 이는 [`security.md`](../security.md) §6.5 의 PII 원격 분석 차단 결정과 일관된 입장이다.

### 1.2 범위
- **포함**: 이벤트 모델(`events`), 세션 모델(`sessions`), NPS 모델(`nps_responses`), 계산 view 4종, 수집 시점 매트릭스, 보관·익명화 정책, 운영자 SQL 동선, 외부 도구 도입 시 가드레일.
- **제외**: 셀러용 마켓별 상세 통계(v2), 광고 효율 집계(v2), 실시간 KPI 푸시(v2), 어드민 SPA 화면(v1 에서는 Supabase Studio SQL 만).

### 1.3 비기능 제약
| 제약 | 내용 | 근거 |
|---|---|---|
| **PII 외부 노출 0** | events / sessions / nps_responses 어느 것도 이메일·이름·전화·IP 평문·UA 평문 저장 금지. `seller_id` UUID 만 식별자. | `security.md` §8.1 |
| **Supabase 내부 집계** | view 는 Postgres 안에서 정의. 외부 ETL · 외부 분석 SDK 없음. | `security.md` §6.5 / CLAUDE.md "KPI 측정" |
| **RLS 의무화** | 모든 테이블 + view 가 RLS 또는 SECURITY DEFINER + 본인 데이터 가드 적용. | `security.md` §3.1 |
| **마이그레이션 단일 소스** | DDL · view 정의는 `supabase/migrations/` 한 곳. debug / real 두 프로젝트에 동일 적용. | `platform.md` §5.3 |
| **클라이언트 발생 이벤트는 인증된 세션에서만** | 익명 사용자 트래킹 금지 (가입 전 funnel 측정은 v2). | `security.md` §8.1 |
| **events·sessions 적재 실패는 사용자 동선을 막지 않음** | best-effort. 5xx 시 console.warn 만, UI 차단 금지. | KPI 가용성 < 핵심 비즈니스 가용성 |

---

## 2. 이벤트 모델

### 2.1 `events` 테이블 DDL

```sql
-- 2.1.1 ENUM: event_type / event_source
create type public.event_source as enum (
  'web',        -- React 클라이언트에서 직접 insert
  'edge_fn',    -- Edge Function 내부에서 service_role 로 insert
  'db_trigger'  -- Postgres 트리거에서 insert (registration_jobs 상태 변화 등)
);

create type public.event_type as enum (
  -- 인증 (s1)
  'login_success',
  'signup_completed',
  'password_reset_completed',
  -- 대시보드 (s2)
  'dashboard_viewed',
  -- 등록 (s3)
  'registration_started',          -- 1단계 진입 (잡 생성 전)
  'registration_step_advanced',    -- 위저드 단계 이동 (payload.step)
  'registration_submitted',        -- 5단계에서 "일괄 등록" 클릭 → 잡 생성
  'registration_completed',        -- 잡 succeeded
  'registration_partial',          -- 잡 partial
  'registration_failed',           -- 잡 failed (전 마켓 실패)
  'retry_initiated',               -- 마켓 단위 자동 재시도 발동
  'market_excluded_retry',         -- n25 "마켓 제외 후 재등록"
  -- 마켓 계정 (s5)
  'market_connect_started',
  'market_connected',
  'market_disconnected',
  'market_token_refresh_failed',
  -- 이력 (s6)
  'history_viewed',
  'history_filtered',              -- payload.filter (기간/마켓/상태)
  'history_detail_opened'
);

-- 2.1.2 본 테이블
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  -- FK target = auth.users(id). sellers.id 가 auth.users.id 와 동일 UUID 이므로
  -- 양쪽 어디로 걸어도 의미는 같음. auth.users 채택 = Supabase Auth 직접 의존을 명시.
  -- (features/auth.md §2.2 sellers DDL: id uuid PRIMARY KEY REFERENCES auth.users(id))
  seller_id    uuid not null references auth.users(id) on delete cascade,
  event_type   public.event_type not null,
  source       public.event_source not null,
  payload      jsonb not null default '{}'::jsonb,
  correlation_id uuid,                          -- 요청 단위 (옵션)
  job_id       uuid references public.registration_jobs(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on column public.events.payload is
  'PII 금지. 허용 키: step(int), market(text), filter(jsonb), reason(text), duration_ms(int). 그 외는 zod 검증으로 차단.';

-- 2.1.3 인덱스
create index idx_events_seller_created
  on public.events (seller_id, created_at desc);

create index idx_events_type_created
  on public.events (event_type, created_at desc);

create index idx_events_job
  on public.events (job_id)
  where job_id is not null;

-- 월간 집계용 BRIN (대용량 시계열에서 b-tree 보다 가벼움)
create index idx_events_created_brin
  on public.events using brin (created_at);
```

### 2.2 RLS 정책

```sql
alter table public.events enable row level security;
alter table public.events force row level security;

-- SELECT: 셀러 본인 데이터만
create policy events_select_own
  on public.events for select
  using (auth.uid() = seller_id);

-- INSERT: 본인 세션에서 web source 만, 그 외 source 는 service_role
create policy events_insert_web_own
  on public.events for insert
  with check (
    auth.uid() = seller_id
    and source = 'web'
    and event_type in (
      'login_success', 'dashboard_viewed',
      'registration_started', 'registration_step_advanced',
      'history_viewed', 'history_filtered', 'history_detail_opened',
      'market_connect_started'
    )
  );

-- UPDATE / DELETE: 일반 사용자 전면 금지 (수정 불가능 append-only)
-- service_role 은 RLS bypass — 보관기간 만료 시 batch DELETE 만 허용.
```

### 2.3 event_type 분류 표

| event_type | 발생 위치 | trigger | payload 키 | 용도 |
|---|---|---|---|---|
| `login_success` | web | Supabase Auth `SIGNED_IN` 콜백 | `{ method: 'email'\|'oauth_google'\|'oauth_kakao' }` | MAU 보조 |
| `signup_completed` | web | 회원가입 직후 | `{ method }` | 신규 가입 funnel |
| `password_reset_completed` | web | reset 성공 직후 | `{}` | 보안 모니터 |
| `dashboard_viewed` | web | `/dashboard` mount | `{}` | engagement |
| `registration_started` | web | s3 위저드 1단계 진입 | `{ from: 'dashboard'\|'history' }` | funnel top |
| `registration_step_advanced` | web | 단계 이동 | `{ step: 1\|2\|3\|4\|5 }` | drop-off 분석 |
| `registration_submitted` | edge_fn | `register_products` Edge Function 잡 생성 직후 | `{ market_count: int, image_count: int }` | 시작 시각 baseline |
| `registration_completed` | db_trigger | `registration_jobs.status` → `'succeeded'` | `{ duration_ms: int, market_count: int }` | 평균 등록 시간 |
| `registration_partial` | db_trigger | `registration_jobs.status` → `'partial'` | `{ duration_ms, success_count, fail_count }` | partial 비율 |
| `registration_failed` | db_trigger | `registration_jobs.status` → `'failed'` | `{ duration_ms, fail_reasons: text[] }` | 실패 분석 |
| `retry_initiated` | edge_fn | 오케스트레이터 자동 재시도 발동 | `{ market: text, attempt: int }` | 안정성 모니터 |
| `market_excluded_retry` | edge_fn | n25 흐름 (사용자가 일부 마켓 제외 후 재등록) | `{ excluded: text[], parent_job_id: uuid }` | recovery UX |
| `market_connect_started` | web | OAuth authorize 진입 | `{ market }` | funnel |
| `market_connected` | edge_fn | OAuth 콜백 성공 | `{ market }` | s5 KPI |
| `market_disconnected` | edge_fn | 연결 해제 | `{ market, by: 'user'\|'system' }` | churn |
| `market_token_refresh_failed` | edge_fn | refresh 실패 (재인증 요구) | `{ market, http_status }` | 운영 알람 |
| `history_viewed` | web | `/history` mount | `{}` | engagement |
| `history_filtered` | web | 필터 변경 (debounce 후) | `{ filter: { period, market, status } }` | UX 분석 |
| `history_detail_opened` | web | 이력 상세 모달 open | `{ job_id }` | 오류 분석 |

### 2.4 클라이언트 발생 vs Edge Function 발생 분리

| 원칙 | 이유 |
|---|---|
| **사용자 행동(UI 클릭·뷰)은 web** | 클라이언트 mutation 으로 적재. RLS `events_insert_web_own` 정책이 source · event_type 화이트리스트로 통제. |
| **시스템 사실(잡 상태·OAuth 결과)는 edge_fn / db_trigger** | 클라이언트가 위조 불가. `service_role` 만 insert. |
| **`registration_completed` 류는 반드시 db_trigger** | 클라이언트 발생 시 사용자가 브라우저 종료해도 누락 없이 잡힘. trigger 는 `cross-cutting/registration-job-state.md` §3 의 `tg_registration_jobs_after_update_kpi` 에서 정의. |
| **클라이언트가 web 이벤트를 보낼 때 zod 검증 후 supabase-js insert** | 그릇된 event_type 은 RLS 정책에서 reject. 실패해도 UI 동선 차단 금지. |

#### 클라이언트 이벤트 적재 헬퍼 (요약)

```ts
// src/lib/kpi/track.ts
import { z } from 'zod';

const WebEvent = z.discriminatedUnion('event_type', [
  z.object({ event_type: z.literal('dashboard_viewed'), payload: z.object({}).strict() }),
  z.object({ event_type: z.literal('registration_started'), payload: z.object({ from: z.enum(['dashboard', 'history']) }).strict() }),
  z.object({ event_type: z.literal('registration_step_advanced'), payload: z.object({ step: z.number().int().min(1).max(5) }).strict() }),
  z.object({ event_type: z.literal('history_filtered'), payload: z.object({ filter: z.record(z.unknown()) }).strict() }),
  // ... 화이트리스트 9개
]);

export async function track(input: z.infer<typeof WebEvent>) {
  const parsed = WebEvent.safeParse(input);
  if (!parsed.success) {
    console.warn('[kpi] event rejected (schema)', parsed.error);
    return; // best-effort
  }
  const { error } = await supabase.from('events').insert({
    ...parsed.data,
    source: 'web',
    seller_id: (await supabase.auth.getUser()).data.user?.id,
  });
  if (error) console.warn('[kpi] event insert failed', error.code);
}
```

---

## 3. 세션 모델

### 3.1 `sessions` 테이블 DDL

```sql
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references auth.users(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  ip_hash      text,            -- sha256(ip || daily_salt) — 평문 IP 금지
  ua_hash      text,            -- sha256(user_agent) — 평문 UA 금지
  client_build text,            -- 'web@1.4.2' 등 디버깅용 (PII 아님)
  check (ended_at is null or ended_at >= started_at)
);

create index idx_sessions_seller_started
  on public.sessions (seller_id, started_at desc);

create index idx_sessions_started_brin
  on public.sessions using brin (started_at);
```

### 3.2 RLS 정책

```sql
alter table public.sessions enable row level security;
alter table public.sessions force row level security;

create policy sessions_select_own
  on public.sessions for select
  using (auth.uid() = seller_id);

create policy sessions_insert_own
  on public.sessions for insert
  with check (auth.uid() = seller_id and ended_at is null);

create policy sessions_update_own
  on public.sessions for update
  using (auth.uid() = seller_id)
  with check (
    auth.uid() = seller_id
    -- started_at / ip_hash / ua_hash 변조 금지
    and started_at = (select started_at from public.sessions s where s.id = sessions.id)
  );

-- DELETE: 일반 사용자 금지. 보관기간 만료 시 service_role 만.
```

### 3.3 라이프사이클

| 시점 | 동작 | 책임 |
|---|---|---|
| 앱 마운트 + 인증된 세션 감지 | 새 `sessions` row insert (`started_at = now()`) | `src/features/auth/hooks/useSessionLifecycle.ts` |
| 라우트 이동 / focus 변화 | `started_at` 유지, ping 없음 | — |
| 앱 언마운트 (`beforeunload`) | `ended_at = now()` UPDATE (`navigator.sendBeacon`) | 동일 hook |
| 30분 이상 inactive | 기존 row `ended_at = now()`, 다음 활동에서 새 row | hook + visibility API |
| 로그아웃 | `ended_at = now()` UPDATE 즉시 | `signOut` 핸들러 |

#### ip_hash / ua_hash 산출
- IP / UA 는 클라이언트가 직접 보내지 않는다. `track_session_start` Edge Function 이 request header 에서 추출 → `sha256(value || daily_salt)` → 해시만 저장.
- `daily_salt` 는 매일 회전되는 서버 환경변수 (security 가 관리). 같은 IP 라도 다음날에는 다른 해시 → fingerprint 추적 불가.

### 3.4 MAU 정의
- **MAU** = 직전 30일 동안 `sessions` 에 `started_at` 이 존재하는 distinct `seller_id` 수.
- 30일 윈도우는 calendar month 가 아닌 trailing 30 days. `kpi_mau` view 가 둘 다 제공.

---

## 4. NPS 모델

### 4.1 `nps_responses` 테이블 DDL

```sql
create table public.nps_responses (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references auth.users(id) on delete cascade,
  score        smallint not null check (score between 0 and 10),
  comment      text,             -- 자유 텍스트 (PII 입력 자제 안내 문구 노출)
  trigger_reason text not null check (trigger_reason in ('post_5_registrations', 'manual', 'recurring_quarterly')),
  surveyed_at  timestamptz not null default now(),
  unique (seller_id, trigger_reason, date_trunc('quarter', surveyed_at))
  -- 동일 트리거에 분기당 1회 응답으로 제한
);

create index idx_nps_surveyed
  on public.nps_responses (surveyed_at desc);
```

### 4.2 RLS 정책

```sql
alter table public.nps_responses enable row level security;
alter table public.nps_responses force row level security;

create policy nps_select_own
  on public.nps_responses for select
  using (auth.uid() = seller_id);

create policy nps_insert_own
  on public.nps_responses for insert
  with check (auth.uid() = seller_id);

-- UPDATE / DELETE 금지 (응답은 immutable).
-- 익명화 시점에는 service_role 이 seller_id → null + comment scrub.
```

### 4.3 in-app 설문 트리거 조건

| trigger_reason | 조건 | 노출 횟수 | 책임 |
|---|---|---|---|
| `post_5_registrations` | 누적 `registration_jobs.status = 'succeeded'` 5회 도달 직후 다음 dashboard 진입 | 분기당 1회 | dashboard 진입 hook |
| `manual` | 설정 메뉴에서 "피드백 보내기" 클릭 (v2 메뉴, v1 stub) | 무제한 | — |
| `recurring_quarterly` | 마지막 응답 후 90일 이상 + 5회 등록 조건 충족 | 분기당 1회 | dashboard 진입 hook |

설문 UI: dashboard 상단에 dismissible 배너. 점수 0~10 + 자유 텍스트(선택). "응답한 내용은 운영팀이 익명화 후 분석합니다" 안내 필수.

### 4.4 분류
- **Promoter**: 9~10
- **Passive**: 7~8
- **Detractor**: 0~6
- **NPS Score**: `% promoter - % detractor` (소수점 1자리)

---

## 5. 계산 view (RLS 호환)

모든 view 는 **`security_invoker = on`** 으로 정의해, 호출자의 RLS 가 그대로 적용된다. 운영자(`role = 'service_role'`)는 전체 집계를 보지만, 셀러가 view 를 조회하면 본인 데이터만 보이게 자연스럽게 격리된다.

> Postgres 15+ 에서 `create view ... with (security_invoker = on) as ...` 문법 사용. Supabase 는 15+ 기본.

### 5.1 `kpi_monthly_registrations`

```sql
create or replace view public.kpi_monthly_registrations
with (security_invoker = on) as
select
  date_trunc('month', rj.created_at) as month,
  extract(year from rj.created_at)::int as year,
  extract(month from rj.created_at)::int as month_num,
  count(*) as total_jobs,
  count(*) filter (where rj.status = 'succeeded') as succeeded,
  count(*) filter (where rj.status = 'partial')   as partial,
  count(*) filter (where rj.status = 'failed')    as failed,
  count(*) filter (where rj.status = 'cancelled') as cancelled,
  count(distinct rj.seller_id)                    as active_sellers
from public.registration_jobs rj
where rj.created_at >= now() - interval '24 months'
group by 1, 2, 3
order by 1 desc;

comment on view public.kpi_monthly_registrations is
  'PRD §1.핵심지표: 월간 총 등록 건수. RLS 호환 (security_invoker).';
```

### 5.2 `kpi_mau`

```sql
-- 트레일링 30일 MAU + 캘린더 월 MAU 동시 제공
create or replace view public.kpi_mau
with (security_invoker = on) as
with monthly as (
  select
    date_trunc('month', started_at) as month,
    count(distinct seller_id) as mau_calendar
  from public.sessions
  where started_at >= now() - interval '24 months'
  group by 1
),
trailing as (
  select
    date_trunc('day', d)::date as as_of,
    (
      select count(distinct s.seller_id)
      from public.sessions s
      where s.started_at >= d - interval '30 days'
        and s.started_at <  d
    ) as mau_trailing_30d
  from generate_series(
    date_trunc('day', now() - interval '24 months'),
    date_trunc('day', now()),
    interval '1 day'
  ) d
)
select
  m.month,
  m.mau_calendar,
  (select mau_trailing_30d from trailing where as_of = (m.month + interval '1 month')::date) as mau_trailing_30d_at_month_end
from monthly m
order by m.month desc;

comment on view public.kpi_mau is
  'PRD §1.핵심지표: MAU. 캘린더 월 + 트레일링 30일 둘 다 제공.';
```

### 5.3 `kpi_registration_duration`

```sql
create or replace view public.kpi_registration_duration
with (security_invoker = on) as
select
  date_trunc('month', rj.created_at) as month,
  count(*) filter (where rj.completed_at is not null) as completed_jobs,
  -- ms 단위. percentile_cont 는 double precision 반환.
  percentile_cont(0.50) within group (
    order by extract(epoch from (rj.completed_at - rj.created_at)) * 1000
  )::bigint as p50_ms,
  percentile_cont(0.95) within group (
    order by extract(epoch from (rj.completed_at - rj.created_at)) * 1000
  )::bigint as p95_ms,
  percentile_cont(0.99) within group (
    order by extract(epoch from (rj.completed_at - rj.created_at)) * 1000
  )::bigint as p99_ms,
  avg(extract(epoch from (rj.completed_at - rj.created_at)) * 1000)::bigint as avg_ms
from public.registration_jobs rj
where rj.completed_at is not null
  and rj.status in ('succeeded', 'partial')   -- failed 는 분포 왜곡, 제외
  and rj.created_at >= now() - interval '24 months'
group by 1
order by 1 desc;

comment on view public.kpi_registration_duration is
  'PRD §1.핵심지표: 평균 등록 시간. p50/p95/p99 + avg. 단축률 계산은 baseline 과 비교 (§6 참고).';
```

### 5.4 `kpi_nps_summary`

```sql
create or replace view public.kpi_nps_summary
with (security_invoker = on) as
select
  date_trunc('month', surveyed_at) as month,
  count(*) as total_responses,
  count(*) filter (where score >= 9)                        as promoter,
  count(*) filter (where score between 7 and 8)             as passive,
  count(*) filter (where score <= 6)                        as detractor,
  round(
    (
      (count(*) filter (where score >= 9))::numeric
      - (count(*) filter (where score <= 6))::numeric
    ) / nullif(count(*), 0) * 100,
    1
  ) as nps_score
from public.nps_responses
where surveyed_at >= now() - interval '24 months'
group by 1
order by 1 desc;

comment on view public.kpi_nps_summary is
  'PRD §1.핵심지표: NPS. promoter/passive/detractor + NPS score.';
```

### 5.5 view 호출 권한
- 모든 view 는 `grant select on public.kpi_* to authenticated, service_role;`
- 셀러가 직접 호출하면 RLS 가 본인 데이터만 노출 → 본인 등록 패턴은 보지만 타인 데이터는 안 보임.
- 운영자(Supabase Studio + service_role)는 전체 집계 가시.

---

## 6. 베이스라인 / 목표 수치

### 6.1 평균 등록 시간 단축률 정의
```
shorten_rate = (baseline_manual_seconds - service_p50_seconds) / baseline_manual_seconds * 100 (%)
```

### 6.2 baseline 측정 방법 (v1 출시 후 첫 달)
| 방법 | 설명 | 채택 여부 |
|---|---|---|
| **(A) 신규 가입자 in-app 설문 1회 (추천)** | 가입 직후 "기존에 마켓 1개 등록에 평균 몇 분 걸렸나요?" 단일 질문. `nps_responses` 와 별도 `baseline_surveys` 테이블 (v1 stub). | v1 채택 |
| (B) 외부 설문 (Google Form 등) | PII 우려·연결 어려움. | 거부 |
| (C) 가정값 (1마켓 = 20분, 2마켓 = 35분) | 객관성 부족. | fallback (응답 < 30건 시) |

> v1 첫 달은 (A) + (C) 병행. 응답 누적 30건 이상이면 (A) 평균값으로 baseline 확정. 미달이면 (C) 가정값을 명시적 disclaimer 와 함께 보고.

### 6.3 v1 목표 (PRD §1.4 / 추후 합의)
| 지표 | 베이스라인 | 6개월 목표 | 비고 |
|---|---|---|---|
| 월간 총 등록 건수 | (출시 후 1개월 집계) | 출시 베이스 × 3 | 출시 후 첫 달이 baseline |
| MAU (캘린더) | (출시 후 1개월) | 출시 베이스 × 2 | |
| 평균 등록 시간 단축률 | 0% (출시 시점) | **≥ 60%** | p50 기준 |
| NPS | (응답 누적 30건 이후) | **≥ +20** | 분기 NPS |

목표 수치는 운영팀 합의 시 갱신. 본 문서는 산정 식만 결정적으로 명시.

---

## 7. 수집 시점 매트릭스

| 이벤트 | 발생 위치 | 트리거 | 적재 경로 | 비고 |
|---|---|---|---|---|
| `login_success` | 클라이언트 | `onAuthStateChange('SIGNED_IN')` | supabase-js → `events` insert | RLS `events_insert_web_own` |
| `signup_completed` | 클라이언트 | 이메일 인증 완료 후 첫 진입 | supabase-js | |
| `password_reset_completed` | 클라이언트 | reset 후 새 로그인 | supabase-js | |
| `dashboard_viewed` | 클라이언트 | `/dashboard` 마운트 (1초 debounce) | supabase-js | 중복 방지 |
| `registration_started` | 클라이언트 | 위저드 1단계 마운트 | supabase-js | |
| `registration_step_advanced` | 클라이언트 | 단계 이동 | supabase-js | |
| `registration_submitted` | Edge Function | `register_products` 잡 INSERT 직후 | service_role insert | 위조 불가 |
| `registration_completed/partial/failed` | DB 트리거 | `registration_jobs` UPDATE → status 가 terminal 로 전이 | trigger function `tg_registration_jobs_after_update_kpi` | 누락 0 보장 |
| `retry_initiated` | Edge Function | 오케스트레이터 backoff 후 재호출 시 | service_role insert | |
| `market_excluded_retry` | Edge Function | n25 흐름 | service_role insert | `parent_job_id` 기록 |
| `market_connect_started` | 클라이언트 | OAuth authorize 리다이렉트 직전 | supabase-js | |
| `market_connected` | Edge Function | OAuth 콜백 핸들러 성공 분기 | service_role insert | |
| `market_disconnected` | Edge Function | 연결 해제 RPC 성공 후 | service_role insert | |
| `market_token_refresh_failed` | Edge Function | `refreshToken` 어댑터 메서드 실패 | service_role insert | 운영 알람 hook |
| `history_viewed` / `history_filtered` / `history_detail_opened` | 클라이언트 | `/history` 동작 | supabase-js | filter 변경은 500ms debounce |
| 세션 시작 | Edge Function (`track_session_start`) | 앱 마운트 시 호출 | sessions insert | IP/UA 해시는 서버에서만 |
| 세션 종료 | Edge Function (`track_session_end`) | beforeunload sendBeacon | sessions update | |
| NPS 응답 | 클라이언트 | dashboard 배너 제출 | supabase-js → `nps_responses` insert | unique 제약 |

### 7.1 DB 트리거 정의 (등록 잡 terminal 전이)

```sql
create or replace function public.tg_fn_registration_jobs_kpi()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_duration_ms bigint;
  v_event_type public.event_type;
begin
  if new.status not in ('succeeded', 'partial', 'failed')
     or old.status = new.status then
    return new;
  end if;

  v_duration_ms := extract(epoch from (new.completed_at - new.created_at)) * 1000;
  v_event_type := case new.status
    when 'succeeded' then 'registration_completed'::public.event_type
    when 'partial'   then 'registration_partial'::public.event_type
    when 'failed'    then 'registration_failed'::public.event_type
  end;

  insert into public.events (seller_id, event_type, source, payload, job_id)
  values (
    new.seller_id,
    v_event_type,
    'db_trigger',
    jsonb_build_object(
      'duration_ms', v_duration_ms,
      'market_count', (
        select count(*) from public.registration_job_market_results r
        where r.job_id = new.id
      ),
      'success_count', (
        select count(*) from public.registration_job_market_results r
        where r.job_id = new.id and r.market_status = 'success'
      ),
      'fail_count', (
        select count(*) from public.registration_job_market_results r
        where r.job_id = new.id and r.market_status in ('failed', 'failed_final')
      )
    ),
    new.id
  );
  return new;
end$$;

create trigger tg_registration_jobs_after_update_kpi
after update on public.registration_jobs
for each row
when (old.status is distinct from new.status)
execute function public.tg_fn_registration_jobs_kpi();
```

---

## 8. 데이터 보관 / 익명화

### 8.1 PII 컬럼 분리 원칙
- `events.payload` 에는 PII 금지. 허용 키 화이트리스트 (§2.1 comment) 외에는 zod 검증 + RLS check 로 차단.
- `sessions.ip_hash` / `ua_hash` 는 일일 salt 회전 해시. 평문 복원 불가.
- `nps_responses.comment` 는 자유 텍스트라 PII 입력 가능 → 입력 시점 안내 + 익명화 시점에 scrub.
- 셀러 식별은 모든 KPI 테이블에서 `seller_id` UUID 단일 키. `auth.users` 의 email · phone 과 join 하는 KPI view 는 **금지**.

### 8.2 보관 기간

| 테이블 | 보관 기간 | 만료 후 처리 | 비고 |
|---|---|---|---|
| `events` | **13개월** | 영구 삭제 (`delete from events where created_at < now() - interval '13 months'`) | 월간 추이 12개월 + 버퍼 1개월 |
| `sessions` | **13개월** | 영구 삭제 | MAU 추이용 |
| `nps_responses` | **영구** (익명화 후) | 응답 후 13개월 시점에 `seller_id = null`, `comment = '[scrubbed]'` UPDATE | 장기 NPS 추세 보존, 개인 추적 불가 |
| `registration_jobs` / `*_market_results` | `registration.md` / `cross-cutting/registration-job-state.md` 참고 | — | KPI view 가 24개월 윈도우로 자체 컷오프 |

### 8.3 익명화 / 삭제 Edge Function

```ts
// supabase/functions/kpi_retention/index.ts
// 일 1회 cron (Supabase Scheduled Functions) — Phase 6 운영자 활성화
serve(async () => {
  const sb = createServiceRoleClient();

  // 1. events 13개월 컷
  await sb.rpc('kpi_purge_events_older_than', { months: 13 });

  // 2. sessions 13개월 컷
  await sb.rpc('kpi_purge_sessions_older_than', { months: 13 });

  // 3. nps_responses 익명화 (13개월 경과)
  await sb.rpc('kpi_anonymize_nps_older_than', { months: 13 });

  // 4. 셀러 탈퇴 (auth.users 삭제) → events/sessions ON DELETE CASCADE 자동 처리
  //    nps_responses 도 CASCADE 되도록 동일 정책. comment scrub 은 trigger 로.
});
```

### 8.4 탈퇴 시 동작 (Right to be forgotten)
- `auth.users` DELETE → `events` / `sessions` / `nps_responses` CASCADE.
- 단, **집계된 view 결과**(monthly count 등)는 영향 없음 (DELETE 후 view 재계산 시 자연스럽게 감소).
- 운영자가 "탈퇴 회원 응답을 집계에서만 유지하고 row 는 익명화" 를 원할 경우, `nps_responses` 만 trigger 로 익명화 보존하는 옵션 (security 결정 사안).

---

## 9. 운영자 대시보드 동선

### 9.1 v1: Supabase Studio SQL 만
- 별도 어드민 SPA 화면 **v1 미구현**.
- 운영자(=초기에는 본인)가 Supabase Studio → SQL Editor 에서 view 4개 조회.
- 표준 쿼리 모음 저장: `supabase/queries/kpi/*.sql` (소스 관리).

#### 표준 쿼리 예
```sql
-- 월간 등록 + MAU 동시 비교
select
  m.month,
  m.total_jobs, m.succeeded, m.partial, m.failed,
  mau.mau_calendar
from public.kpi_monthly_registrations m
left join public.kpi_mau mau on mau.month = m.month
order by m.month desc
limit 12;

-- 단축률 (baseline = 1500000ms = 25min 가정값으로 계산 예)
select
  month,
  p50_ms,
  round((1500000 - p50_ms)::numeric / 1500000 * 100, 1) as shorten_rate_pct
from public.kpi_registration_duration
order by month desc;

-- NPS 분기 추이
select date_trunc('quarter', month) as q, sum(promoter) p, sum(passive) pa, sum(detractor) d,
       round((sum(promoter) - sum(detractor))::numeric / nullif(sum(promoter+passive+detractor),0) * 100, 1) as nps
from public.kpi_nps_summary
group by 1 order by 1 desc;
```

### 9.2 정기 리포트
- 매월 1일, 운영자가 수동으로 위 쿼리 3개 실행 + CSV export → `docs/ops/kpi-monthly/YYYY-MM.md` 에 결과 표 + 한줄 코멘트 적재.
- 자동화는 v2 (Scheduled Function + Slack 알림).

### 9.3 v2 확장 시 어드민 SPA
- `src/features/admin/kpi/` 도메인 신설.
- service_role 직접 노출 금지. Edge Function `admin_kpi_summary` 를 두고, 운영자 JWT (별도 admin role) 만 통과.
- 본 문서 §10 가드레일과 함께 재검토.

---

## 10. 외부 분석 도구 미사용 근거 + 향후 도입 가드레일

### 10.1 미사용 근거
1. **PII 외부 노출 0** (`security.md` §6.5 / §8.1) — 외부 분석 SDK 는 URL · referrer · UA · IP 를 자동 수집. 셀러 PII 가 그릇된 페이지 path · query param 으로 새는 경로를 차단 불가.
2. **마켓 토큰 영역 인접** — 마켓 OAuth 콜백 페이지가 잠시 access_token 을 URL fragment 로 받는 시점이 있다. 외부 SDK 가 URL 을 통째로 캡처하면 토큰 유출.
3. **MVP KPI 4개는 Supabase 만으로 충분** — count / distinct / percentile 모두 Postgres view 로 정확히 산출. 외부 도구의 funnel · cohort 기능은 v1 에 불필요.
4. **무료 운영 단계 비용 절감** — PostHog 등 self-host 도 인프라 부담 증가.

### 10.2 v2+ 도입 시 가드레일 (필수)
| 항목 | 요건 |
|---|---|
| **옵트인 명시** | 셀러 설정 화면에 "사용 데이터 분석 동의" 체크 (기본 OFF). 동의 없는 셀러는 SDK 비활성. |
| **PII 마스킹 룰** | URL · referrer 에서 `email` · `phone` query param 자동 제거. 자유 텍스트 input 의 keystroke 캡처 금지. |
| **세션 리코딩 금지** | Hotjar / Microsoft Clarity 류 절대 도입 금지 (마켓 토큰 화면 노출 위험). |
| **데이터 처리 위치** | EU/US 데이터센터 사용 시 셀러 동의 + 개인정보 처리방침 갱신. |
| **SDK 화이트리스트** | `Content-Security-Policy` 의 `connect-src` 에 외부 분석 도메인 추가 필요 → security 검수 필수. |
| **이중 집계 금지** | 외부 도구는 *보조*. PRD §1.핵심지표 4종은 여전히 Supabase view 가 SoT (Source of Truth). |
| **자체 KPI view 와 외부 도구 수치 분기 시 view 우선** | 외부 도구는 funnel 분석 등 부수 용도로만. |

---

## 11. 테스트 매트릭스

| ID | 시나리오 | 검증 항목 | 도구 | 우선순위 |
|---|---|---|---|---|
| QA-KPI-001 | 클라이언트 web 이벤트 정상 적재 | `dashboard_viewed` insert 후 `events` 1행, `source = 'web'`, `seller_id = auth.uid()` | Vitest + Supabase test client | P0 |
| QA-KPI-002 | RLS — 셀러 A 가 셀러 B 이벤트 SELECT 차단 | `events_select_own` 정책 0 row | pgTAP / Vitest | P0 |
| QA-KPI-003 | RLS — 클라이언트가 `source = 'edge_fn'` 위조 시도 | INSERT reject | pgTAP | P0 |
| QA-KPI-004 | RLS — 화이트리스트 외 event_type (`registration_completed`) 을 web 에서 시도 | INSERT reject | pgTAP | P0 |
| QA-KPI-005 | DB 트리거 — registration_jobs status pending→succeeded 전이 시 `registration_completed` 1행 적재 | trigger function 실행, payload.duration_ms 일치 | pgTAP | P0 |
| QA-KPI-006 | DB 트리거 — succeeded→succeeded 같은 status UPDATE 시 중복 적재 없음 | trigger guard `when` 절 | pgTAP | P1 |
| QA-KPI-007 | view `kpi_monthly_registrations` 정확도 | 시드 데이터 (월별 N건) → view 결과 N 매칭 | pgTAP | P0 |
| QA-KPI-008 | view `kpi_mau` distinct seller 계산 | 동일 seller 30회 세션 → MAU 1 | pgTAP | P0 |
| QA-KPI-009 | view `kpi_registration_duration` p50/p95 정확도 | 시드 100건 분포 → 알려진 percentile 매칭 (±1ms) | pgTAP | P1 |
| QA-KPI-010 | view `kpi_nps_summary` 분류 경계 | score=6 → detractor, 7 → passive, 9 → promoter | pgTAP | P0 |
| QA-KPI-011 | view `kpi_nps_summary` NPS score = 0% / 100% / -100% 경계 | promoter=0 또는 detractor=0 케이스 | pgTAP | P1 |
| QA-KPI-012 | 세션 lifecycle — 마운트 시 row 1행, 언마운트 시 ended_at 채워짐 | hook 단위 + RLS | Vitest + Playwright | P0 |
| QA-KPI-013 | 세션 — 30분 inactive 후 자동 종료 + 다음 활동에 새 row | hook 타이머 mocking | Vitest | P1 |
| QA-KPI-014 | 세션 — 동일 ip 다른 날 hash 다름 | daily_salt 회전 후 hash 변화 | Edge Function 단위 | P1 |
| QA-KPI-015 | NPS — 동일 분기 동일 trigger_reason 중복 응답 reject | unique 제약 | pgTAP | P0 |
| QA-KPI-016 | NPS — 5회 등록 전 셀러는 배너 노출 안됨 | dashboard hook | RTL | P1 |
| QA-KPI-017 | event payload PII 위반 시도 (`payload.email = '...'`) | zod 검증 단계 reject | Vitest | P0 |
| QA-KPI-018 | 보관기간 — 13개월 + 1일 events 제거 | retention Edge Function 실행 후 count 변화 | Vitest + DB | P1 |
| QA-KPI-019 | 익명화 — nps_responses 13개월 경과 row 의 `seller_id` null, `comment = '[scrubbed]'` | retention function | pgTAP | P1 |
| QA-KPI-020 | 탈퇴 — auth.users DELETE → events/sessions CASCADE 0 row | FK 동작 | pgTAP | P0 |
| QA-KPI-021 | view security_invoker — 셀러 호출 시 본인 데이터만 집계 | RLS 우회 없음 | pgTAP (별도 셀러 컨텍스트) | P0 |
| QA-KPI-022 | 이벤트 적재 실패가 UI 동선 차단하지 않음 | network fail mock → `track()` resolved, UI 진행 | RTL | P1 |
| QA-KPI-023 | `registration_submitted` source = 'edge_fn' 검증 | Edge Function 만 적재, 클라이언트 시도 RLS reject | Vitest + pgTAP | P0 |

---

## 12. 수락 기준 체크리스트

- [ ] **DDL** — `events` / `sessions` / `nps_responses` + ENUM 2종 마이그레이션 단일 파일로 추가.
- [ ] **RLS** — 세 테이블 모두 `enable + force row level security`. 정책 누락 0 (security 검수).
- [ ] **트리거** — `tg_registration_jobs_after_update_kpi` 가 succeeded/partial/failed 전이 시 events 1행 정확히 적재.
- [ ] **view** — `kpi_monthly_registrations` / `kpi_mau` / `kpi_registration_duration` / `kpi_nps_summary` 4개 정의 + `security_invoker = on`.
- [ ] **클라이언트 헬퍼** — `src/lib/kpi/track.ts` zod 검증 + best-effort insert. PR 에 이벤트 추가 시 화이트리스트 갱신.
- [ ] **세션 hook** — `useSessionLifecycle` 마운트/언마운트/30분 inactive 처리. ip_hash/ua_hash 는 Edge Function 책임.
- [ ] **NPS 배너** — dashboard 진입 시 trigger 조건 검사 + 분기당 1회 노출 + unique 제약 위반 시 silent fail.
- [ ] **보관 정책** — `kpi_retention` Edge Function 작성 + Scheduled Functions cron 등록 (Phase 6 활성화).
- [ ] **운영자 쿼리** — `supabase/queries/kpi/*.sql` 표준 쿼리 3건 저장.
- [ ] **테스트** — §11 매트릭스 P0 전부 통과. pgTAP / Vitest / RTL / Playwright 분담 명시.
- [ ] **보안 검수** — security 가 `events.payload` zod 화이트리스트 + ip_hash salt 회전 + view security_invoker 확인.
- [ ] **문서 동기화** — 본 문서 + `platform.md` §9 (미해결 #7 해소 처리) + `features/dashboard.md` (NPS 배너 컴포넌트 명세).

---

## 13. 미해결 사안

| # | 주제 | 결정 시점 | 옵션 | 영향 |
|---|---|---|---|---|
| 1 | **baseline 측정 방법** | v1 출시 직후 (Phase 6 / 운영) | (A) 가입 직후 1회 설문 / (B) 가정값 25분 / 병행 | 평균 등록 시간 단축률 의 정밀도. v1 첫 달은 (A)+(B) 병행, 30건 이상 누적 시 (A) 로 갱신. |
| 2 | **익명화 강도** (nps_responses.comment) | Phase 6 | (a) 13개월 후 `'[scrubbed]'` 일괄 치환 / (b) NER 모델로 PII 토큰만 마스킹 / (c) 영구 보존 + seller_id null | (a) 가장 안전. (b) 운영 비용·복잡도 증가. v1 은 (a) 채택, v2 검토. |
| 3 | **세션 종료 정확도** | Phase 4 | beforeunload sendBeacon 만으로 충분한가, Edge Function ping 보강 필요한가 | sendBeacon 누락 시 ended_at null 잔존 → 30분 inactive 컷오프 + 일일 cleanup job 으로 보완. |
| 4 | **ip_hash daily_salt 관리 주체** | Phase 4 | (a) Supabase env 변수 매일 운영자가 교체 / (b) Vault + 일일 자동 회전 RPC | v1 은 (a) 수동. 자동화는 v2. security 검수 필요. |
| 5 | **NPS 응답 모집단 편향** | v1 출시 후 | 5회 등록 도달 셀러 대상이라 활성 사용자만 응답 → 점수 과대평가 가능. 대응 옵션: 등록 1회 후도 별도 trigger 추가 (피로도 우려) | v1 은 5회 유지, 분기 추세로 트래킹. v2 재검토. |
| 6 | **어드민 SPA 시기** | v2 초입 | 운영자 수 증가 시 SQL 직접 운영 한계 | 본 문서 §9.3 확장 트랙. |

---

## 14. 변경 이력

| 버전 | 일자 | 변경 | 담당 |
|---|---|---|---|
| v1.0 | 2026-05-18 | 최초 작성 (events / sessions / nps_responses + view 4종 + 운영 동선) | backend (+ security 검수 필요) |
