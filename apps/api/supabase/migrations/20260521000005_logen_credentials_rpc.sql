-- 20260521000005_logen_credentials_rpc.sql
-- 출처:
--   docs/spec/PRD.md §6.2 (registerOrderData 의 userId / custCd / sender* / fareTy / dlvFare 입력)
--   docs/architecture/v1/cross-cutting/credential-vault.md §4 (RPC + pgcrypto + master_key 인자 패턴)
-- 목적:
--   셀러가 본인 로젠 자격증명 + 발송인 기본값을 UPSERT 하는 RPC.
--   security definer + auth.uid() 본인 row 만 + pgp_sym_encrypt 로 평문 미저장.
-- 비고:
--   - 마스터 키는 GUC 가 아니라 RPC 인자(p_master_key) 로 전달 (credential-vault.md §4 동일 정책).
--     Edge Function 만 환경변수에서 읽어 인자로 전달. 셀러 클라이언트가 직접 호출하지 않음.
--   - GRANT 는 authenticated 에게도 부여하지만, 마스터 키 인자를 모르면 사실상 호출 불가
--     → 실질적 호출 주체는 logen-credentials Edge Function (service_role 또는 user JWT + master_key 알고 있는 함수).
--   - 그래도 추가 안전망으로 본 함수는 auth.uid() = p_seller_id (=current user) 만 통과.

create or replace function public.set_logen_credentials(
  p_user_id         text,
  p_cust_cd         text,
  p_sender_name     text,
  p_sender_address  text,
  p_sender_phone    text,
  p_fare_ty         text,
  p_dlv_fare        integer,
  p_master_key      text,
  p_kid             text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id        uuid;
  v_seller_id uuid;
begin
  v_seller_id := auth.uid();
  if v_seller_id is null then
    raise exception 'set_logen_credentials: authentication required';
  end if;

  if p_user_id is null or char_length(p_user_id) = 0 then
    raise exception 'set_logen_credentials: p_user_id required';
  end if;
  if p_cust_cd is null or char_length(p_cust_cd) = 0 then
    raise exception 'set_logen_credentials: p_cust_cd required';
  end if;
  if p_sender_name is null or char_length(p_sender_name) = 0 then
    raise exception 'set_logen_credentials: p_sender_name required';
  end if;
  if p_sender_address is null or char_length(p_sender_address) = 0 then
    raise exception 'set_logen_credentials: p_sender_address required';
  end if;
  if p_sender_phone is null or char_length(p_sender_phone) = 0 then
    raise exception 'set_logen_credentials: p_sender_phone required';
  end if;
  if p_fare_ty not in ('C','P','M') then
    raise exception 'set_logen_credentials: invalid fare_ty %', p_fare_ty;
  end if;
  if p_dlv_fare is null or p_dlv_fare < 0 then
    raise exception 'set_logen_credentials: invalid dlv_fare';
  end if;
  if p_master_key is null or char_length(p_master_key) = 0 then
    raise exception 'set_logen_credentials: p_master_key required';
  end if;

  insert into public.logen_credentials (
    seller_id, user_id_enc, cust_cd_enc,
    sender_name, sender_address, sender_phone,
    fare_ty, dlv_fare, ciphertext_kid
  ) values (
    v_seller_id,
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

revoke all on function public.set_logen_credentials(
  text, text, text, text, text, text, integer, text, text
) from public, anon;

grant execute on function public.set_logen_credentials(
  text, text, text, text, text, text, integer, text, text
) to authenticated, service_role;

comment on function public.set_logen_credentials(
  text, text, text, text, text, text, integer, text, text
) is
  'PRD-v2 §2.2 / §3: 셀러 본인의 로젠 자격증명 + 발송인 기본값 UPSERT. security definer + auth.uid() 본인 row 만 + '
  'pgp_sym_encrypt 로 userId/custCd 암호화. master_key 는 호출자(Edge Function)가 인자로 전달.';
