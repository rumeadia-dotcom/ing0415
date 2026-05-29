-- apps/api/supabase/tests/esm_shipping_profiles_rls.sql
-- 출처:
--   docs/architecture/v1/features/esm.md §3 / §3.1 (esm_shipping_profiles DDL / RLS 계약)
--   migration 20260530000001_esm_shipping_profiles.sql
-- 목적:
--   esm_shipping_profiles 의 RLS 회귀:
--     - 셀러는 본인 row 만 SELECT (3단계 드롭다운 / 설정 목록).
--     - 타 셀러 row 는 RLS 로 0건 (cross-tenant 차단).
--     - authenticated 의 직접 INSERT/UPDATE/DELETE 거부 (GRANT 없음 = 42501).
--       생성/수정/삭제는 service_role(esm-shipping-profile Edge Function) 전용.
--     - service_role 만 INSERT / 전체 SELECT 가능.
--   addr_no / place_no / dispatch_policy_no 등 ESM 번호는 본인에게 노출 허용(PII 아님).
--   - 부분 실패 status='error' row (QA-313 / esm.md §3.2):
--       * place_no / dispatch_policy_no 가 NULL 인 error row 도 service_role INSERT 가능
--         (partial CHECK 가 active 일 때만 번호 필수).
--       * error row 도 RLS 로 본인만 SELECT (cross-tenant 차단).

-- psql meta-command 회피 — BEGIN/ROLLBACK + pgTAP fail 핸들링.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'RLS test requires Supabase roles.';
  end if;
end
$$;

-- ── 픽스처 ────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
                        raw_user_meta_data, raw_app_meta_data,
                        aud, role, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'seller-a-esm@test.local', '', now(),
   '{"display_name":"Seller A"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'seller-b-esm@test.local', '', now(),
   '{"display_name":"Seller B"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

insert into public.sellers (id, display_name, signup_provider)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Seller A', 'email'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'Seller B', 'email')
on conflict (id) do nothing;

-- market_credentials (market_accounts FK 충족용 최소 row).
-- 스키마: credential-vault.md §3.2 — 단일 credential_payload(bytea, pgcrypto) + credential_kind 4-way.
insert into public.market_credentials (
  id, seller_id, market_id, market_account_label,
  credential_kind, credential_payload, token_expires_at, ciphertext_kid
) values
  ('11111111-1111-1111-1111-111111111111'::uuid,
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'gmarket', 'ESM-A',
   'esm_jwt', pgp_sym_encrypt('{"masterId":"m-A","secretKey":"s-A","sellerId":"sa-A","site":"G"}'::text, 'test-master'),
   now() + interval '1 day', 'test-kid'),
  ('22222222-2222-2222-2222-222222222222'::uuid,
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'gmarket', 'ESM-B',
   'esm_jwt', pgp_sym_encrypt('{"masterId":"m-B","secretKey":"s-B","sellerId":"sa-B","site":"G"}'::text, 'test-master'),
   now() + interval '1 day', 'test-kid');

-- market_accounts
insert into public.market_accounts (
  id, seller_id, market_id, credential_id, account_label
) values
  ('33333333-3333-3333-3333-333333333333'::uuid,
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'gmarket',
   '11111111-1111-1111-1111-111111111111'::uuid, 'ESM-A'),
  ('44444444-4444-4444-4444-444444444444'::uuid,
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'gmarket',
   '22222222-2222-2222-2222-222222222222'::uuid, 'ESM-B');

-- esm_shipping_profiles 픽스처 (service_role 권한으로 INSERT — 번호만, PII 없음)
insert into public.esm_shipping_profiles (
  seller_id, market_account_id, site, profile_label,
  addr_no, place_no, bundle_policy_no, dispatch_policy_no,
  dispatch_type, shipping_fee, fee_type, status
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
   '33333333-3333-3333-3333-333333333333'::uuid, 'G', '기본 출고지/택배',
   '440753', '176129', '663289', '910', 'A', 0, 1, 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
   '44444444-4444-4444-4444-444444444444'::uuid, 'G', '기본 출고지/택배',
   '440754', '176130', '663290', '911', 'A', 2500, 1, 'active');

-- 부분 실패 error row 픽스처 (QA-313 / esm.md §3.2):
--   셀러 A: place 단계 실패 → addr_no 만 확보, place_no/dispatch_policy_no NULL, status='error'.
--   셀러 B: dispatch 단계 실패 → addr_no/place_no 확보, dispatch_policy_no NULL, status='error'.
-- (DEFAULT 컨텍스트 = superuser → service_role 경로 시뮬레이션. authenticated 직접 INSERT 는 아래에서 거부 확인.)
insert into public.esm_shipping_profiles (
  seller_id, market_account_id, site, profile_label,
  addr_no, place_no, bundle_policy_no, dispatch_policy_no,
  dispatch_type, shipping_fee, fee_type, raw_meta, status
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
   '33333333-3333-3333-3333-333333333333'::uuid, 'G', '부분실패-place',
   '440755', null, null, null,
   'A', 0, 1,
   '{"failedStep":"place","errorCode":"esm_place_http_500","completedSteps":["address"]}'::jsonb,
   'error'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
   '44444444-4444-4444-4444-444444444444'::uuid, 'G', '부분실패-dispatch',
   '440756', '176131', null, null,
   'B', 2500, 2,
   '{"failedStep":"dispatch","errorCode":"esm_dispatch_schema_mismatch","completedSteps":["address","place","policy"]}'::jsonb,
   'error');

-- ══════════════════════════════════════════════════════════════════════════
-- authenticated 셀러 A
-- ══════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

-- 본인 row SELECT 2건 (active 1 + error 1 — error row 도 본인 SELECT 가능)
select is(
  (select count(*)::bigint from public.esm_shipping_profiles
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  2::bigint,
  'esm_shipping_profiles: 셀러 A 본인 row SELECT 2건 (active + error)'
);

-- 타 셀러 row 는 RLS 로 0건 (active + error 전부)
select is(
  (select count(*)::bigint from public.esm_shipping_profiles
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'esm_shipping_profiles: 셀러 A 가 B row 시도 → RLS 로 0건 (cross-tenant 차단, error row 포함)'
);

-- 본인 active row 의 ESM 번호(PII 아님)는 노출 허용
select is(
  (select dispatch_policy_no from public.esm_shipping_profiles
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
      and status = 'active'),
  '910',
  'esm_shipping_profiles: 셀러 A 는 본인 dispatch_policy_no(번호) SELECT 가능'
);

-- 본인 error row 도 RLS 로 SELECT 가능 (고아 추적 — QA-313 / esm.md §3.2)
select is(
  (select count(*)::bigint from public.esm_shipping_profiles
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
      and status = 'error'),
  1::bigint,
  'esm_shipping_profiles: 셀러 A 는 본인 error row SELECT 가능 (고아 추적)'
);

-- error row 의 nullable 번호 — place_no/dispatch_policy_no 가 NULL 로 보존
select is(
  (select place_no from public.esm_shipping_profiles
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
      and status = 'error'),
  null,
  'esm_shipping_profiles: error row 의 place_no 는 NULL (부분 실패 — place 미확보)'
);

-- error row 의 raw_meta 는 PII-free 메타(failedStep)만 — 셀러는 실패 단계 확인 가능
select is(
  (select raw_meta->>'failedStep' from public.esm_shipping_profiles
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
      and status = 'error'),
  'place',
  'esm_shipping_profiles: error row raw_meta.failedStep = place (PII-free 메타)'
);

-- authenticated 직접 INSERT 거부 (GRANT 없음 → 42501)
select throws_ok(
  $sql$ insert into public.esm_shipping_profiles
          (seller_id, market_account_id, site, profile_label,
           addr_no, place_no, dispatch_policy_no, dispatch_type, shipping_fee, fee_type)
        values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                '33333333-3333-3333-3333-333333333333'::uuid, 'G', 'hack',
                '1','2','3','A',0,1) $sql$,
  '42501',
  null,
  'esm_shipping_profiles: authenticated 직접 INSERT 거부 (service_role 전용)'
);

-- authenticated UPDATE 거부 (GRANT 없음 → 42501)
select throws_ok(
  $sql$ update public.esm_shipping_profiles set profile_label = 'HACKED'
        where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid $sql$,
  '42501',
  null,
  'esm_shipping_profiles: authenticated UPDATE 거부 (GRANT 없음)'
);

-- authenticated DELETE 거부 (GRANT 없음 → 42501)
select throws_ok(
  $sql$ delete from public.esm_shipping_profiles
        where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid $sql$,
  '42501',
  null,
  'esm_shipping_profiles: authenticated DELETE 거부 (GRANT 없음)'
);

-- ══════════════════════════════════════════════════════════════════════════
-- anon — SELECT 거부 (GRANT 없음 → 42501)
-- ══════════════════════════════════════════════════════════════════════════
reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select throws_ok(
  $sql$ select count(*) from public.esm_shipping_profiles $sql$,
  '42501',
  null,
  'esm_shipping_profiles: anon SELECT 거부 (GRANT 없음)'
);

-- ══════════════════════════════════════════════════════════════════════════
-- service_role — 전체 SELECT 가능 (Edge Function 경로)
-- ══════════════════════════════════════════════════════════════════════════
reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.esm_shipping_profiles
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 4::bigint,
  'esm_shipping_profiles: service_role 은 전체 SELECT 가능 (active + error 4건)'
);

-- service_role 은 NULL 번호 error row INSERT 가능 (partial CHECK 가 error 일 때 허용)
select lives_ok(
  $sql$ insert into public.esm_shipping_profiles
          (seller_id, market_account_id, site, profile_label,
           addr_no, place_no, bundle_policy_no, dispatch_policy_no,
           dispatch_type, shipping_fee, fee_type, raw_meta, status)
        values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                '33333333-3333-3333-3333-333333333333'::uuid, 'G', '부분실패-address',
                null, null, null, null, 'A', 0, 1,
                '{"failedStep":"address","errorCode":"esm_address_http_401","completedSteps":[]}'::jsonb,
                'error') $sql$,
  'esm_shipping_profiles: service_role 은 NULL 번호 error row INSERT 가능 (partial CHECK 허용)'
);

-- active row 에 dispatch_policy_no NULL = partial CHECK 위반 (23514)
select throws_ok(
  $sql$ insert into public.esm_shipping_profiles
          (seller_id, market_account_id, site, profile_label,
           addr_no, place_no, bundle_policy_no, dispatch_policy_no,
           dispatch_type, shipping_fee, fee_type, status)
        values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                '33333333-3333-3333-3333-333333333333'::uuid, 'G', 'active-without-dispatch',
                '1', '2', null, null, 'A', 0, 1, 'active') $sql$,
  '23514',
  null,
  'esm_shipping_profiles: active row 의 NULL dispatch_policy_no 는 partial CHECK 위반 (23514)'
);

reset role;
select * from finish();

rollback;
