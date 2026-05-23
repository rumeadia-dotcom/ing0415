-- 20260523000001_service_role_grants.sql
-- 출처: 운영 환경에서 markets-connect 가 'permission denied for table market_accounts'
--       (pgCode=42501) 로 fail. service_role 키로 접근하는데 service_role 데이터베이스
--       롤이 public 테이블에 SELECT/INSERT/UPDATE/DELETE 권한 없는 상태였음.
--
-- 배경:
--   - 기존 20260520000003_grants.sql 는 authenticated 롤에만 GRANT.
--   - 그 마이그레이션 코멘트에 "service_role 은 이미 superuser 수준 권한" 가정이
--     있었으나, Supabase Hosted 의 실제 service_role 은 superuser 가 아니며 새 테이블에
--     대해 자동 GRANT 가 보장되지 않는다 (특히 default privileges 미적용 상태에서 생성된 테이블).
--
-- 정책 정합:
--   - service_role: Edge Function 의 getServiceClient() 가 사용하는 키. RLS bypass + 모든 public DML.
--   - authenticated: 셀러 직접 DML (기존 grants.sql 유지).
--   - anon: 사용 안 함.
--   - 자격증명 원본 (market_credentials / oauth_state / market_credentials_audit) 도 service_role 전용 — 본 마이그레이션이 그 그랜트도 포함.

-- ── 모든 기존 public 테이블에 service_role GRANT ──────────────────────────────
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ── 향후 신규 테이블에도 자동 적용 (default privileges) ───────────────────────
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
