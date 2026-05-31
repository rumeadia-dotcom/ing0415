-- 20260601000003_cron_category_prewarm.sql
-- 출처: docs/superpowers/specs/2026-05-31-category-recommendation-design.md §4 / plan Task 10
-- 목적: markets-category-index-build Edge 를 일 1회(03:00) 트리거해 4개 마켓
--       (coupang/11st/gmarket/auction — naver 제외) 카테고리 인덱스를 미리 데운다.
--       ESM(콜 多)도 셀러 대기 0 으로 흡수: cron pre-warm + 검색 Edge building 폴백.
--
-- 의존:
--   - 20260601000001_market_category_index.sql (인덱스/meta 테이블).
--   - pg_cron / pg_net (20260519000001_extensions.sql + 20260521000010 에서 활성 가정).
--   - vault.decrypted_secrets 의 'supabase_functions_url' / 'service_role_key'
--     (orders-sync cron 과 동일 secret 재사용 — 운영자 사전 등록).
--
-- 강제 (20260521000010_pg_cron_orders_sync.sql 패턴 동일):
--   - URL / service_role 키는 vault 에서만. cron 정의에 평문 금지.
--   - 동명 jobname 존재 시 unschedule → re-schedule (멱등).
--   - vault 미등록(CI/dev) 환경에서도 schedule 등록은 진행(실행만 runtime fail).
--   - build Edge 가 marketAccountId 없이 호출되면 해당 마켓 active account 1개 자동 선택.
--     account 0개 마켓은 build Edge 가 skip(11번가는 키 불필요라 빌드).

------------------------------------------------------------------------
-- 1. extension 활성 (idempotent)
------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

------------------------------------------------------------------------
-- 2. vault secret 존재성 검사 (drift detect — graceful)
------------------------------------------------------------------------
do $$
declare
  v_functions_url text;
  v_service_key   text;
begin
  select decrypted_secret into v_functions_url
    from vault.decrypted_secrets where name = 'supabase_functions_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_functions_url is null or v_service_key is null then
    raise notice '[pg_cron category-prewarm] vault secret 미등록 (functions_url=% / service_key=%). CI/dev 환경 가정 — schedule 등록은 진행하나 cron 실행은 runtime 시점에 fail. 운영자는 dashboard 의 Vault 에서 사전 등록 필요.',
      (v_functions_url is not null), (v_service_key is not null);
  end if;
end;
$$;

------------------------------------------------------------------------
-- 3. 기존 동명 cron 잡 제거 (멱등 보장)
------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'category-prewarm-daily') then
    perform cron.unschedule('category-prewarm-daily');
  end if;
end;
$$;

------------------------------------------------------------------------
-- 4. cron 등록 — 매일 03:00 (KST 무관 — 서버 UTC. 저트래픽 시간대).
--    unnest 로 4개 마켓 각각 net.http_post(비동기). build Edge 가 active account
--    자동 선택 + 인덱스 재적재(building→ready). 실패는 cron.job_run_details 기록.
------------------------------------------------------------------------
select
  cron.schedule(
    'category-prewarm-daily',
    '0 3 * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_functions_url') || '/markets-category-index-build',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'x-correlation-id', 'cron-category-prewarm-' || m || '-' || gen_random_uuid()::text
        ),
        body := jsonb_build_object('marketId', m),
        timeout_milliseconds := 120000
      )
      from unnest(array['coupang', '11st', 'gmarket', 'auction']) as m;
    $cron$
  );

------------------------------------------------------------------------
-- 5. 운영자 메모
------------------------------------------------------------------------
-- 모니터링:
--   select * from cron.job where jobname = 'category-prewarm-daily';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'category-prewarm-daily')
--     order by start_time desc limit 20;
--   select market_id, status, node_count, built_at, error from public.market_category_index_meta;
--
-- 일시 정지: select cron.unschedule('category-prewarm-daily');
--
-- 수동 1회 트리거(특정 마켓):
--   curl -X POST "$FUNCTIONS_URL/markets-category-index-build" \
--        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
--        -H "Content-Type: application/json" \
--        -d '{"marketId":"coupang"}'
