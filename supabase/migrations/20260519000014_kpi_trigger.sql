-- 20260519000014_kpi_trigger.sql
-- 출처:
--   docs/architecture/v1/ops/kpi.md §7.1 (DB 트리거 정의 — 등록 잡 terminal 전이)
--   docs/architecture/v1/cross-cutting/registration-job-state.md §4 (terminal 상태 정의)
-- 목적:
--   `registration_jobs.status` 가 succeeded / partial / failed 로 전이될 때
--   `events` 테이블에 `registration_completed` / `registration_partial` / `registration_failed`
--   를 db_trigger source 로 자동 적재. 클라이언트 누락 0 보장.
-- 비고:
--   - `cancelled` 는 kpi.md §2.1.1 의 event_type ENUM 에 포함되지 않음 → 본 트리거 대상 외.
--     이력 추적은 registration_jobs 자체 row 로 충분.
--   - kpi.md §7.1 의 함수명 `tg_fn_registration_jobs_kpi` byte-level 채택.
-- 보안 등급: ★★★ (RLS bypass 경로 — security definer + payload 화이트리스트).

create or replace function public.tg_fn_registration_jobs_kpi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration_ms bigint;
  v_event_type  public.event_type;
begin
  -- terminal 진입만 처리. 같은 status 재할당 무시 (chk: when 절에서 추가 가드).
  if new.status not in ('succeeded', 'partial', 'failed')
     or old.status = new.status then
    return new;
  end if;

  -- completed_at 은 chk_terminal_completed_at 제약으로 NOT NULL 보장.
  v_duration_ms := extract(epoch from (new.completed_at - new.created_at)) * 1000;

  v_event_type := case new.status
    when 'succeeded' then 'registration_completed'::public.event_type
    when 'partial'   then 'registration_partial'::public.event_type
    when 'failed'    then 'registration_failed'::public.event_type
  end;

  -- kpi.md §7.1 payload 화이트리스트:
  --   duration_ms / market_count / success_count / fail_count
  insert into public.events (seller_id, event_type, source, payload, job_id)
  values (
    new.seller_id,
    v_event_type,
    'db_trigger',
    jsonb_build_object(
      'duration_ms', v_duration_ms,
      'market_count', (
        select count(*) from public.registration_job_market_results r
        where r.job_id = new.id
      ),
      'success_count', (
        select count(*) from public.registration_job_market_results r
        where r.job_id = new.id and r.market_status = 'success'
      ),
      'fail_count', (
        select count(*) from public.registration_job_market_results r
        where r.job_id = new.id and r.market_status in ('failed', 'failed_final')
      )
    ),
    new.id
  );

  return new;
end;
$$;

comment on function public.tg_fn_registration_jobs_kpi() is
  'kpi.md §7.1: registration_jobs.status terminal 전이 시 events 자동 적재. db_trigger source. payload 는 화이트리스트만.';

-- when 절: status 변화만 트리거. 동일 status UPDATE 는 미발동 (성능 + 중복 적재 방지).
create trigger tg_registration_jobs_after_update_kpi
  after update on public.registration_jobs
  for each row
  when (old.status is distinct from new.status)
  execute function public.tg_fn_registration_jobs_kpi();

comment on trigger tg_registration_jobs_after_update_kpi on public.registration_jobs is
  'kpi.md §7.1: terminal 전이 자동 KPI 적재. db_trigger source. clientside 누락 0.';
