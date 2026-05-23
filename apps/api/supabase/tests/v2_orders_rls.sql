-- apps/api/supabase/tests/v2_orders_rls.sql
-- 출처:
--   docs/spec/PRD.md §8 (orders DDL)
--   docs/architecture/v1/cross-cutting/security.md §3 (RLS cross-tenant 격리 기준)
--   apps/api/supabase/tests/rls-cross-tenant.sql (선행 패턴 — 6 시나리오 회귀)
-- 목적:
--   셀러 A 가 셀러 B 의 orders 를 어떤 채널로도 보거나 변조할 수 없음을 보장.
--   1) authenticated A : 본인 row SELECT 1건
--   2) authenticated A : B row SELECT 0건
--   3) authenticated A : B row UPDATE 0 affected
--   4) authenticated A : B row DELETE 0 affected
--   5) anon            : SELECT 0건
--   6) service_role    : 양쪽 row 가시

-- (removed) \set ON_ERROR_STOP on : psql meta-command - supabase test db 컨텍스트에서 SQLSTATE 42601. BEGIN/ROLLBACK 트랜잭션 + pgTAP 자체 fail 핸들링으로 대체.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- pgTAP plan : 6 시나리오
select plan(6);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'RLS test requires Supabase roles.';
  end if;
end
$$;

-- 픽스처: auth.users + sellers (trigger)
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
                        raw_user_meta_data, raw_app_meta_data,
                        aud, role, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'seller-a-v2orders@test.local', '', now(),
   '{"display_name":"Seller A"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'seller-b-v2orders@test.local', '', now(),
   '{"display_name":"Seller B"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

insert into public.sellers (id, display_name, signup_provider)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Seller A', 'email'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'Seller B', 'email')
on conflict (id) do nothing;

-- orders 픽스처 (service_role 권한 우회 INSERT)
insert into public.orders (
  seller_id, market_id, external_order_id,
  receiver_name, receiver_address, receiver_phone,
  product_name, quantity, order_amount, status
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'naver', 'EXT-A-001',
   '홍길동A', '서울시 강남구', '010-1111-1111',
   '셀러A 텀블러', 1, 15000, 'collected'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'coupang', 'EXT-B-001',
   '홍길동B', '서울시 송파구', '010-2222-2222',
   '셀러B 머그컵', 2, 24000, 'collected');

-- ── 1) authenticated A : 본인 row SELECT 1건
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.orders
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'orders: 셀러 A 는 본인 주문 1건 SELECT'
);

-- ── 2) authenticated A : B row SELECT 0건
select is(
  (select count(*)::bigint from public.orders
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'orders: 셀러 A 는 셀러 B 의 주문 SELECT 0건'
);

-- ── 3) authenticated A : B row UPDATE 0 affected
with upd as (
  update public.orders
     set status = 'logen_failed'::public.order_status,
         error_code = 'forced'
   where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
   returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'orders: 셀러 A 는 셀러 B 의 주문 UPDATE 차단 (RLS 0건)'
);

-- ── 4) authenticated A : B row DELETE 0 affected (정책 부재 → 차단)
with del as (
  delete from public.orders
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'orders: 셀러 A 는 셀러 B 의 주문 DELETE 차단 (정책 부재)'
);

-- ── 5) anon : SELECT 0건
reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.orders),
  0::bigint,
  'orders: anon 권한은 모든 row 차단'
);

-- ── 6) service_role : 양쪽 row 가시
reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.orders
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'orders: service_role 은 양 셀러 주문 가시'
);

reset role;
select * from finish();

rollback;
