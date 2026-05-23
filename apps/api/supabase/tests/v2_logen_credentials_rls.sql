-- apps/api/supabase/tests/v2_logen_credentials_rls.sql
-- 출처:
--   docs/spec/PRD.md §7 / §8 (logen_credentials DDL — encrypted bytea + view 패턴)
--   docs/architecture/v1/cross-cutting/credential-vault.md §3.2 (정책 0개 = service_role only)
-- 목적:
--   logen_credentials 의 raw 테이블에는 authenticated / anon 의 SELECT 가 0건이어야 하고,
--   메타는 logen_credentials_meta view 로만 본인 row 1건 가시되어야 함.
--   userId/custCd 평문이 SQL 응답으로 새지 않는지도 회귀.

-- (removed) \set ON_ERROR_STOP on : psql meta-command - supabase test db 컨텍스트에서 SQLSTATE 42601. BEGIN/ROLLBACK 트랜잭션 + pgTAP 자체 fail 핸들링으로 대체.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- raw 테이블 6 시나리오 + view 4 시나리오 = 10
select plan(10);

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
   'seller-a-logen@test.local', '', now(),
   '{"display_name":"Seller A"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'seller-b-logen@test.local', '', now(),
   '{"display_name":"Seller B"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

insert into public.sellers (id, display_name, signup_provider)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Seller A', 'email'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'Seller B', 'email')
on conflict (id) do nothing;

-- logen_credentials 픽스처 (service_role 권한 우회 INSERT)
insert into public.logen_credentials (
  seller_id, user_id_enc, cust_cd_enc,
  sender_name, sender_address, sender_phone,
  fare_ty, dlv_fare, ciphertext_kid
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
   pgp_sym_encrypt('USR-A-LOGEN', 'test-master'),
   pgp_sym_encrypt('CUST-A-001',  'test-master'),
   '셀러A',  '서울시 강남구 1', '02-111-1111', 'C', 0, 'test-kid'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
   pgp_sym_encrypt('USR-B-LOGEN', 'test-master'),
   pgp_sym_encrypt('CUST-B-001',  'test-master'),
   '셀러B',  '서울시 송파구 9', '02-222-2222', 'C', 0, 'test-kid');

-- ══════════════════════════════════════════════════════════════════════════
-- raw 테이블 — authenticated 는 SELECT 불가 (정책 0개)
-- ══════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.logen_credentials),
  0::bigint,
  'logen_credentials: authenticated 는 본인 row 조차 raw SELECT 불가 (정책 0개)'
);

select is(
  (select count(*)::bigint from public.logen_credentials
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'logen_credentials: 셀러 A 는 B 자격증명 raw SELECT 불가'
);

with upd as (
  update public.logen_credentials set sender_name = 'HACKED'
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'logen_credentials: 셀러 A 는 B 자격증명 UPDATE 불가'
);

with del as (
  delete from public.logen_credentials
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'logen_credentials: 셀러 A 는 B 자격증명 DELETE 불가'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.logen_credentials),
  0::bigint,
  'logen_credentials: anon 권한은 raw SELECT 0건'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.logen_credentials
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'logen_credentials: service_role 만 raw SELECT 가능'
);

-- ══════════════════════════════════════════════════════════════════════════
-- view — 본인 row 메타만 노출. encrypted 컬럼은 view 자체에 없으므로 누출 불가.
-- ══════════════════════════════════════════════════════════════════════════
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.logen_credentials_meta),
  1::bigint,
  'logen_credentials_meta: 셀러 A 는 본인 메타 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.logen_credentials_meta
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'logen_credentials_meta: 셀러 A 는 B 메타 0건'
);

-- view 정의에 user_id_enc / cust_cd_enc 가 포함되지 않아야 함 (구조 회귀).
select is(
  (select count(*)::bigint
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'logen_credentials_meta'
     and column_name in ('user_id_enc', 'cust_cd_enc')),
  0::bigint,
  'logen_credentials_meta: view 컬럼에 encrypted bytea (user_id_enc / cust_cd_enc) 미포함'
);

-- connected 플래그가 true 로 표기되는지 (encrypted 가 채워져 있으면)
select is(
  (select connected from public.logen_credentials_meta
   where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  true,
  'logen_credentials_meta: 셀러 A 의 connected = true (encrypted 양쪽 채워짐)'
);

reset role;
select * from finish();

rollback;
