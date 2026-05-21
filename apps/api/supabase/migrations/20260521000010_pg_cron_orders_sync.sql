-- 20260521000010_pg_cron_orders_sync.sql
-- 출처: PRD.md §6.1, user_flow.md s8 n51
-- 목적: orders-sync Edge Function 을 10분 간격으로 트리거 (pg_cron + net.http_post).
--
-- 의존:
--   - 20260519000001_extensions.sql 에서 pg_cron / pg_net 활성 가정.
--     (Supabase Cloud 는 두 extension 모두 Settings → Database → Extensions 에서
--      별도 활성 필요. 본 마이그레이션은 idempotent 하게 create extension if not exists 시도.)
--   - vault.decrypted_secrets 의 'supabase_url' / 'service_role_key' 를 운영자가 사전 등록.
--     (cron 컨텍스트에서는 GUC env var 접근 불가 → vault 경유.)
--
-- 강제:
--   - Edge Function URL / service_role 키는 vault.decrypted_secrets 에서 읽는다.
--     pg_cron 잡 정의에 절대 평문 노출 금지.
--   - 이미 동일 jobname 으로 등록된 cron 이 있으면 unschedule → re-schedule (멱등).
--   - 본 마이그레이션이 미 적용된 환경에서도 Edge Function 자체는 수동 트리거 가능.

------------------------------------------------------------------------
-- 1. extension 활성 (idempotent)
------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

------------------------------------------------------------------------
-- 2. vault secret 존재성 검사 (없으면 마이그레이션 실패 — drift 방지)
--    운영자는 다음 secret 을 사전 등록해야 한다:
--      - supabase_functions_url   → 예: https://<ref>.supabase.co/functions/v1
--      - service_role_key         → 운영 service_role JWT
------------------------------------------------------------------------
do $$
declare
  v_functions_url text;
  v_service_key   text;
begin
  select decrypted_secret into v_functions_url
    from vault.decrypted_secrets where name = 'supabase_functions_url';
  if v_functions_url is null then
    raise exception '[pg_cron orders-sync] vault secret "supabase_functions_url" 미 등록. 운영자가 vault 에 사전 등록 필요.';
  end if;

  select decrypted_secret into v_service_key
    from vault.decrypted_secrets where name = 'service_role_key';
  if v_service_key is null then
    raise exception '[pg_cron orders-sync] vault secret "service_role_key" 미 등록.';
  end if;
end;
$$;

------------------------------------------------------------------------
-- 3. 기존 동명 cron 잡 제거 (멱등 보장)
------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'orders-sync-every-10min') then
    perform cron.unschedule('orders-sync-every-10min');
  end if;
end;
$$;

------------------------------------------------------------------------
-- 4. cron 등록 — 매 10분.
--    net.http_post 는 비동기 — orders-sync 응답이 길어도 cron 잡 자체는 즉시 종료.
--    실패 시 cron.job_run_details 에 기록 (운영자가 모니터링).
------------------------------------------------------------------------
select
  cron.schedule(
    'orders-sync-every-10min',
    '*/10 * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_functions_url') || '/orders-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'x-correlation-id', 'cron-orders-sync-' || gen_random_uuid()::text
        ),
        body := jsonb_build_object('source', 'cron'),
        timeout_milliseconds := 60000
      );
    $cron$
  );

comment on extension pg_cron is
  'orders-sync (10분), markets-token-refresh-cron, oauth_state cleanup 등 스케줄러.';

------------------------------------------------------------------------
-- 5. 운영자 메모
------------------------------------------------------------------------
-- 모니터링:
--   select * from cron.job where jobname = 'orders-sync-every-10min';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'orders-sync-every-10min')
--     order by start_time desc limit 20;
--
-- 일시 정지 (배포 윈도우 등):
--   select cron.unschedule('orders-sync-every-10min');
--
-- 수동 1회 트리거:
--   curl -X POST "$FUNCTIONS_URL/orders-sync" \
--        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
--        -H "Content-Type: application/json" \
--        -d '{"source":"manual"}'
