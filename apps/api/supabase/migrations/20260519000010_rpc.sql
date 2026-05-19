-- 20260519000010_rpc.sql
-- 출처:
--   features/dashboard.md §3.2 (rpc_get_dashboard_summary), §3.3 (rpc_get_recent_jobs)
--   features/history.md §3.2 (list_registration_jobs), §3.3 (get_registration_job)
-- 목적: 4개 RPC. 모두 security invoker (auth.uid() 컨텍스트 유지).
-- 본 Stage 는 시그니처 + 본문 정의. cancel RPC 는 20260519000006 에 위치.

----------------------------------------------------------------------
-- 1. rpc_get_dashboard_summary (dashboard.md §3.2)
----------------------------------------------------------------------
create or replace function public.rpc_get_dashboard_summary()
returns table (
  seller_id              uuid,
  jobs_today_count       int,
  jobs_in_progress_count int,
  jobs_24h_count         int,
  jobs_24h_succeeded     int,
  jobs_24h_partial       int,
  jobs_24h_failed        int,
  jobs_7d_count          int,
  jobs_7d_succeeded      int,
  jobs_7d_partial        int,
  jobs_7d_failed         int,
  jobs_30d_count         int,
  avg_duration_sec_7d    numeric,
  last_job_at            timestamptz
)
language sql
security invoker
stable
as $$
  select
    seller_id,
    jobs_today_count,
    jobs_in_progress_count,
    jobs_24h_count, jobs_24h_succeeded, jobs_24h_partial, jobs_24h_failed,
    jobs_7d_count,  jobs_7d_succeeded,  jobs_7d_partial,  jobs_7d_failed,
    jobs_30d_count,
    avg_duration_sec_7d,
    last_job_at
  from public.seller_dashboard_summary
  where seller_id = auth.uid();
$$;

comment on function public.rpc_get_dashboard_summary() is
  'security invoker. 셀러 본인의 요약 1 row. 0 건이면 빈 결과 (.maybeSingle()).';

grant execute on function public.rpc_get_dashboard_summary() to authenticated;

----------------------------------------------------------------------
-- 2. rpc_get_recent_jobs (dashboard.md §3.3)
----------------------------------------------------------------------
create or replace function public.rpc_get_recent_jobs(p_limit int default 20)
returns table (
  job_id              uuid,
  seller_id           uuid,
  product_id          uuid,
  job_status          public.registration_job_status,
  created_at          timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  retry_count         smallint,
  error_summary       text,
  parent_job_id       uuid,
  markets             jsonb,
  success_count       int,
  failed_count        int,
  market_total_count  int
)
language sql
security invoker
stable
as $$
  select
    job_id, seller_id, product_id, job_status,
    created_at, started_at, completed_at,
    retry_count, error_summary, parent_job_id,
    markets, success_count, failed_count, market_total_count
  from public.seller_recent_jobs
  where seller_id = auth.uid()
  order by created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

comment on function public.rpc_get_recent_jobs(int) is
  'security invoker. 셀러 본인의 최근 잡 (default 20, max 50). markets jsonb 는 마켓별 결과 배열.';

grant execute on function public.rpc_get_recent_jobs(int) to authenticated;

----------------------------------------------------------------------
-- 3. list_registration_jobs (history.md §3.2)
--    keyset cursor 페이지네이션 + 필터 + window count.
----------------------------------------------------------------------
create or replace function public.list_registration_jobs(
  p_from         timestamptz default null,
  p_to           timestamptz default null,
  p_markets      text[]      default null,
  p_statuses     public.registration_job_status[] default null,
  p_q            text        default null,
  p_limit        int         default 20,
  p_cursor       timestamptz default null,
  p_cursor_id    uuid        default null
)
returns table (
  id                   uuid,
  status               public.registration_job_status,
  created_at           timestamptz,
  started_at           timestamptz,
  completed_at         timestamptz,
  retry_count          smallint,
  error_summary        text,
  parent_job_id        uuid,
  product_id           uuid,
  product_name         text,
  product_thumbnail_id uuid,
  market_summary       jsonb,
  total_count          bigint
)
language sql
security invoker
stable
as $$
  with filtered as (
    select rj.id, rj.status, rj.created_at, rj.started_at, rj.completed_at,
           rj.retry_count, rj.error_summary, rj.parent_job_id,
           rj.product_id,
           p.name as product_name,
           p.thumbnail_image_id as product_thumbnail_id,
           (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'market_id', jmr.market_id,
                      'market_status', jmr.market_status,
                      'excluded', jmr.excluded
                    ) order by jmr.market_id), '[]'::jsonb)
             from public.registration_job_market_results jmr
             where jmr.job_id = rj.id
           ) as market_summary
    from public.registration_jobs rj
    join public.products p on p.id = rj.product_id
    where rj.seller_id = auth.uid()
      and (p_from is null or rj.created_at >= p_from)
      and (p_to   is null or rj.created_at <  p_to)
      and (p_statuses is null or rj.status = any(p_statuses))
      and (p_q is null or p.name ilike '%' || p_q || '%')
      and (
        p_markets is null
        or exists (
          select 1 from public.registration_job_market_results jmr
          where jmr.job_id = rj.id and jmr.market_id = any(p_markets)
        )
      )
      and (
        p_cursor is null
        or (rj.created_at, rj.id) < (p_cursor, coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid))
      )
    order by rj.created_at desc, rj.id desc
    limit least(coalesce(p_limit, 20), 50)
  ),
  counted as (
    select count(*) as total
    from public.registration_jobs rj
    join public.products p on p.id = rj.product_id
    where rj.seller_id = auth.uid()
      and (p_from is null or rj.created_at >= p_from)
      and (p_to   is null or rj.created_at <  p_to)
      and (p_statuses is null or rj.status = any(p_statuses))
      and (p_q is null or p.name ilike '%' || p_q || '%')
      and (
        p_markets is null
        or exists (
          select 1 from public.registration_job_market_results jmr
          where jmr.job_id = rj.id and jmr.market_id = any(p_markets)
        )
      )
  )
  select
    f.id, f.status, f.created_at, f.started_at, f.completed_at,
    f.retry_count, f.error_summary, f.parent_job_id,
    f.product_id, f.product_name, f.product_thumbnail_id, f.market_summary,
    (select total from counted) as total_count
  from filtered f;
$$;

comment on function public.list_registration_jobs(timestamptz, timestamptz, text[], public.registration_job_status[], text, int, timestamptz, uuid) is
  'security invoker. 셀러 본인의 등록 잡 목록. keyset cursor 페이지네이션. total_count 는 모든 행에 동일.';

grant execute on function public.list_registration_jobs(timestamptz, timestamptz, text[], public.registration_job_status[], text, int, timestamptz, uuid) to authenticated;

----------------------------------------------------------------------
-- 4. get_registration_job (history.md §3.3)
--    상세 페이로드. 권한 없는 id → null 반환.
----------------------------------------------------------------------
create or replace function public.get_registration_job(p_job_id uuid)
returns jsonb
language sql
security invoker
stable
as $$
  select jsonb_build_object(
    'job', to_jsonb(rj) - 'cancelled_by',
    'cancelledByMaskedId',
      case when rj.cancelled_by is not null
           then substring(rj.cancelled_by::text, 1, 8) || '…'
           else null end,
    'product', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'thumbnailImageId', p.thumbnail_image_id
    ),
    'parent',
      case when rj.parent_job_id is not null then
        (select jsonb_build_object('id', pj.id, 'status', pj.status, 'createdAt', pj.created_at)
         from public.registration_jobs pj where pj.id = rj.parent_job_id)
      else null end,
    'children', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', cj.id, 'status', cj.status, 'createdAt', cj.created_at
      ) order by cj.created_at desc), '[]'::jsonb)
      from public.registration_jobs cj
      where cj.parent_job_id = rj.id and cj.seller_id = auth.uid()
    ),
    'marketResults', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', jmr.id,
        'marketId', jmr.market_id,
        'marketStatus', jmr.market_status,
        'externalProductId', jmr.external_product_id,
        'productUrl', jmr.product_url,
        'errorCode', jmr.error_code,
        'errorMessage', jmr.error_message,
        'attemptCount', jmr.attempt_count,
        'lastAttemptedAt', jmr.last_attempted_at,
        'excluded', jmr.excluded,
        'updatedAt', jmr.updated_at
      ) order by jmr.market_id), '[]'::jsonb)
      from public.registration_job_market_results jmr
      where jmr.job_id = rj.id
    )
  )
  from public.registration_jobs rj
  join public.products p on p.id = rj.product_id
  where rj.id = p_job_id
    and rj.seller_id = auth.uid();
$$;

comment on function public.get_registration_job(uuid) is
  'security invoker. 권한 없는 id 또는 미존재 시 null 반환. cancelled_by raw uuid 미노출 (마스킹 8자).';

grant execute on function public.get_registration_job(uuid) to authenticated;
