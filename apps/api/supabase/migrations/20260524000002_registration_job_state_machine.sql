-- 20260524000002_registration_job_state_machine.sql
--
-- 출처:
--   docs/architecture/v1/cross-cutting/registration-job-state.md §4 (7×7 전이표),
--     §4.1 (합법 전이 트리거), §4.2 (불법 전이 예시), §10.2 (nextStatus 순수 함수 직역).
--
-- 결정 근거 (ing-qa audit 2026-05-24):
--   - registration_jobs.status UPDATE 가 Edge Function 3 군데에 분산:
--       registration-market-worker/lib/jmr-update.ts (pending→running, *→succeeded/partial/failed)
--       registration-retry/index.ts                  (partial|failed → retrying)
--     단일 진실 원장 없음 → 잘못된 전이(succeeded→running 역행 등) DB 레벨 차단 불가.
--   - rpc_recompute_job_status (20260519000013) 는 jmr 집계 → 종결 판정 RPC 로 본 전이 가드와
--     역할 분리. 본 fn 은 "이 전이가 합법인가" 만 책임 (싱글 source of truth).
--   - rpc_cancel_registration_job (20260519000006 §5) 은 security invoker (셀러 RLS 경유) 라
--     별도 유지. service_role 경로(workers, retry) 에서는 본 fn 으로 통일.
--
-- 보안 등급: ★★★★★
--   - SECURITY DEFINER + set search_path = public, pg_temp
--   - revoke all from public, anon, authenticated
--   - grant execute to service_role only (RLS 우회 경로 명시)
--   - 호출측이 seller_id 강제 검증 책임 (본 fn 은 jobId 만으로 동작)
--
-- 비기능 제약:
--   - 본 fn 은 status 컬럼 + 의존 타임스탬프(started_at / completed_at / cancelled_at / cancelled_by) 만 갱신.
--     retry_count 증분, error_summary 갱신 등 부수 컬럼은 호출측 책임.
--   - terminal (succeeded / cancelled) 진입 후 호출은 raise.
--   - 동일 상태로 재진입 (예: running → running) 도 raise (no-op 금지: 의도 없는 호출 식별).

----------------------------------------------------------------------
-- fn_registration_job_transition
----------------------------------------------------------------------
create or replace function public.fn_registration_job_transition(
  p_job_id    uuid,
  p_to_status text,
  p_actor     text default 'system'
)
returns public.registration_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current        public.registration_job_status;
  v_target         public.registration_job_status;
  v_allowed        boolean := false;
  v_row            public.registration_jobs;
  v_started_at     timestamptz;
  v_completed_at   timestamptz;
  v_cancelled_at   timestamptz;
  v_cancelled_by   uuid;
begin
  ------------------------------------------------------------------
  -- 0. 입력 검증
  ------------------------------------------------------------------
  if p_job_id is null then
    raise exception 'fn_registration_job_transition: p_job_id is null'
      using errcode = '22023';
  end if;

  -- p_to_status 가 ENUM 범위인지 — cast 실패 시 invalid_text_representation (22P02).
  begin
    v_target := p_to_status::public.registration_job_status;
  exception when others then
    raise exception 'fn_registration_job_transition: invalid status %', p_to_status
      using errcode = '22023';
  end;

  ------------------------------------------------------------------
  -- 1. 현재 상태 조회 (row lock)
  ------------------------------------------------------------------
  select status, started_at, completed_at, cancelled_at, cancelled_by
    into v_current, v_started_at, v_completed_at, v_cancelled_at, v_cancelled_by
    from public.registration_jobs
    where id = p_job_id
    for update;

  if v_current is null then
    raise exception 'fn_registration_job_transition: job % not found', p_job_id
      using errcode = 'P0002';
  end if;

  ------------------------------------------------------------------
  -- 2. 전이 합법성 (state.md §4 7×7 매트릭스)
  --
  --   pending   → running, cancelled
  --   running   → partial, succeeded, failed, retrying, cancelled
  --   partial   → retrying
  --   failed    → retrying
  --   retrying  → running, cancelled
  --   succeeded → ∅ (terminal)
  --   cancelled → ∅ (terminal)
  ------------------------------------------------------------------
  v_allowed := case
    when v_current = 'pending'  and v_target in ('running', 'cancelled') then true
    when v_current = 'running'  and v_target in ('partial', 'succeeded', 'failed', 'retrying', 'cancelled') then true
    when v_current = 'partial'  and v_target = 'retrying' then true
    when v_current = 'failed'   and v_target = 'retrying' then true
    when v_current = 'retrying' and v_target in ('running', 'cancelled') then true
    else false
  end;

  if not v_allowed then
    raise exception 'illegal_transition: % -> % (job=%)',
      v_current, v_target, p_job_id
      using errcode = 'P0001',
            hint    = 'see docs/architecture/v1/cross-cutting/registration-job-state.md §4';
  end if;

  ------------------------------------------------------------------
  -- 3. 타임스탬프 invariant 적용 (state.md §3.2 chk_*)
  --   - running / retrying : started_at 필수 (없으면 now() 채움)
  --   - succeeded / failed / partial / cancelled : completed_at 필수 (모두 now())
  --   - cancelled : cancelled_at / cancelled_by 필수
  ------------------------------------------------------------------
  if v_target in ('running', 'retrying') and v_started_at is null then
    v_started_at := now();
  end if;

  if v_target in ('succeeded', 'failed', 'partial', 'cancelled') then
    v_completed_at := now();
  end if;

  if v_target = 'cancelled' then
    v_cancelled_at := now();
    -- p_actor 가 uuid 면 cancelled_by 채움. 'system' 등 비-uuid 는 null 유지
    -- (chk_cancelled_fields 가 not null 요구 → 비-uuid actor 로 cancel 시도하면
    --  invoker 가 사전에 uuid 를 전달했어야 한다 → 거부).
    begin
      v_cancelled_by := p_actor::uuid;
    exception when others then
      raise exception 'fn_registration_job_transition: cancel requires uuid actor, got %', p_actor
        using errcode = '22023',
              hint    = 'pass the cancelling user uuid as p_actor';
    end;
  end if;

  ------------------------------------------------------------------
  -- 4. UPDATE (단일 row, 이중 가드: id + 현재 status 일치)
  ------------------------------------------------------------------
  update public.registration_jobs
    set status       = v_target,
        started_at   = v_started_at,
        completed_at = v_completed_at,
        cancelled_at = case when v_target = 'cancelled' then v_cancelled_at else cancelled_at end,
        cancelled_by = case when v_target = 'cancelled' then v_cancelled_by else cancelled_by end
    where id = p_job_id
      and status = v_current  -- race 가드 (이미 다른 트랜잭션이 전이시켰으면 0 row)
    returning * into v_row;

  if v_row.id is null then
    raise exception 'fn_registration_job_transition: race (job % already transitioned)',
      p_job_id
      using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

revoke all on function public.fn_registration_job_transition(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.fn_registration_job_transition(uuid, text, text)
  to service_role;

comment on function public.fn_registration_job_transition(uuid, text, text) is
  'registration-job-state.md §4 7×7 전이표 단일 source of truth. service_role only. '
  'Edge Function (registration-market-worker, registration-retry) 의 raw UPDATE 대체. '
  'status 컬럼 + 타임스탬프(started_at/completed_at/cancelled_*) 만 갱신. '
  'retry_count / error_summary 는 호출측 책임. '
  'cancel 전이는 p_actor 에 uuid 필수.';
