-- 20260519000013_rpc_jobs.sql
-- 출처:
--   docs/architecture/v1/cross-cutting/registration-job-state.md §5 (decideTerminalStatus 판정),
--     §10.3 (TypeScript 순수 함수 직역) — DB 측 보조 판정 함수.
-- 목적:
--   오케스트레이터가 마켓별 결과(`registration_job_market_results`)를 모두 적재한 후
--   잡 상위 상태(`registration_jobs.status`)를 재계산하는 RPC.
--   클라이언트는 직접 호출하지 않고 Edge Function `registration-market-worker`
--   또는 `registration-start` 가 service_role 로 호출.
-- 비고:
--   rpc_cancel_registration_job 은 20260519000006 §5 에 이미 정의됨 → 중복 정의 금지.
-- 보안 등급: ★★★★ (RLS 우회 경로 — seller_id 강제 검증 필수).

create or replace function public.rpc_recompute_job_status(p_job_id uuid)
returns public.registration_job_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job             public.registration_jobs;
  v_total           int;
  v_excluded        int;
  v_active          int;
  v_success         int;
  v_failed_final    int;
  v_non_final       int;        -- pending / in_flight / failed (non-final)
  v_next_status     public.registration_job_status;
begin
  -- service_role 가드. RLS 우회 경로이므로 명시.
  if auth.role() is distinct from 'service_role' then
    raise exception 'rpc_recompute_job_status: service_role required';
  end if;

  -- ownership 가드는 호출측이 책임. 본 RPC 는 잡 ID 만으로 동작 (오케스트레이터 신뢰).
  select * into v_job
    from public.registration_jobs
    where id = p_job_id
    for update;

  if v_job.id is null then
    raise exception 'rpc_recompute_job_status: job % not found', p_job_id;
  end if;

  -- terminal 상태는 재계산 금지 (registration-job-state.md §4 전이표).
  if v_job.status in ('succeeded', 'failed', 'partial', 'cancelled') then
    return v_job.status;
  end if;

  -- registration-job-state.md §10.3 알고리즘 직역.
  select
    count(*)                                                              as total,
    count(*) filter (where excluded)                                       as excluded_cnt,
    count(*) filter (where not excluded)                                   as active_cnt,
    count(*) filter (where not excluded and market_status = 'success')     as success_cnt,
    count(*) filter (where not excluded and market_status = 'failed_final') as failed_final_cnt,
    count(*) filter (
      where not excluded and market_status in ('pending', 'in_flight', 'failed')
    ) as non_final_cnt
  into v_total, v_excluded, v_active, v_success, v_failed_final, v_non_final
  from public.registration_job_market_results
  where job_id = p_job_id;

  -- active 가 0 이면 호출 시점 오류 (모든 row 가 excluded). 호출측이 거부해야 함.
  if v_active = 0 then
    raise exception 'rpc_recompute_job_status: no active jmr rows (all excluded)';
  end if;

  -- 아직 미종결 row 존재 → 상태 유지 (판정 금지).
  if v_non_final > 0 then
    return v_job.status;
  end if;

  -- 종결 판정 (registration-job-state.md §5).
  if v_success = v_active then
    v_next_status := 'succeeded';
  elsif v_failed_final = v_active then
    v_next_status := 'failed';
  else
    v_next_status := 'partial';
  end if;

  -- 상태 + completed_at 동시 갱신.
  -- chk_terminal_completed_at: terminal 상태에는 completed_at 필수.
  update public.registration_jobs
    set status       = v_next_status,
        completed_at = now()
    where id = p_job_id
      and status not in ('succeeded', 'failed', 'partial', 'cancelled');

  return v_next_status;
end;
$$;

revoke all on function public.rpc_recompute_job_status(uuid)
  from public, anon, authenticated;
grant  execute on function public.rpc_recompute_job_status(uuid)
  to service_role;

comment on function public.rpc_recompute_job_status(uuid) is
  'registration-job-state.md §5 / §10.3: jmr 집계 → 7상태 매핑. service_role only. terminal 재계산 금지.';
