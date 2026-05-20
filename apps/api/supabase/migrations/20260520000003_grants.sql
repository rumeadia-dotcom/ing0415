-- 20260520000003_grants.sql
-- 출처: security.md §3 / features/markets.md / features/registration.md / features/dashboard.md
--
-- 문제: 뷰(security_invoker=on) 및 RPC(security invoker) 가 호출자 권한으로 하위 테이블을
--       접근하려 할 때 authenticated 롤에 GRANT 가 없어 'permission denied' 발생.
--
-- 정책:
--   - authenticated: 셀러가 직접 DML 하는 테이블 → SELECT/INSERT/UPDATE/DELETE 부여.
--                    RLS 가 row-level 필터링을 담당하므로 GRANT 는 넓게, 정책은 좁게.
--   - anon: 이 앱은 로그인 없이 접근하는 공개 데이터 없음 → 부여 없음.
--   - service_role: 이미 superuser 수준 권한. 자격증명 테이블은 service_role 전용 유지.
--
-- 자격증명 계열 테이블(market_credentials / oauth_state / market_credentials_audit)은
-- RLS 정책 0개(service_role 전용) 를 유지 — 여기서 GRANT 하지 않음.

-- ── 향후 생성될 테이블에 대한 default privileges ──────────────────────────────
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ── 기존 테이블 소급 적용 ───────────────────────────────────────────────────────

-- 셀러 프로필
grant select, update on public.sellers to authenticated;

-- 마켓 계정 (자격증명 원본 아님 — 상태·메타만)
grant select, insert, update, delete on public.market_accounts to authenticated;
grant select on public.market_account_audit to authenticated;

-- 상품
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_images to authenticated;
grant select, insert, update, delete on public.product_image_transforms to authenticated;
grant select, insert, update, delete on public.product_market_mappings to authenticated;

-- 등록 잡 (대시보드·이력·실시간 구독 모두 이 테이블 경유)
grant select, insert, update on public.registration_jobs to authenticated;
grant select, insert, update on public.registration_job_market_results to authenticated;

-- 배송 정책
grant select, insert, update, delete on public.shipping_policies to authenticated;

-- KPI / 이벤트 (쓰기는 Edge Function / pg_trigger 경유 — 읽기만 부여)
grant select, insert on public.events to authenticated;
grant select, insert on public.sessions to authenticated;
grant select, insert on public.nps_responses to authenticated;

-- 감사 로그 (읽기 전용 — 쓰기는 Edge Function / pg_trigger)
grant select on public.audit_log to authenticated;
