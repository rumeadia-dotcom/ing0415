-- 20260530000002_drop_esm_shipping_profiles.sql
-- 출처:
--   docs/architecture/v1/features/esm.md "⚠ 전환 결정 (2026-05-30): 생성형 → 조회형" 절
--   (PR-E4 — 생성형 백엔드 제거 + DB drop). §3 (esm_shipping_profiles) 는 DEPRECATE.
-- 목적:
--   ESM 배송 선행값을 우리 앱이 "생성"하던 모델을 폐기하고, 셀러가 ESM Plus 에서 만든
--   출하지/발송정책을 "조회(GET) → select" 하는 조회형(PR-E1/E2)으로 단일화한다.
--   생성형 산출물인 esm_shipping_profiles 테이블 + RLS/grant/realtime 를 제거한다.
--
-- ⚠ 적용 주의 (PR 본문에도 명시):
--   - dev 에는 20260530000001_esm_shipping_profiles.sql 가 이미 적용돼 있다(WIP C1).
--   - 본 DROP 은 PR 머지 시점에 dev/real 에 자동 적용되지 않는다(위험 게이트).
--     머지 후 메인 세션이 `pnpm db:push:dev --include-all` 로 C1 이력 정합과 함께 적용한다.
--
-- 보안 (security 검수):
--   - 생성형 RLS(esm_shipping_profiles_select_own)는 본 DROP 으로 함께 사라진다.
--   - 조회형(PR-E1/E2)은 우리 DB 에 배송 참조를 저장하지 않으므로(호출측 24h 캐시),
--     테이블 제거가 조회형 경계(PII 미저장)와 모순되지 않는다. 오히려 잔존 테이블/정책이
--     없어져 RLS 표면이 줄어든다.

----------------------------------------------------------------------
-- 1. Realtime publication 에서 먼저 제거 (테이블 DROP 전, 방어적)
--    DROP TABLE CASCADE 가 publication membership 도 정리하지만, 명시적으로 먼저 빼서
--    publication 상태를 분명히 한다. 미존재 시 무해하도록 IF EXISTS 가드.
----------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'esm_shipping_profiles'
  ) then
    alter publication supabase_realtime drop table public.esm_shipping_profiles;
  end if;
end$$;

----------------------------------------------------------------------
-- 2. 테이블 DROP — CASCADE 로 RLS policy / trigger / index / grant 동반 제거
--    IF EXISTS: 마이그레이션 미적용 환경(fresh build)에서도 무해(no-op).
----------------------------------------------------------------------
drop table if exists public.esm_shipping_profiles cascade;

----------------------------------------------------------------------
-- 3. audit_log.category 의 'shipping' 은 유지한다 (제거하지 않음)
--    'shipping' 은 esm_shipping_profiles 전용이 아니다. shipping-dispatch-job /
--    esm-shipping-list / eleven-st-shipping-list Edge Function 이 여전히 'shipping'
--    카테고리로 audit 을 적재한다(_shared/audit.ts AuditCategory). 따라서 20260530000001
--    이 추가한 'shipping' constraint 값은 그대로 두고, 본 마이그레이션은 테이블만 제거한다.
----------------------------------------------------------------------
