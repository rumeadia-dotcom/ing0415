-- infra/mcp-hosting/sql/real/01_role_and_deny.sql
-- 설계 ground truth: docs/architecture/v1/cross-cutting/mcp-hosting.md §5.1
--
-- 대상 프로젝트: real (lfrnythcujxdhehvkmtg) **전용**. dev 에는 적용하지 않는다 (dev 는 ../dev/).
-- 적용 방식: CI/CD apply_db_migrations 게이트와 무관하게 운영자가 **수동 1회 적용**.
--            (개발 인프라 — 제품 마이그레이션 시퀀스 apps/api/supabase/migrations 에 넣지 않음.
--             ci-cd.md §7 drift 정책과 분리. mcp-hosting.md §5 머리말)
--
-- 목적: MCP 전용 제한 role `mcp_ro_real` 을 deny-by-default 로 생성.
--   - public 스키마 USAGE 자체 회수 → 그 안의 어떤 테이블/뷰/함수(decrypt RPC 포함)에도 도달 불가.
--   - read-only 이중 강제 (role default_transaction_read_only=on + MCP --access-mode=restricted).
--   - nobypassrls 로 RLS 우회 차단. PAT/service_role 키는 인스턴스에 존재하지 않음.
--
-- 이 파일(01) 적용 후 02_mcp_ro_views.sql 을 적용한다 (스키마/뷰 생성 + select grant).

begin;

----------------------------------------------------------------------
-- 1. MCP 전용 제한 role (real)
--    강한 패스워드(≥32B random)는 컨테이너 env(/etc/mcp-hosting/env)에만 보관 (git 미관리).
--    아래는 플레이스홀더 — 적용 직전 실제 값으로 치환하거나, role 생성 후
--    `alter role mcp_ro_real password '<new>'` 로 설정한다.
----------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mcp_ro_real') then
    create role mcp_ro_real with
      login
      password '<<<REPLACE_WITH_32B_RANDOM>>>'
      nosuperuser nocreatedb nocreaterole noinherit nobypassrls
      connection limit 4;
  end if;
end
$$;

-- read-only 강제 (이중 안전망: MCP --access-mode=restricted 와 별개).
-- ALTER ROLE ... SET 은 Supavisor 세션 풀러 경유라도 백엔드 세션 시작 시 적용 → MCP 우회 불가.
alter role mcp_ro_real set default_transaction_read_only      = on;
alter role mcp_ro_real set statement_timeout                  = '15s';   -- 폭주 쿼리 차단
alter role mcp_ro_real set idle_in_transaction_session_timeout = '30s';
alter role mcp_ro_real set lock_timeout                       = '3s';
alter role mcp_ro_real set search_path                        = mcp_ro;  -- 기본 경로를 뷰 스키마로

----------------------------------------------------------------------
-- 2. public 스키마 전면 차단 (base table·자격증명·함수 호출 원천 봉쇄)
--    public 스키마 USAGE 자체를 회수 → 그 안의 어떤 테이블/함수도 도달 불가.
--    핵심: revoke usage on schema public 가 결정적. 스키마 USAGE 가 없으면
--    mcp_ro_real 은 public 의 어떤 테이블/뷰/함수에도 도달할 수 없다
--    (fn_decrypt_credential 같은 SECURITY DEFINER RPC 도 호출 불가).
----------------------------------------------------------------------
revoke all on schema public                       from mcp_ro_real;
revoke all on all tables    in schema public      from mcp_ro_real;   -- 멱등 방어
revoke all on all functions in schema public      from mcp_ro_real;   -- decrypt RPC 등 호출 봉쇄
revoke all on all sequences in schema public      from mcp_ro_real;

-- auth / storage / vault / extensions 등 타 스키마는 **명시 미부여 = 접근 불가** (기본값 유지).
-- (Postgres 기본: 신규 role 은 소유하지 않은 스키마 객체에 권한 없음.)
-- 이 스키마들은 postgres 가 owner 가 아니라 명시 revoke 시 에러 → 의도적으로 GRANT 만 안 한다.

commit;

-- 적용 검증 (수동, 별도 실행):
--   set role mcp_ro_real;
--   select * from public.market_credentials limit 1;   -- → ERROR: permission denied for schema public
--   select fn_decrypt_credential('...');                -- → ERROR: permission denied for schema public
--   reset role;
