-- apps/api/supabase/tests/v2_shipping_jobs_rls.sql
-- 출처:
--   docs/spec/PRD.md §8 (shipping_jobs / shipping_job_results DDL)
--   docs/architecture/v1/cross-cutting/security.md §3 (RLS cross-tenant 격리)
-- 목적:
--   shipping_jobs / shipping_job_results 에 대해 셀러 A 가 B 데이터를 어떤 채널로도
--   접근하지 못함을 회귀 검증. shipping_job_results 는 부모 잡 join 기반 RLS.

-- (removed) \set ON_ERROR_STOP on : psql meta-command - supabase test db 컨텍스트에서 SQLSTATE 42601. BEGIN/ROLLBACK 트랜잭션 + pgTAP 자체 fail 핸들링으로 대체.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- shipping_jobs 6 + shipping_job_results 6 = 12 시나리오
select plan(12);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'RLS test requires Supabase roles.';
  end if;
end
$$;

-- 픽스처
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
                        raw_user_meta_data, raw_app_meta_data,
                        aud, role, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'seller-a-v2ship@test.local', '', now(),
   '{"display_name":"Seller A"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'seller-b-v2ship@test.local', '', now(),
   '{"display_name":"Seller B"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

insert into public.sellers (id, display_name, signup_provider)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Seller A', 'email'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'Seller B', 'email')
on conflict (id) do nothing;

-- orders 픽스처 (shipping_job_results 가 order_id FK 필요)
insert into public.orders (
  seller_id, market_id, external_order_id,
  receiver_name, receiver_address, receiver_phone,
  product_name, quantity, order_amount, status,
  waybill_number
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'naver', 'EXT-A-SHIP-1',
   '홍A', '서울시', '010-1111-1111', '상품A', 1, 10000, 'waybill_printed', 'WB-A-1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'naver', 'EXT-B-SHIP-1',
   '홍B', '서울시', '010-2222-2222', '상품B', 1, 20000, 'waybill_printed', 'WB-B-1');

-- shipping_jobs 픽스처
insert into public.shipping_jobs (seller_id, status, order_count, success_count, failed_count)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'succeeded', 1, 1, 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'partial',   1, 0, 1);

-- shipping_job_results 픽스처
insert into public.shipping_job_results (job_id, order_id, market_id, status)
select sj.id, o.id, 'naver', 'success'::public.shipping_market_status
  from public.shipping_jobs sj
  join public.orders o on o.seller_id = sj.seller_id
  where sj.seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
insert into public.shipping_job_results (job_id, order_id, market_id, status, error_code, error_message)
select sj.id, o.id, 'naver', 'failed'::public.shipping_market_status, 'E429', 'rate limited'
  from public.shipping_jobs sj
  join public.orders o on o.seller_id = sj.seller_id
  where sj.seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

-- ══════════════════════════════════════════════════════════════════════════
-- shipping_jobs (6)
-- ══════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.shipping_jobs
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'shipping_jobs: 셀러 A 는 본인 잡 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.shipping_jobs
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'shipping_jobs: 셀러 A 는 B 잡 0건'
);

with upd as (
  update public.shipping_jobs set status = 'failed'::public.shipping_job_status
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'shipping_jobs: 셀러 A 는 B 잡 UPDATE 차단'
);

with del as (
  delete from public.shipping_jobs
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'shipping_jobs: 셀러 A 는 B 잡 DELETE 차단 (정책 부재)'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.shipping_jobs),
  0::bigint,
  'shipping_jobs: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.shipping_jobs
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'shipping_jobs: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- shipping_job_results (6)
-- 부모 잡 RLS join 기반 — A 는 본인 잡의 결과만, B 잡 결과 0건.
-- ══════════════════════════════════════════════════════════════════════════
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint
   from public.shipping_job_results sjr
   join public.shipping_jobs sj on sj.id = sjr.job_id
   where sj.seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'shipping_job_results: 셀러 A 는 본인 잡의 결과 1건 SELECT'
);

select is(
  (select count(*)::bigint
   from public.shipping_job_results sjr
   join public.shipping_jobs sj on sj.id = sjr.job_id
   where sj.seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'shipping_job_results: 셀러 A 는 B 잡 결과 0건'
);

with upd as (
  update public.shipping_job_results
     set status = 'failed'::public.shipping_market_status,
         error_code = 'forced'
   where job_id in (
     select id from public.shipping_jobs
     where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
   )
   returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'shipping_job_results: 셀러 A 는 B 결과 UPDATE 차단 (정책 부재)'
);

with del as (
  delete from public.shipping_job_results
    where job_id in (
      select id from public.shipping_jobs
      where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
    )
    returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'shipping_job_results: 셀러 A 는 B 결과 DELETE 차단 (정책 부재)'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.shipping_job_results),
  0::bigint,
  'shipping_job_results: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.shipping_job_results),
  '>=', 2::bigint,
  'shipping_job_results: service_role 가시 (양 잡 결과 ≥ 2)'
);

reset role;
select * from finish();

rollback;
