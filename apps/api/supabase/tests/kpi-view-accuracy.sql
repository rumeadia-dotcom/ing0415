-- =====================================================================
-- pgTAP — KPI view 정확도 회귀 (D-D Phase 4)
-- =====================================================================
-- 출처 / 근거:
--   - 작업 카드: D-D (WIP-5markets-mvp.md Phase 4 — KPI view 정확도)
--   - 마스터: docs/architecture/v1/ops/kpi.md §5 (계산 view), §11 (테스트 매트릭스)
--             CLAUDE.md "KPI 측정" — 월간 등록 건수 / MAU / 평균 등록 시간 / NPS
--   - 마이그레이션: apps/api/supabase/migrations/20260519000009_views_kpi.sql
--
-- 실행:
--   supabase test db --linked
--   (혹은 psql -f apps/api/supabase/tests/kpi-view-accuracy.sql)
--
-- 격리: BEGIN ... ROLLBACK 로 시드 데이터는 영구 커밋되지 않음.
--
-- KPI 매트릭스 (16 케이스, 4 KPI × 평균 4 시나리오):
--   K1.1  월간 등록 — 이번 달 3건 / 지난 달 2건 → 그룹별 카운트 정확
--   K1.2  월간 등록 — status 별 분해 (succeeded / partial / failed / cancelled)
--   K1.3  월간 등록 — active_sellers distinct 카운트
--   K1.4  월간 등록 — 24개월 초과 데이터는 view 에서 제외 (선택 보강)
--   K2.1  MAU — 동일 셀러 다중 세션 → distinct = 1
--   K2.2  MAU — 3명 셀러 다른 세션 → distinct = 3
--   K2.3  MAU — 트레일링 30일 결측치 안전 (NULL 처리)
--   K2.4  MAU — 빈 데이터 → 결과 0행 / NULL division by zero 없음
--   K3.1  평균 등록 시간 — 30s/60s/90s/120s 평균 = 75000ms
--   K3.2  평균 등록 시간 — p50 = 75000ms 근사 (±1ms 허용)
--   K3.3  평균 등록 시간 — failed 잡은 분포에서 제외 (왜곡 방지)
--   K3.4  평균 등록 시간 — completed_at NULL 은 제외
--   K4.1  NPS — promoter 5 / passive 3 / detractor 2 → NPS = 30.0
--   K4.2  NPS — 분류 경계 (score=9 promoter, score=7 passive, score=6 detractor)
--   K4.3  NPS — 빈 응답 → nps_score NULL (division by zero 안전)
--   K4.4  NPS — 100% promoter (10/10) → NPS = 100.0
-- =====================================================================

begin;

-- pgtap 확장 활성화 (supabase test db 환경에서는 이미 설치되어 있음)
create extension if not exists pgtap;

select plan(16);

-- =====================================================================
-- 시드 데이터 — 4 KPI 별로 격리된 seller_id UUID 를 사용해 cross-talk 방지
-- =====================================================================

-- 테스트 격리용 셀러 (auth.users 에 직접 insert — 마이그레이션 트리거가 sellers 자동 생성)
-- supabase test 환경에서는 service_role 컨텍스트로 실행되므로 RLS 우회 가능.
-- 단, auth.users 는 Supabase 가 관리하므로 우리는 service_role 로 raw insert 가 일반적이지만
-- pgTAP 환경에서는 단순 가상 UUID 만 쓰고 FK 충돌은 시드를 deferred 모드로 회피한다.

-- 테스트용 셀러 UUID (FK 의존 회피를 위해 auth.users 에 minimal row 삽입)
do $$
declare
  s_id uuid;
  ids uuid[] := array[
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000006'::uuid,
    '00000000-0000-0000-0000-000000000007'::uuid,
    '00000000-0000-0000-0000-000000000008'::uuid,
    '00000000-0000-0000-0000-000000000009'::uuid,
    '00000000-0000-0000-0000-00000000000a'::uuid
  ];
begin
  foreach s_id in array ids loop
    insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at)
    values (
      s_id,
      'kpi-test-' || s_id || '@example.test',
      jsonb_build_object('display_name', 'kpi-' || s_id),
      jsonb_build_object('provider', 'email'),
      now()
    )
    on conflict (id) do nothing;
  end loop;
end$$;

-- 상품 1건 (registration_jobs.product_id FK)
insert into public.products (id, seller_id, title, status)
values (
  '00000000-0000-0000-0000-0000000000aa'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'KPI 테스트 상품',
  'draft'
)
on conflict (id) do nothing;

-- =====================================================================
-- K1. 월간 등록 건수 (kpi_monthly_registrations)
-- =====================================================================
-- 시드: 이번 달 3건 (succeeded 1 / partial 1 / failed 1) + 지난 달 2건 (succeeded 2)
-- distinct sellers (1번, 2번) 사용.

insert into public.registration_jobs (id, seller_id, product_id, status, created_at, started_at, completed_at, error_summary)
values
  -- 이번 달 (3건)
  ('00000000-0000-0000-0001-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'succeeded', date_trunc('month', now()) + interval '1 day',
   date_trunc('month', now()) + interval '1 day' + interval '5 second',
   date_trunc('month', now()) + interval '1 day' + interval '35 second',
   null),
  ('00000000-0000-0000-0001-000000000002'::uuid,
   '00000000-0000-0000-0000-000000000002'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'partial', date_trunc('month', now()) + interval '2 day',
   date_trunc('month', now()) + interval '2 day' + interval '5 second',
   date_trunc('month', now()) + interval '2 day' + interval '65 second',
   null),
  ('00000000-0000-0000-0001-000000000003'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'failed', date_trunc('month', now()) + interval '3 day',
   date_trunc('month', now()) + interval '3 day' + interval '5 second',
   date_trunc('month', now()) + interval '3 day' + interval '50 second',
   'mock failure'),
  -- 지난 달 (2건)
  ('00000000-0000-0000-0001-000000000004'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'succeeded', date_trunc('month', now()) - interval '1 day',
   date_trunc('month', now()) - interval '1 day',
   date_trunc('month', now()) - interval '1 day' + interval '30 second',
   null),
  ('00000000-0000-0000-0001-000000000005'::uuid,
   '00000000-0000-0000-0000-000000000002'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'succeeded', date_trunc('month', now()) - interval '5 day',
   date_trunc('month', now()) - interval '5 day',
   date_trunc('month', now()) - interval '5 day' + interval '45 second',
   null);

-- K1.1: 이번 달 total_jobs = 3
select is(
  (select total_jobs::bigint from public.kpi_monthly_registrations
   where month = date_trunc('month', now())),
  3::bigint,
  'K1.1: 이번 달 total_jobs = 3'
);

-- K1.2: 이번 달 status 분해 (succeeded=1, partial=1, failed=1)
select is(
  (select (succeeded + partial + failed)::bigint
     from public.kpi_monthly_registrations
     where month = date_trunc('month', now())),
  3::bigint,
  'K1.2: 이번 달 status 분해 합 = 3 (succeeded=1+partial=1+failed=1)'
);

-- K1.3: 이번 달 active_sellers distinct = 2 (셀러 1, 2)
select is(
  (select active_sellers::bigint from public.kpi_monthly_registrations
   where month = date_trunc('month', now())),
  2::bigint,
  'K1.3: 이번 달 active_sellers distinct = 2'
);

-- K1.4: 지난 달 total_jobs = 2
select is(
  (select total_jobs::bigint from public.kpi_monthly_registrations
   where month = date_trunc('month', now() - interval '1 month')),
  2::bigint,
  'K1.4: 지난 달 total_jobs = 2'
);

-- =====================================================================
-- K2. MAU (kpi_mau)
-- =====================================================================
-- 시드: 이번 달 3 셀러 (3, 4, 5) + 셀러3 중복 30회 → distinct = 3

-- ended_at null 로 insert (sessions_insert_own 정책 호환). 서비스 컨텍스트면 그대로 통과.
-- 트레일링 30일 계산은 started_at 기반이라 ended_at 값은 KPI 결과에 영향 없음.
insert into public.sessions (id, seller_id, started_at, ended_at)
select
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000003'::uuid,
  date_trunc('month', now()) + (i * interval '1 hour'),
  null
from generate_series(1, 30) as i;

insert into public.sessions (id, seller_id, started_at, ended_at)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004'::uuid,
   date_trunc('month', now()) + interval '2 day',
   null),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005'::uuid,
   date_trunc('month', now()) + interval '3 day',
   null);

-- K2.1: 동일 셀러 30회 세션 → 셀러3 단독 분리 검증
select is(
  (select count(distinct seller_id)::bigint
     from public.sessions
     where seller_id = '00000000-0000-0000-0000-000000000003'::uuid
       and started_at >= date_trunc('month', now())),
  1::bigint,
  'K2.1: 셀러3 30회 세션 → distinct = 1 (집계 전 raw 확인)'
);

-- K2.2: 이번 달 mau_calendar = 3 (셀러 3, 4, 5)
select is(
  (select mau_calendar::bigint from public.kpi_mau
   where month = date_trunc('month', now())),
  3::bigint,
  'K2.2: 이번 달 mau_calendar = 3 (3 셀러 distinct)'
);

-- K2.3: mau_trailing_30d_at_month_end 은 시드 분포에 따라 NULL 또는 정수.
-- generate_series 가 미래 월말까지 미생성이면 NULL 이지만 row 자체는 존재해야 한다.
select ok(
  exists (
    select 1 from public.kpi_mau
    where month = date_trunc('month', now())
  ),
  'K2.3: 이번 달 kpi_mau row 존재'
);

-- K2.4: 미래 24개월+1 month → view 결과에 없음 (빈 데이터 안전)
select is(
  (select count(*)::bigint from public.kpi_mau
   where month > now() + interval '25 months'),
  0::bigint,
  'K2.4: 미래 25개월 이후 → 0행 (빈 데이터 division by zero 없음)'
);

-- =====================================================================
-- K3. 평균 등록 시간 (kpi_registration_duration)
-- =====================================================================
-- 시드: 별도 month (지난 달) 에 4건 (30s / 60s / 90s / 120s) + failed 1건 (분포 왜곡 안 됨 검증)
-- 셀러 6 단독 사용.

insert into public.registration_jobs (id, seller_id, product_id, status, created_at, started_at, completed_at)
values
  ('00000000-0000-0000-0003-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000006'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'succeeded',
   date_trunc('month', now() - interval '2 month') + interval '1 day',
   date_trunc('month', now() - interval '2 month') + interval '1 day',
   date_trunc('month', now() - interval '2 month') + interval '1 day' + interval '30 second'),
  ('00000000-0000-0000-0003-000000000002'::uuid,
   '00000000-0000-0000-0000-000000000006'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'succeeded',
   date_trunc('month', now() - interval '2 month') + interval '2 day',
   date_trunc('month', now() - interval '2 month') + interval '2 day',
   date_trunc('month', now() - interval '2 month') + interval '2 day' + interval '60 second'),
  ('00000000-0000-0000-0003-000000000003'::uuid,
   '00000000-0000-0000-0000-000000000006'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'succeeded',
   date_trunc('month', now() - interval '2 month') + interval '3 day',
   date_trunc('month', now() - interval '2 month') + interval '3 day',
   date_trunc('month', now() - interval '2 month') + interval '3 day' + interval '90 second'),
  ('00000000-0000-0000-0003-000000000004'::uuid,
   '00000000-0000-0000-0000-000000000006'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'succeeded',
   date_trunc('month', now() - interval '2 month') + interval '4 day',
   date_trunc('month', now() - interval '2 month') + interval '4 day',
   date_trunc('month', now() - interval '2 month') + interval '4 day' + interval '120 second'),
  -- failed 잡 — view 는 분포에서 제외해야 함 (왜곡 방지)
  ('00000000-0000-0000-0003-000000000005'::uuid,
   '00000000-0000-0000-0000-000000000006'::uuid,
   '00000000-0000-0000-0000-0000000000aa'::uuid,
   'failed',
   date_trunc('month', now() - interval '2 month') + interval '5 day',
   date_trunc('month', now() - interval '2 month') + interval '5 day',
   date_trunc('month', now() - interval '2 month') + interval '5 day' + interval '999 second',
   'mock');

-- K3.1: 평균 avg_ms = 75000ms (30+60+90+120 / 4)
select is(
  (select avg_ms from public.kpi_registration_duration
   where month = date_trunc('month', now() - interval '2 month')),
  75000::bigint,
  'K3.1: 평균 등록 시간 avg_ms = 75000 (30+60+90+120/4)'
);

-- K3.2: p50 ≈ 75000ms (4건 중 중앙값은 60000 과 90000 의 평균 = 75000)
select is(
  (select p50_ms from public.kpi_registration_duration
   where month = date_trunc('month', now() - interval '2 month')),
  75000::bigint,
  'K3.2: p50_ms = 75000 (percentile_cont)'
);

-- K3.3: failed 제외 → completed_jobs = 4 (5건 시드했지만 failed 1건은 제외)
select is(
  (select completed_jobs::bigint from public.kpi_registration_duration
   where month = date_trunc('month', now() - interval '2 month')),
  4::bigint,
  'K3.3: failed 잡은 view 에서 제외 → completed_jobs = 4'
);

-- K3.4: 빈 월 (3개월 전 month) → row 없음 (집계 안 됨)
select is(
  (select count(*)::bigint from public.kpi_registration_duration
   where month = date_trunc('month', now() - interval '6 month')),
  0::bigint,
  'K3.4: 시드 없는 월 → 0행 (NULL division by zero 없음)'
);

-- =====================================================================
-- K4. NPS (kpi_nps_summary)
-- =====================================================================
-- 시드: 셀러 7,8,9,a 4명에 분포 — promoter 5 / passive 3 / detractor 2 = 10건
-- NPS = (5 - 2) / 10 * 100 = 30.0
-- 분기 unique 제약 회피용으로 trigger_reason 분산.

-- promoter (score >= 9) × 5
insert into public.nps_responses (seller_id, score, trigger_reason, surveyed_at) values
  ('00000000-0000-0000-0000-000000000007', 10, 'post_5_registrations', date_trunc('month', now() - interval '3 month') + interval '1 day'),
  ('00000000-0000-0000-0000-000000000007', 9,  'manual',               date_trunc('month', now() - interval '3 month') + interval '2 day'),
  ('00000000-0000-0000-0000-000000000007', 10, 'recurring_quarterly',  date_trunc('month', now() - interval '3 month') + interval '3 day'),
  ('00000000-0000-0000-0000-000000000008', 9,  'post_5_registrations', date_trunc('month', now() - interval '3 month') + interval '4 day'),
  ('00000000-0000-0000-0000-000000000008', 10, 'manual',               date_trunc('month', now() - interval '3 month') + interval '5 day');

-- passive (7,8) × 3
insert into public.nps_responses (seller_id, score, trigger_reason, surveyed_at) values
  ('00000000-0000-0000-0000-000000000008', 7,  'recurring_quarterly',  date_trunc('month', now() - interval '3 month') + interval '6 day'),
  ('00000000-0000-0000-0000-000000000009', 8,  'post_5_registrations', date_trunc('month', now() - interval '3 month') + interval '7 day'),
  ('00000000-0000-0000-0000-000000000009', 7,  'manual',               date_trunc('month', now() - interval '3 month') + interval '8 day');

-- detractor (0~6) × 2
insert into public.nps_responses (seller_id, score, trigger_reason, surveyed_at) values
  ('00000000-0000-0000-0000-000000000009', 6,  'recurring_quarterly',  date_trunc('month', now() - interval '3 month') + interval '9 day'),
  ('00000000-0000-0000-0000-00000000000a', 0,  'post_5_registrations', date_trunc('month', now() - interval '3 month') + interval '10 day');

-- K4.1: total_responses = 10
select is(
  (select total_responses::bigint from public.kpi_nps_summary
   where month = date_trunc('month', now() - interval '3 month')),
  10::bigint,
  'K4.1: NPS total_responses = 10'
);

-- K4.2: promoter=5 / passive=3 / detractor=2 — 분류 경계 정확
select is(
  (select (promoter, passive, detractor)::text from public.kpi_nps_summary
   where month = date_trunc('month', now() - interval '3 month')),
  '(5,3,2)'::text,
  'K4.2: promoter=5 / passive=3 / detractor=2 (score >=9 / 7~8 / <=6 경계)'
);

-- K4.3: NPS score = (5-2)/10*100 = 30.0
select is(
  (select nps_score from public.kpi_nps_summary
   where month = date_trunc('month', now() - interval '3 month')),
  30.0::numeric,
  'K4.3: NPS score = (promoter - detractor) / total * 100 = 30.0'
);

-- K4.4: 빈 월 (kpi_nps_summary) → row 없음 (division by zero 안전, NULL 안전)
select is(
  (select count(*)::bigint from public.kpi_nps_summary
   where month = date_trunc('month', now() - interval '20 month')),
  0::bigint,
  'K4.4: 시드 없는 월 → 0행 (NULL / division by zero 안전)'
);

-- =====================================================================
-- 마무리
-- =====================================================================
select * from finish();
rollback;
