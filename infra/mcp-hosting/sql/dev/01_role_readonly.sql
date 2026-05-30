-- infra/mcp-hosting/sql/dev/01_role_readonly.sql
-- 설계 ground truth: docs/architecture/v1/cross-cutting/mcp-hosting.md §5.4
--
-- 대상 프로젝트: dev (eqoywqoalwkwbrdsulfl) **전용**. real 에는 적용하지 않는다 (real 은 ../real/).
-- 적용 방식: 운영자 수동 1회 (제품 마이그레이션 시퀀스와 분리).
--
-- 목적: dev sandbox 용 완화 role `mcp_ro_dev`.
--   - dev 는 PII 가 없는 sandbox → public 전체 read 허용.
--   - 단 자격증명 테이블/decrypt 함수는 차단 (습관·토큰 유출 시 피해 최소화 / real 운영 일관성).
--   - read-only 강제 (default_transaction_read_only=on + MCP --access-mode=restricted 이중).
--
-- dev 는 별도 뷰 스키마(mcp_ro)를 만들지 않는다 — public 직접 read 로 충분 (sandbox).

begin;

----------------------------------------------------------------------
-- 1. MCP 전용 role (dev, 완화)
--    패스워드는 컨테이너 env(/etc/mcp-hosting/env)에만 보관. 아래는 플레이스홀더.
----------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mcp_ro_dev') then
    create role mcp_ro_dev with
      login
      password '<<<REPLACE_WITH_32B_RANDOM>>>'
      nosuperuser nocreatedb nocreaterole
      connection limit 4;
  end if;
end
$$;

alter role mcp_ro_dev set default_transaction_read_only       = on;
alter role mcp_ro_dev set statement_timeout                   = '15s';
alter role mcp_ro_dev set idle_in_transaction_session_timeout = '30s';
alter role mcp_ro_dev set lock_timeout                        = '3s';

----------------------------------------------------------------------
-- 2. public 전체 read (sandbox)
----------------------------------------------------------------------
grant usage  on schema public                  to mcp_ro_dev;
grant select on all tables in schema public    to mcp_ro_dev;
alter default privileges in schema public grant select on tables to mcp_ro_dev;

----------------------------------------------------------------------
-- 3. dev 라도 자격증명 테이블/함수는 차단
--    (습관 형성 + dev 토큰 유출 시 피해 최소화)
----------------------------------------------------------------------
revoke all on public.market_credentials,
              public.oauth_state,
              public.market_credentials_audit,
              public.logen_credentials
       from mcp_ro_dev;
revoke all on all functions in schema public from mcp_ro_dev;   -- decrypt RPC 봉쇄

commit;

-- 적용 검증 (수동):
--   set role mcp_ro_dev;
--   select count(*) from public.products;               -- OK (sandbox 전체 read)
--   select * from public.market_credentials limit 1;    -- ERROR: permission denied for table market_credentials
--   reset role;
