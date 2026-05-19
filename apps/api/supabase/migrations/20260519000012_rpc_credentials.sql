-- 20260519000012_rpc_credentials.sql
-- 출처:
--   docs/architecture/v1/cross-cutting/credential-vault.md §4.3 (RPC 시그니처 마스터),
--     §6.2 갱신 실패 처리, §10.1 audit event 'revoke'
-- 목적:
--   Wave 1 Edge Function 들이 호출하는 자격증명 보관소 RPC 중,
--   003 에 누락된 'revoke' 경로를 보강.
-- 비고:
--   fn_encrypt_and_store_credential / fn_decrypt_credential 은
--   20260519000003 에 credential-vault.md §4.3 byte-level 로 이미 정의됨 → 중복 정의 금지.
--   마스터 키는 GUC (current_setting) 가 아니라 RPC 인자 (p_master_key) 로 전달 = 마스터 출처 결정.
--   GUC 패턴 채택 시 backup 매체에 키 라우팅 정보가 노출될 위험·키 분리 보관 원칙 위배.
-- 보안 등급: ★★★★★ (CV-T5 / CV-T7 / 9.3 사고 대응 runbook).

create or replace function public.fn_revoke_credential(
  p_credential_id uuid,
  p_reason        text default null,           -- 마스킹된 사유 코드만. raw 응답 금지.
  p_actor         text default 'service_role'  -- 'service_role' | 'system_cron' | 'incident_response'
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.market_credentials;
begin
  -- credential-vault.md §4 동일 패턴: service_role 만 호출 가능.
  if auth.role() is distinct from 'service_role' then
    raise exception 'fn_revoke_credential: service_role required';
  end if;

  if p_actor not in ('service_role', 'system_cron', 'incident_response') then
    raise exception 'fn_revoke_credential: invalid actor %', p_actor;
  end if;

  -- 행 잠금 후 UPDATE — 동시 revoke / refresh 경쟁 차단.
  select * into v_row
    from public.market_credentials
    where id = p_credential_id
    for update;

  if v_row.id is null then
    raise exception 'fn_revoke_credential: credential_id not found';
  end if;

  if v_row.status = 'revoked' then
    -- 이미 revoke 상태면 멱등 종료. audit 만 한 번 더 남기지 않는다 (중복 노이즈).
    return;
  end if;

  update public.market_credentials
    set status     = 'revoked',
        revoked_at = now(),
        -- 마스킹된 사유만 (credential-vault.md §3.1 last_refresh_error 정책 동일).
        last_refresh_error = coalesce(p_reason, last_refresh_error)
    where id = p_credential_id;

  -- credential-vault.md §10.1 event = 'revoke'.
  insert into public.market_credentials_audit (
    credential_id, seller_id, market_id, event, kid_used, actor, error_code
  ) values (
    v_row.id, v_row.seller_id, v_row.market_id, 'revoke',
    v_row.ciphertext_kid, p_actor, p_reason
  );
end;
$$;

revoke all on function public.fn_revoke_credential(uuid, text, text)
  from public, anon, authenticated;
grant  execute on function public.fn_revoke_credential(uuid, text, text)
  to service_role;

comment on function public.fn_revoke_credential(uuid, text, text) is
  'credential-vault.md §6.2 / §9.3: 토큰 revoke + market_credentials_audit (event=revoke). service_role only. 마스킹된 사유만.';
