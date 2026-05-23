-- 20260523000002_audit_category_and_execute.sql
-- 운영에서 발견된 두 별개 버그를 한 마이그레이션으로 영속화.
--
-- ─────────────────────────────────────────────────────────────
-- 버그 1: audit_log.category check constraint 가 'market' (단수) 만 허용
-- ─────────────────────────────────────────────────────────────
-- Edge Function 코드 31군데에서 `category: 'markets'` (복수) 로 audit insert.
-- DB constraint 는 단수만 허용 → 23514 (check_violation).
-- 다른 도메인은 단수 ('auth', 'account') 이지만 'markets' 가 이미 코드 컨벤션이라
-- DB 측에 'markets' 를 추가하여 양립 허용. (코드 일괄 수정은 별도 cleanup PR 예정.)
--
-- ─────────────────────────────────────────────────────────────
-- 버그 2: service_role 에 함수 EXECUTE 권한 없음
-- ─────────────────────────────────────────────────────────────
-- hotfix/v0.9.4 (20260523000001) 은 테이블·시퀀스에만 GRANT.
-- 함수 (특히 fn_encrypt_and_store_credential 등 RPC) EXECUTE 권한 누락.
-- PostgREST 는 EXECUTE 권한 없는 함수를 42883 (undefined_function) 으로 표면화.
-- credentials.ts:100 storeCredential 의 .rpc() 호출이 모두 fail 하던 원인.

-- ── 버그 1 fix ─────────────────────────────────────────────
alter table public.audit_log drop constraint if exists audit_log_category_check;
alter table public.audit_log add constraint audit_log_category_check
  check (category in ('auth', 'market', 'markets', 'registration', 'security', 'account'));

-- ── 버그 2 fix ─────────────────────────────────────────────
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant execute on functions to service_role;
