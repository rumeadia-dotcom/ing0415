-- 20260524000001_rpc_fn_prefix_fix.sql
-- 마스터: docs/architecture/v1/cross-cutting/credential-vault.md §4 (RPC + pgcrypto)
-- 발견: ing-backend audit (2026-05-24) — Edge Function 이 fn_ 접두사 RPC 를 호출하나
--      migrations 에 fn_ 접두사 정의 없음. 100% fail. 운영 사고 차단 hotfix.
--
-- 누락 RPC 3개:
--   1. fn_set_logen_credentials  — Edge Function (pgcrypto-logen.ts:95) 가 호출
--      - 기존 set_logen_credentials 는 auth.uid() 기반 (셀러 직호출용)
--      - 본 RPC 는 service_role 친화 — p_seller_id 명시 + p_correlation_id 로깅
--   2. fn_get_logen_credentials  — Edge Function (pgcrypto-logen.ts:176) 가 호출
--      - 기존 get_logen_credentials_status (status 만 반환) 와 별개
--      - 본 RPC 는 평문 복호화 반환 (user_id / cust_cd / sender_* / fare_ty / dlv_fare)
--   3. fn_increment_shipping_job_counters — Edge Function (shipping-dispatch-market-worker
--      /lib/result-update.ts:161) 가 호출. shipping_jobs.success_count / failed_count
--      증분. 정의 자체 누락.
--
-- 안전:
--   - 기존 set_logen_credentials / get_logen_credentials_status 는 유지 (셀러 직호출 경로)
--   - security definer + service_role only GRANT (Edge Function 만 호출 가능)
--   - p_master_key 인자는 Edge Function 의 resolveMasterKey() 에서 제공

----------------------------------------------------------------------
-- 1. fn_set_logen_credentials — 로젠 자격증명 저장 (service_role 친화)
----------------------------------------------------------------------
create or replace function public.fn_set_logen_credentials(
  p_seller_id       uuid,
  p_user_id         text,
  p_cust_cd         text,
  p_sender_name     text,
  p_sender_address  text,
  p_sender_phone    text,
  p_fare_ty         text,
  p_dlv_fare        integer,
  p_master_key      text,
  p_kid             text default null,
  p_correlation_id  text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_seller_id is null then
    raise exception 'fn_set_logen_credentials: p_seller_id required';
  end if;
  if p_user_id is null or char_length(p_user_id) = 0 then
    raise exception 'fn_set_logen_credentials: p_user_id required';
  end if;
  if p_cust_cd is null or char_length(p_cust_cd) = 0 then
    raise exception 'fn_set_logen_credentials: p_cust_cd required';
  end if;
  if p_master_key is null or char_length(p_master_key) = 0 then
    raise exception 'fn_set_logen_credentials: p_master_key required';
  end if;
  if p_fare_ty is null or p_fare_ty not in ('C','P','M') then
    raise exception 'fn_set_logen_credentials: invalid fare_ty %', p_fare_ty;
  end if;
  if p_dlv_fare is null or p_dlv_fare < 0 then
    raise exception 'fn_set_logen_credentials: invalid dlv_fare';
  end if;

  insert into public.logen_credentials (
    seller_id, user_id_enc, cust_cd_enc,
    sender_name, sender_address, sender_phone,
    fare_ty, dlv_fare, ciphertext_kid
  ) values (
    p_seller_id,
    pgp_sym_encrypt(p_user_id, p_master_key),
    pgp_sym_encrypt(p_cust_cd, p_master_key),
    p_sender_name, p_sender_address, p_sender_phone,
    p_fare_ty, p_dlv_fare, p_kid
  )
  on conflict (seller_id) do update set
    user_id_enc     = excluded.user_id_enc,
    cust_cd_enc     = excluded.cust_cd_enc,
    sender_name     = excluded.sender_name,
    sender_address  = excluded.sender_address,
    sender_phone    = excluded.sender_phone,
    fare_ty         = excluded.fare_ty,
    dlv_fare        = excluded.dlv_fare,
    ciphertext_kid  = coalesce(excluded.ciphertext_kid, public.logen_credentials.ciphertext_kid),
    updated_at      = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.fn_set_logen_credentials(
  uuid, text, text, text, text, text, text, integer, text, text, text
) from public;
grant execute on function public.fn_set_logen_credentials(
  uuid, text, text, text, text, text, text, integer, text, text, text
) to service_role;

comment on function public.fn_set_logen_credentials(
  uuid, text, text, text, text, text, text, integer, text, text, text
) is
  'Edge Function (service_role) 의 로젠 자격증명 저장 RPC. p_correlation_id 는 로깅용 (DB 무시).';

----------------------------------------------------------------------
-- 2. fn_get_logen_credentials — 로젠 자격증명 복호화 반환
----------------------------------------------------------------------
create or replace function public.fn_get_logen_credentials(
  p_seller_id       uuid,
  p_master_key      text,
  p_correlation_id  text default null
) returns table (
  user_id         text,
  cust_cd         text,
  sender_name     text,
  sender_address  text,
  sender_phone    text,
  fare_ty         text,
  dlv_fare        integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_seller_id is null then
    raise exception 'fn_get_logen_credentials: p_seller_id required';
  end if;
  if p_master_key is null or char_length(p_master_key) = 0 then
    raise exception 'fn_get_logen_credentials: p_master_key required';
  end if;

  return query
  select
    pgp_sym_decrypt(lc.user_id_enc, p_master_key) as user_id,
    pgp_sym_decrypt(lc.cust_cd_enc, p_master_key) as cust_cd,
    lc.sender_name,
    lc.sender_address,
    lc.sender_phone,
    lc.fare_ty,
    lc.dlv_fare
  from public.logen_credentials lc
  where lc.seller_id = p_seller_id;
end;
$$;

revoke all on function public.fn_get_logen_credentials(uuid, text, text) from public;
grant execute on function public.fn_get_logen_credentials(uuid, text, text) to service_role;

comment on function public.fn_get_logen_credentials(uuid, text, text) is
  'Edge Function (service_role) 의 로젠 자격증명 복호화 RPC. 응답에 평문 user_id/cust_cd 포함 — 호출측 (logen-register-shipment) 가 즉시 사용 후 메모리 폐기.';

----------------------------------------------------------------------
-- 3. fn_increment_shipping_job_counters — shipping_jobs 카운터 증분
----------------------------------------------------------------------
create or replace function public.fn_increment_shipping_job_counters(
  p_job_id        uuid,
  p_success_delta integer default 0,
  p_failed_delta  integer default 0
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_job_id is null then
    raise exception 'fn_increment_shipping_job_counters: p_job_id required';
  end if;
  if p_success_delta < 0 or p_failed_delta < 0 then
    raise exception 'fn_increment_shipping_job_counters: delta must be non-negative';
  end if;
  if p_success_delta = 0 and p_failed_delta = 0 then
    return;
  end if;

  update public.shipping_jobs
  set success_count = success_count + p_success_delta,
      failed_count  = failed_count  + p_failed_delta,
      updated_at    = now()
  where id = p_job_id;

  if not found then
    raise exception 'fn_increment_shipping_job_counters: job not found %', p_job_id;
  end if;
end;
$$;

revoke all on function public.fn_increment_shipping_job_counters(uuid, integer, integer) from public;
grant execute on function public.fn_increment_shipping_job_counters(uuid, integer, integer) to service_role;

comment on function public.fn_increment_shipping_job_counters(uuid, integer, integer) is
  'Edge Function (service_role) 의 shipping_jobs.success_count / failed_count atomic 증분.';
