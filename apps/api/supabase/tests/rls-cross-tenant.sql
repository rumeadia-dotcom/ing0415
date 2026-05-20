-- apps/api/supabase/tests/rls-cross-tenant.sql
-- D-B pgTAP cross-tenant RLS 격리 회귀 테스트.
--
-- 출처:
--   docs/handoff/WIP-5markets-mvp.md §D Phase 4 "RLS 격리 cross-tenant (pgTAP)".
--   docs/architecture/v1/security.md §3 RLS 마스터 정책.
--   docs/architecture/v1/cross-cutting/credential-vault.md §3.2 (market_credentials = service_role only).
--   docs/architecture/v1/cross-cutting/registration-job-state.md §3.4 (registration_jobs / market_results RLS).
--
-- 목적:
--   셀러 A ('aaaa...aaaa') 가 셀러 B ('bbbb...bbbb') 의 데이터를 어떤 채널로도 보거나
--   변조할 수 없음을 보장. 각 RLS 적용 테이블에 대해 다음 6 시나리오를 회귀 검증:
--     1) authenticated A 가 본인 데이터만 SELECT 가능 (A row 보이고 B row 안 보임)
--     2) authenticated A 가 B 데이터를 명시적으로 SELECT → 0 row
--     3) authenticated A 가 B 데이터를 UPDATE → 0 row affected (RLS 차단)
--     4) authenticated A 가 B 데이터를 DELETE → 0 row affected (RLS 차단)
--     5) anon 권한으로 SELECT → 0 row (anon 자체 차단)
--     6) service_role 권한으로 SELECT → 양쪽 모두 보임 (관리자 우회)
--
-- 실행:
--   - Supabase CLI:  cd apps/api && supabase test db     (linked 프로젝트가 debug 이면 안전)
--   - 로컬 psql:     psql "$DATABASE_URL" -f apps/api/supabase/tests/rls-cross-tenant.sql
--
-- 격리:
--   본 파일은 BEGIN / ROLLBACK 으로 감싸 모든 픽스처를 잡 종료 시 폐기한다.
--   auth.users / public.sellers 도 동일 트랜잭션 내에서 정리된다.
--
-- 주의:
--   - service_role / authenticated / anon ROLE 은 Supabase 가 사전 정의. 미설치 환경에서는
--     초입 DO 블록이 sentinel 로 ROLE 부재를 감지하고 raise 한다.
--   - auth.uid() / auth.role() 은 GUC `request.jwt.claims` 기반. 본 테스트는 직접
--     SET LOCAL 으로 주입하여 실제 supabase-js 요청과 동일한 컨텍스트를 재현한다.
--   - 본 파일은 psql 변수(`\set`) 를 사용하지 않는다 — `supabase test db` 와 plain psql
--     양쪽 모두에서 동일하게 동작하도록 모든 UUID/JSON 을 인라인 SQL 리터럴로 박았다.

\set ON_ERROR_STOP on

begin;

-- pgTAP 확장 (Supabase CLI 의 `supabase test db` 는 자동 로드. 로컬 psql 직행 시도 안전망).
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- ──────────────────────────────────────────────────────────────────────────
-- Plan : 17 엔티티 × 6 시나리오 = 102.
--   sellers / audit_log / market_credentials / oauth_state / market_credentials_audit /
--   market_accounts / market_account_audit / shipping_policies / products /
--   product_images / product_image_transforms / product_market_mappings /
--   registration_jobs / registration_job_market_results / events / sessions / nps_responses
-- ──────────────────────────────────────────────────────────────────────────
select plan(102);

-- ──────────────────────────────────────────────────────────────────────────
-- 0. 픽스처 — 셀러 A / 셀러 B + 도메인 행 1건씩
-- ──────────────────────────────────────────────────────────────────────────

-- Supabase role 부재 시 fail-fast.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'RLS test requires Supabase roles. Run via `supabase test db` or `supabase start`.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    raise exception 'RLS test requires `anon` role.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'RLS test requires `service_role` role.';
  end if;
end
$$;

-- auth.users 직접 INSERT (트리거 handle_new_seller 가 sellers 자동 생성).
insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
                        raw_user_meta_data, raw_app_meta_data,
                        aud, role, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'seller-a@test.local', '', now(),
   '{"display_name":"Seller A"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'seller-b@test.local', '', now(),
   '{"display_name":"Seller B"}'::jsonb, '{"provider":"email"}'::jsonb,
   'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

-- handle_new_seller 트리거가 INSERT 누락한 경우 보강 (멱등).
insert into public.sellers (id, display_name, signup_provider)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Seller A', 'email'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'Seller B', 'email')
on conflict (id) do nothing;

-- audit_log
insert into public.audit_log (category, event, seller_id) values
  ('auth', 'login_success', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  ('auth', 'login_success', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid);

-- market_credentials (테스트 픽스처는 service_role 우회 INSERT)
insert into public.market_credentials
  (seller_id, market_id, market_account_label,
   credential_kind, credential_payload,
   token_expires_at, ciphertext_kid, scope)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'naver', 'A-store',
   'oauth', pgp_sym_encrypt('{"access":"tok-A","refresh":"r-A"}'::text, 'test-master'),
   now() + interval '1 hour', 'test-kid', '{commerce.products}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'naver', 'B-store',
   'oauth', pgp_sym_encrypt('{"access":"tok-B","refresh":"r-B"}'::text, 'test-master'),
   now() + interval '1 hour', 'test-kid', '{commerce.products}');

-- oauth_state
insert into public.oauth_state (state, seller_id, market_id, expires_at) values
  ('state-A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'naver', now() + interval '10 minutes'),
  ('state-B', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'naver', now() + interval '10 minutes');

-- market_credentials_audit
insert into public.market_credentials_audit
  (credential_id, seller_id, market_id, event, actor)
select id, seller_id, market_id, 'encrypt_store', 'service_role'
  from public.market_credentials
  where market_account_label in ('A-store','B-store');

-- market_accounts (credential FK)
insert into public.market_accounts (seller_id, market_id, credential_id, account_label)
select mc.seller_id, mc.market_id, mc.id, mc.market_account_label
  from public.market_credentials mc
  where mc.market_account_label in ('A-store','B-store');

-- market_account_audit
insert into public.market_account_audit (account_id, seller_id, market_id, event)
select ma.id, ma.seller_id, ma.market_id, 'connect_succeeded'
  from public.market_accounts ma
  where ma.seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid);

-- shipping_policies
insert into public.shipping_policies (seller_id, name, fee, method, eta_days, is_default) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'A-기본배송', 3000, 'parcel', 2, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'B-기본배송', 3500, 'parcel', 3, true);

-- products (shipping_policy_id 본인 정책)
insert into public.products (seller_id, name, price, base_category_id, shipping_policy_id)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '셀러A 상품', 10000, 'cat-1', id
  from public.shipping_policies
  where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
insert into public.products (seller_id, name, price, base_category_id, shipping_policy_id)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '셀러B 상품', 20000, 'cat-2', id
  from public.shipping_policies
  where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

-- product_images
insert into public.product_images
  (seller_id, product_id, position, original_path, mime, bytes, role, status)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, id, 0,
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/'||id::text||'/main.jpg',
       'image/jpeg', 102400, 'main'::public.product_image_role, 'uploaded'::public.image_status
  from public.products where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
insert into public.product_images
  (seller_id, product_id, position, original_path, mime, bytes, role, status)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, id, 0,
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/'||id::text||'/main.jpg',
       'image/jpeg', 102400, 'main'::public.product_image_role, 'uploaded'::public.image_status
  from public.products where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

-- product_image_transforms
insert into public.product_image_transforms (image_id, market, status)
select id, 'naver', 'pending'::public.transform_status
  from public.product_images
  where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
insert into public.product_image_transforms (image_id, market, status)
select id, 'naver', 'pending'::public.transform_status
  from public.product_images
  where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

-- product_market_mappings
insert into public.product_market_mappings (product_id, seller_id, market_id, market_category_code)
select id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'naver', 'NCAT-A'
  from public.products where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
insert into public.product_market_mappings (product_id, seller_id, market_id, market_category_code)
select id, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'naver', 'NCAT-B'
  from public.products where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

-- registration_jobs
insert into public.registration_jobs (seller_id, product_id)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, id
  from public.products where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
insert into public.registration_jobs (seller_id, product_id)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, id
  from public.products where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

-- registration_job_market_results
insert into public.registration_job_market_results (job_id, market_id, market_account_id)
select rj.id, 'naver', ma.id
  from public.registration_jobs rj
  join public.market_accounts ma on ma.seller_id = rj.seller_id
  where rj.seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
insert into public.registration_job_market_results (job_id, market_id, market_account_id)
select rj.id, 'naver', ma.id
  from public.registration_jobs rj
  join public.market_accounts ma on ma.seller_id = rj.seller_id
  where rj.seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

-- events (history_viewed: insert 정책 화이트리스트 내)
insert into public.events (seller_id, event_type, source) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'history_viewed'::public.event_type, 'web'::public.event_source),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'history_viewed'::public.event_type, 'web'::public.event_source);

-- sessions
insert into public.sessions (seller_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid);

-- nps_responses
insert into public.nps_responses (seller_id, score, trigger_reason) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 9, 'manual'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 7, 'manual');

-- ══════════════════════════════════════════════════════════════════════════
-- 1. sellers  (auth.md §2.2.1 — SELECT self / UPDATE self / INSERT trigger only)
-- ══════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.sellers),
  1::bigint,
  'sellers: 셀러 A 는 본인 row 1건만 SELECT 가능'
);

select is(
  (select count(*)::bigint from public.sellers
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'sellers: 셀러 A 는 셀러 B 의 sellers row 를 볼 수 없음'
);

with upd as (
  update public.sellers set display_name = 'HACKED'
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'sellers: 셀러 A 는 셀러 B 의 sellers UPDATE 불가 (RLS 차단)'
);

with del as (
  delete from public.sellers
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'sellers: 셀러 A 는 셀러 B 의 sellers DELETE 불가 (정책 부재)'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.sellers),
  0::bigint,
  'sellers: anon 권한은 모든 row 차단'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.sellers
    where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'sellers: service_role 은 양 셀러 row 전부 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 2. audit_log  (sellers.sql §4 — SELECT own, UPDATE/DELETE trigger block)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.audit_log
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'audit_log: 셀러 A 는 본인 row 만 SELECT'
);

select is(
  (select count(*)::bigint from public.audit_log
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'audit_log: 셀러 A 는 셀러 B 의 audit_log 0건'
);

with upd as (
  update public.audit_log set event = 'HACKED'
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'audit_log: 셀러 A 는 셀러 B 의 audit_log UPDATE 차단 (RLS 0건)'
);

with del as (
  delete from public.audit_log
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'audit_log: 셀러 A 는 셀러 B 의 audit_log DELETE 차단 (RLS 0건)'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.audit_log),
  0::bigint,
  'audit_log: anon 권한은 모든 row 차단'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.audit_log
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'audit_log: service_role 은 양 셀러 row 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 3. market_credentials  (credential-vault.md §3.2 — 정책 0개, service_role only)
--    토큰 유출 시 치명적이므로 가장 엄격하게 검증.
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.market_credentials),
  0::bigint,
  'market_credentials: authenticated 는 본인 row 조차 SELECT 불가 (정책 0개)'
);

select is(
  (select count(*)::bigint from public.market_credentials
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'market_credentials: 셀러 A 는 셀러 B 토큰 SELECT 불가'
);

with upd as (
  update public.market_credentials set status = 'revoked'
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'market_credentials: 셀러 A 는 셀러 B 토큰 UPDATE 불가'
);

with del as (
  delete from public.market_credentials
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'market_credentials: 셀러 A 는 셀러 B 토큰 DELETE 불가'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.market_credentials),
  0::bigint,
  'market_credentials: anon 권한 SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.market_credentials
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'market_credentials: service_role 만 SELECT 가능 (양 셀러 가시)'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 4. oauth_state  (markets.md §2.5 — 정책 0개, service_role only)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.oauth_state),
  0::bigint,
  'oauth_state: authenticated 는 SELECT 불가 (정책 0개)'
);

select is(
  (select count(*)::bigint from public.oauth_state
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'oauth_state: 셀러 A 는 셀러 B 의 state 0건'
);

with upd as (
  update public.oauth_state set consumed_at = now()
    where state = 'state-B' returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'oauth_state: 셀러 A 는 셀러 B 의 state UPDATE 불가'
);

with del as (
  delete from public.oauth_state where state = 'state-B' returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'oauth_state: 셀러 A 는 셀러 B 의 state DELETE 불가'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.oauth_state),
  0::bigint,
  'oauth_state: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.oauth_state where state in ('state-A','state-B')),
  '>=', 2::bigint,
  'oauth_state: service_role 만 SELECT 가능'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 5. market_credentials_audit  (credential-vault.md §10.1 — service_role only)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.market_credentials_audit),
  0::bigint,
  'market_credentials_audit: authenticated SELECT 불가 (정책 0개)'
);

select is(
  (select count(*)::bigint from public.market_credentials_audit
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'market_credentials_audit: 셀러 A 는 B 감사 row 0건'
);

with upd as (
  update public.market_credentials_audit set actor = 'incident_response'
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'market_credentials_audit: 셀러 A 는 B 감사 row UPDATE 불가'
);

with del as (
  delete from public.market_credentials_audit
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'market_credentials_audit: 셀러 A 는 B 감사 row DELETE 불가'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.market_credentials_audit),
  0::bigint,
  'market_credentials_audit: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.market_credentials_audit
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'market_credentials_audit: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 6. market_accounts  (markets.md §2.2 — SELECT own only)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.market_accounts
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'market_accounts: 셀러 A 는 본인 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.market_accounts
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'market_accounts: 셀러 A 는 B 계정 0건'
);

with upd as (
  update public.market_accounts set status = 'revoked'
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'market_accounts: 셀러 A 는 B 계정 UPDATE 불가'
);

with del as (
  delete from public.market_accounts
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'market_accounts: 셀러 A 는 B 계정 DELETE 불가'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.market_accounts),
  0::bigint,
  'market_accounts: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.market_accounts
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'market_accounts: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 7. market_account_audit  (markets.md §2.4 — service_role only)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.market_account_audit),
  0::bigint,
  'market_account_audit: authenticated SELECT 불가'
);

select is(
  (select count(*)::bigint from public.market_account_audit
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'market_account_audit: 셀러 A 는 B 감사 0건'
);

with upd as (
  update public.market_account_audit set event = 'auto_revoked'
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'market_account_audit: 셀러 A 는 B 감사 UPDATE 불가'
);

with del as (
  delete from public.market_account_audit
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'market_account_audit: 셀러 A 는 B 감사 DELETE 불가'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.market_account_audit),
  0::bigint,
  'market_account_audit: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.market_account_audit
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'market_account_audit: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 8. shipping_policies  (products.sql §2 — 완전 CRUD own)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.shipping_policies
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'shipping_policies: 셀러 A 는 본인 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.shipping_policies
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'shipping_policies: 셀러 A 는 B 정책 0건'
);

with upd as (
  update public.shipping_policies set fee = 1
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'shipping_policies: 셀러 A 는 B 정책 UPDATE 차단'
);

with del as (
  delete from public.shipping_policies
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'shipping_policies: 셀러 A 는 B 정책 DELETE 차단'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.shipping_policies),
  0::bigint,
  'shipping_policies: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.shipping_policies
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'shipping_policies: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 9. products  (products.sql §3 — 완전 CRUD own)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.products
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'products: 셀러 A 는 본인 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.products
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'products: 셀러 A 는 B 상품 0건'
);

with upd as (
  update public.products set name = 'HACKED'
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'products: 셀러 A 는 B 상품 UPDATE 차단'
);

with del as (
  delete from public.products
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'products: 셀러 A 는 B 상품 DELETE 차단'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.products),
  0::bigint,
  'products: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.products
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'products: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 10. product_images  (products.sql §4 — 완전 CRUD own)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.product_images
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'product_images: 셀러 A 는 본인 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.product_images
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'product_images: 셀러 A 는 B 이미지 0건'
);

with upd as (
  update public.product_images set status = 'failed'::public.image_status
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'product_images: 셀러 A 는 B 이미지 UPDATE 차단'
);

with del as (
  delete from public.product_images
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'product_images: 셀러 A 는 B 이미지 DELETE 차단'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.product_images),
  0::bigint,
  'product_images: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.product_images
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'product_images: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 11. product_image_transforms  (products.sql §5 — SELECT only via image join,
--     INSERT/UPDATE/DELETE 는 service_role 만)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

-- 셀러 A 본인 image 변환본 1건 (join 통해 보여야 함). 단, RLS 가 product_images 에도
-- 적용되므로 join 자체가 본인 image 만 가시 → 결과 1.
select is(
  (select count(*)::bigint
   from public.product_image_transforms pit
   join public.product_images pi on pi.id = pit.image_id
   where pi.seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'product_image_transforms: 셀러 A 는 본인 image 의 변환본 1건 SELECT'
);

-- A 가 B image 변환본 조회 시도 → product_images RLS 차단으로 join 결과 0
select is(
  (select count(*)::bigint
   from public.product_image_transforms pit
   join public.product_images pi on pi.id = pit.image_id
   where pi.seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'product_image_transforms: 셀러 A 는 B image 의 변환본 0건'
);

-- UPDATE 정책 없음 → 0 affected (셀러 A 가 어떤 row 도 못 만진다)
with upd as (
  update public.product_image_transforms set status = 'failed'::public.transform_status
    where image_id in (select id from public.product_images
                       where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)
    returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'product_image_transforms: 셀러 A 는 B 변환본 UPDATE 차단'
);

with del as (
  delete from public.product_image_transforms
    where image_id in (select id from public.product_images
                       where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)
    returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'product_image_transforms: 셀러 A 는 B 변환본 DELETE 차단'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.product_image_transforms),
  0::bigint,
  'product_image_transforms: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.product_image_transforms),
  '>=', 2::bigint,
  'product_image_transforms: service_role 가시 (양 셀러 변환본 ≥ 2)'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 12. product_market_mappings  (products.sql §6 — 완전 CRUD own)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.product_market_mappings
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'product_market_mappings: 셀러 A 는 본인 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.product_market_mappings
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'product_market_mappings: 셀러 A 는 B 매핑 0건'
);

with upd as (
  update public.product_market_mappings set market_category_code = 'HACKED'
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'product_market_mappings: 셀러 A 는 B 매핑 UPDATE 차단'
);

with del as (
  delete from public.product_market_mappings
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'product_market_mappings: 셀러 A 는 B 매핑 DELETE 차단'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.product_market_mappings),
  0::bigint,
  'product_market_mappings: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.product_market_mappings
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'product_market_mappings: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 13. registration_jobs  (registration-job-state.md §3.4)
--     SELECT own / INSERT own / UPDATE cancel only / DELETE 전면 금지
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.registration_jobs
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'registration_jobs: 셀러 A 는 본인 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.registration_jobs
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'registration_jobs: 셀러 A 는 B 잡 0건'
);

-- UPDATE 정책은 cancel 만 — B 잡의 status 를 cancelled 로 바꿔도 RLS using 절
-- (seller_id = auth.uid()) 에서 1차로 0건 매치 → 0 affected.
with upd as (
  update public.registration_jobs
     set status = 'cancelled',
         cancelled_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
         cancelled_at = now(),
         completed_at = now()
   where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
   returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'registration_jobs: 셀러 A 는 B 잡 UPDATE(cancel 포함) 불가'
);

-- DELETE 정책 = using(false) → 누구도 DELETE 불가
with del as (
  delete from public.registration_jobs
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'registration_jobs: 셀러 A 는 B 잡 DELETE 차단 (정책 using(false))'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.registration_jobs),
  0::bigint,
  'registration_jobs: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.registration_jobs
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'registration_jobs: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 14. registration_job_market_results  (registration-job-state.md §3.4)
--     SELECT own via join / 클라이언트 write 전면 차단
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint
   from public.registration_job_market_results jmr
   join public.registration_jobs rj on rj.id = jmr.job_id
   where rj.seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'registration_job_market_results: 셀러 A 는 본인 잡의 결과 1건 SELECT'
);

select is(
  (select count(*)::bigint
   from public.registration_job_market_results jmr
   join public.registration_jobs rj on rj.id = jmr.job_id
   where rj.seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'registration_job_market_results: 셀러 A 는 B 잡 결과 0건'
);

-- jmr_no_write_client (FOR ALL using(false) with check(false)) — A 가 B 결과 UPDATE 시도
with upd as (
  update public.registration_job_market_results
     set market_status = 'failed'::public.market_result_status,
         error_code    = 'forced'
   where job_id in (select id from public.registration_jobs
                    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)
   returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'registration_job_market_results: 셀러 A 는 B 결과 UPDATE 차단'
);

with del as (
  delete from public.registration_job_market_results
    where job_id in (select id from public.registration_jobs
                     where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)
    returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'registration_job_market_results: 셀러 A 는 B 결과 DELETE 차단'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.registration_job_market_results),
  0::bigint,
  'registration_job_market_results: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.registration_job_market_results),
  '>=', 2::bigint,
  'registration_job_market_results: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 15. events  (events_kpi.sql §3 — SELECT own / INSERT web own / UPDATE·DELETE 부재)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.events
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'events: 셀러 A 는 본인 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.events
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'events: 셀러 A 는 B 이벤트 0건'
);

with upd as (
  update public.events set payload = '{"hacked":true}'::jsonb
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'events: 셀러 A 는 B 이벤트 UPDATE 차단 (정책 부재)'
);

with del as (
  delete from public.events
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'events: 셀러 A 는 B 이벤트 DELETE 차단 (정책 부재)'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.events),
  0::bigint,
  'events: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.events
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'events: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 16. sessions  (events_kpi.sql §4 — SELECT/INSERT/UPDATE own)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.sessions
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'sessions: 셀러 A 는 본인 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.sessions
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'sessions: 셀러 A 는 B 세션 0건'
);

with upd as (
  update public.sessions set ended_at = now()
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'sessions: 셀러 A 는 B 세션 UPDATE 차단'
);

with del as (
  delete from public.sessions
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'sessions: 셀러 A 는 B 세션 DELETE 차단 (정책 부재)'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.sessions),
  0::bigint,
  'sessions: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.sessions
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'sessions: service_role 가시'
);

-- ══════════════════════════════════════════════════════════════════════════
-- 17. nps_responses  (events_kpi.sql §5 — SELECT/INSERT own, UPDATE/DELETE immutable)
-- ══════════════════════════════════════════════════════════════════════════

reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select is(
  (select count(*)::bigint from public.nps_responses
    where seller_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  1::bigint,
  'nps_responses: 셀러 A 는 본인 1건 SELECT'
);

select is(
  (select count(*)::bigint from public.nps_responses
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0::bigint,
  'nps_responses: 셀러 A 는 B 응답 0건'
);

with upd as (
  update public.nps_responses set score = 0
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from upd),
  0::bigint,
  'nps_responses: 셀러 A 는 B 응답 UPDATE 차단 (정책 부재)'
);

with del as (
  delete from public.nps_responses
    where seller_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid returning 1
)
select is(
  (select count(*)::bigint from del),
  0::bigint,
  'nps_responses: 셀러 A 는 B 응답 DELETE 차단 (정책 부재)'
);

reset role;
set local role anon;
set local "request.jwt.claims" to '{}';
select is(
  (select count(*)::bigint from public.nps_responses),
  0::bigint,
  'nps_responses: anon SELECT 불가'
);

reset role;
set local role service_role;
select cmp_ok(
  (select count(*)::bigint from public.nps_responses
    where seller_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  '>=', 2::bigint,
  'nps_responses: service_role 가시'
);

-- ──────────────────────────────────────────────────────────────────────────
-- finish + rollback. 픽스처 (auth.users / sellers / 전 도메인 row) 는 트랜잭션
-- 종료 시 자동 폐기되어 운영 DB 에 잔여물이 남지 않는다.
-- ──────────────────────────────────────────────────────────────────────────
reset role;
select * from finish();

rollback;
