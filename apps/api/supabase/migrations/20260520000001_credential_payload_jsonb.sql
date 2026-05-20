-- 20260520000001_credential_payload_jsonb.sql
-- 5마켓 MVP 확장 (Wave 1):
--   market_credentials 를 OAuth 전용 (encrypted_access_token / encrypted_refresh_token)
--   에서 4-way AuthInput union (oauth / hmac / esm_jwt / api_key) 통합 jsonb 저장 구조로 전환.
--
-- 출처:
--   docs/architecture/v1/cross-cutting/credential-vault.md §3 (DDL 마스터, 본 마이그레이션으로 갱신)
--   src/lib/markets/types.ts / src/lib/schemas/market.ts 의 AuthInput 4-way discriminated union
--   OQ-04 결정: pgcrypto 1차 채택 (Supabase Vault 는 v2)
--
-- 호환성:
--   003 (market_credentials / market_credentials_audit / oauth_state) 스키마·RLS 유지.
--   003 의 UNIQUE (seller_id, market_id, market_account_label) 그대로 conflict 키로 사용.
--   003 의 audit 컬럼(seller_id / market_id / event / kid_used / actor / correlation_id / error_code)
--   그대로 사용 — audit 신규 컬럼 추가 없음.
--   012 의 fn_revoke_credential 시그니처 변경 없음 — 영향 없음.
--
-- 데이터 가정:
--   v1 초기 출시 전 적용. market_credentials 테이블 비어 있음.
--   비어 있지 않은 경우 OAuth 행을 credential_kind='oauth' + credential_payload jsonb 로
--   재암호화하는 backfill 스크립트가 별도 필요 (본 파일 범위 외).
--
-- 보안 등급: ★★★★★ (CV-T1 ~ CV-T7).

----------------------------------------------------------------------
-- 1. 신규 컬럼 추가 (nullable 로 먼저 추가 — 기존 행이 있으면 backfill 후 NOT NULL 적용)
----------------------------------------------------------------------
alter table public.market_credentials
  add column if not exists credential_kind text
    check (credential_kind in ('oauth','hmac','esm_jwt','api_key')),
  add column if not exists credential_payload bytea;

----------------------------------------------------------------------
-- 2. 기존 데이터 backfill — v1 초기 가정상 빈 테이블.
--    (만약 003 적용 후 OAuth credential 이 이미 들어가 있다면 본 블록 대신 backfill 스크립트
--     를 사전에 적용하고, 그 다음에 NOT NULL 제약을 활성화해야 한다.)
----------------------------------------------------------------------
-- 안전장치: 데이터가 남아 있으면 NOT NULL 전환을 막아 마이그레이션이 실패하도록 한다.
do $$
declare
  v_unmigrated_count bigint;
begin
  select count(*) into v_unmigrated_count
    from public.market_credentials
    where credential_kind is null or credential_payload is null;

  if v_unmigrated_count > 0 then
    raise exception
      'market_credentials backfill required: % row(s) lack credential_kind/credential_payload. '
      'Run OAuth backfill script before applying this migration.',
      v_unmigrated_count;
  end if;
end
$$;

----------------------------------------------------------------------
-- 3. NOT NULL 제약 적용
----------------------------------------------------------------------
alter table public.market_credentials
  alter column credential_kind set not null,
  alter column credential_payload set not null;

----------------------------------------------------------------------
-- 4. 기존 OAuth 전용 암호문 컬럼 제거
--    token_expires_at / scope / last_refresh_* / refresh_failure_count 는 유지
--    (OAuth refresh 트리거·갱신 실패 카운터·스코프 표기는 oauth kind 에서 계속 사용,
--     hmac / esm_jwt / api_key kind 에서는 NULL/0/{} 로 둠).
----------------------------------------------------------------------
alter table public.market_credentials
  drop column if exists encrypted_access_token,
  drop column if exists encrypted_refresh_token;

----------------------------------------------------------------------
-- 5. 코멘트 갱신
----------------------------------------------------------------------
comment on column public.market_credentials.credential_kind is
  'AuthInput discriminator. oauth | hmac | esm_jwt | api_key. 5마켓 MVP 확장 (Wave 1) 도입.';
comment on column public.market_credentials.credential_payload is
  'pgcrypto pgp_sym_encrypt 로 암호화된 jsonb (text 직렬화 후 암호화). '
  '4-way AuthInput payload 통합 저장. 평문 jsonb 절대 금지.';
comment on column public.market_credentials.token_expires_at is
  'OAuth refresh 트리거용. oauth kind 만 유효. hmac/esm_jwt/api_key kind 는 NULL 허용 (003 의 NOT NULL 은 후속 마이그레이션에서 완화).';

----------------------------------------------------------------------
-- 6. 003 의 RPC 시그니처 교체
--    003 의 fn_encrypt_and_store_credential (9 args, OAuth 전용) 를 DROP 한 뒤
--    jsonb 통합 시그니처로 재정의한다. 003 의 grant/revoke 가 구 시그니처에 묶여 있으므로
--    구 함수를 명시적으로 DROP 해야 grant 도 함께 사라진다.
----------------------------------------------------------------------
drop function if exists public.fn_encrypt_and_store_credential(
  uuid, text, text, text, text, timestamptz, text[], text, text
);

create or replace function public.fn_encrypt_and_store_credential(
  p_seller_id          uuid,
  p_market_id          text,
  p_account_label      text,
  p_credential_kind    text,                -- 'oauth' | 'hmac' | 'esm_jwt' | 'api_key'
  p_payload            jsonb,               -- AuthInput payload (마켓별 4-way union)
  p_token_expires_at   timestamptz,         -- oauth 만 의미 있음. 그 외 kind 에서는 NULL 허용
  p_scope              text[],              -- oauth 만 의미 있음. 그 외 kind 는 '{}'
  p_master_key         text,
  p_kid                text,
  p_correlation_id     text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  -- credential-vault.md §4: service_role only.
  if auth.role() is distinct from 'service_role' then
    raise exception 'fn_encrypt_and_store_credential: service_role required';
  end if;

  if p_credential_kind not in ('oauth','hmac','esm_jwt','api_key') then
    raise exception 'fn_encrypt_and_store_credential: invalid credential_kind %', p_credential_kind
      using errcode = '22023';
  end if;

  if p_payload is null then
    raise exception 'fn_encrypt_and_store_credential: payload is null';
  end if;

  -- oauth kind 는 token_expires_at 필수 (refresh 트리거 의존).
  if p_credential_kind = 'oauth' and p_token_expires_at is null then
    raise exception 'fn_encrypt_and_store_credential: oauth kind requires token_expires_at';
  end if;

  insert into public.market_credentials (
    seller_id, market_id, market_account_label,
    credential_kind, credential_payload,
    token_expires_at, ciphertext_kid, scope
  ) values (
    p_seller_id, p_market_id, p_account_label,
    p_credential_kind,
    pgp_sym_encrypt(p_payload::text, p_master_key),
    p_token_expires_at, p_kid, coalesce(p_scope, '{}')
  )
  on conflict (seller_id, market_id, market_account_label) do update set
    credential_kind        = excluded.credential_kind,
    credential_payload     = excluded.credential_payload,
    token_expires_at       = excluded.token_expires_at,
    ciphertext_kid         = excluded.ciphertext_kid,
    scope                  = excluded.scope,
    status                 = 'active',
    last_refresh_at        = now(),
    last_refresh_error     = null,
    refresh_failure_count  = 0,
    rotated_at             = now()
  returning id into v_id;

  -- 003 의 audit 스키마(seller_id / market_id / event / kid_used / actor / correlation_id) 그대로 사용.
  -- event = 'encrypt_store' (003 check 제약 범위 내) → encrypt 와 rotate 를 동일 이벤트로 통합.
  insert into public.market_credentials_audit (
    credential_id, seller_id, market_id, event, kid_used, actor, correlation_id
  ) values (
    v_id, p_seller_id, p_market_id, 'encrypt_store', p_kid, 'service_role', p_correlation_id
  );

  return v_id;
end;
$$;

revoke all on function public.fn_encrypt_and_store_credential(
  uuid, text, text, text, jsonb, timestamptz, text[], text, text, text
) from public, anon, authenticated;
grant  execute on function public.fn_encrypt_and_store_credential(
  uuid, text, text, text, jsonb, timestamptz, text[], text, text, text
) to service_role;

comment on function public.fn_encrypt_and_store_credential(
  uuid, text, text, text, jsonb, timestamptz, text[], text, text, text
) is
  'credential-vault.md §4.3 (Wave 1 갱신): 4-way AuthInput jsonb 통합 저장. service_role only. '
  'oauth/hmac/esm_jwt/api_key 모든 kind 의 payload 를 pgcrypto 로 암호화. '
  'audit event=encrypt_store (encrypt + rotate 통합).';

----------------------------------------------------------------------
-- 7. fn_decrypt_credential 시그니처 교체
--    003 의 (uuid, text, text) → (uuid, text, text) 유지하되 반환 컬럼을 jsonb payload 로 변경.
--    반환 컬럼 변경 = 시그니처 동일이라도 OR REPLACE 불가 (return type 변경) → 명시 DROP 필요.
----------------------------------------------------------------------
drop function if exists public.fn_decrypt_credential(uuid, text, text);

create or replace function public.fn_decrypt_credential(
  p_credential_id  uuid,
  p_master_key     text,
  p_correlation_id text default null
) returns table (
  credential_id      uuid,
  seller_id          uuid,
  market_id          text,
  credential_kind    text,
  payload            jsonb,
  token_expires_at   timestamptz,
  scope              text[],
  kid                text,
  status             text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.market_credentials;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'fn_decrypt_credential: service_role required';
  end if;

  select * into v_row from public.market_credentials where id = p_credential_id;
  if v_row.id is null then
    raise exception 'fn_decrypt_credential: credential_id not found';
  end if;

  -- audit: 003 schema event='decrypt'.
  insert into public.market_credentials_audit (
    credential_id, seller_id, market_id, event, kid_used, actor, correlation_id
  ) values (
    v_row.id, v_row.seller_id, v_row.market_id, 'decrypt',
    v_row.ciphertext_kid, 'service_role', p_correlation_id
  );

  return query
  select
    v_row.id                                                            as credential_id,
    v_row.seller_id                                                     as seller_id,
    v_row.market_id                                                     as market_id,
    v_row.credential_kind                                               as credential_kind,
    pgp_sym_decrypt(v_row.credential_payload, p_master_key)::jsonb      as payload,
    v_row.token_expires_at                                              as token_expires_at,
    v_row.scope                                                         as scope,
    v_row.ciphertext_kid                                                as kid,
    v_row.status                                                        as status;
end;
$$;

revoke all on function public.fn_decrypt_credential(uuid, text, text)
  from public, anon, authenticated;
grant  execute on function public.fn_decrypt_credential(uuid, text, text)
  to service_role;

comment on function public.fn_decrypt_credential(uuid, text, text) is
  'credential-vault.md §4.3 (Wave 1 갱신): credential_payload jsonb 복호화. service_role only. '
  'audit event=decrypt 항상 기록.';
