-- 20260519000003_market_credentials.sql
-- 출처: credential-vault.md §3 (DDL), §4.3 (RPC), §10 (audit), markets.md §2.5 (oauth_state)
-- 목적: 마켓 OAuth 토큰 보관·복호화 RPC·감사 로그. service_role only 전 경로.
-- 보안 등급: ★★★★★ (CV-T1 ~ CV-T7 1차 통제).

----------------------------------------------------------------------
-- 1. market_credentials (credential-vault.md §3.1)
--    pgcrypto envelope 암호화. 마스터 키는 Edge Function env (`MASTER_KEY_<KID>`).
----------------------------------------------------------------------
create table public.market_credentials (
  id                       uuid primary key default gen_random_uuid(),
  seller_id                uuid not null references auth.users(id) on delete cascade,
  market_id                text not null,
  market_account_label     text not null,
  encrypted_access_token   bytea not null,
  encrypted_refresh_token  bytea not null,
  token_expires_at         timestamptz not null,
  ciphertext_kid           text not null,
  scope                    text[] not null default '{}',
  status                   text not null default 'active'
                           check (status in ('active','revoked','refresh_failed','expired')),
  last_refresh_at          timestamptz,
  last_refresh_error       text,                  -- 마스킹된 오류 코드만. raw token/PII 금지.
  refresh_failure_count    integer not null default 0,
  created_at               timestamptz not null default now(),
  rotated_at               timestamptz not null default now(),
  revoked_at               timestamptz,

  constraint market_credentials_unique_seller_market_account
    unique (seller_id, market_id, market_account_label)
);

create index market_credentials_seller_id_idx        on public.market_credentials (seller_id);
create index market_credentials_market_id_idx        on public.market_credentials (market_id);
create index market_credentials_token_expires_at_idx on public.market_credentials (token_expires_at)
  where status = 'active';
create index market_credentials_status_idx           on public.market_credentials (status);

comment on table  public.market_credentials is
  'service_role only. RLS ENABLED with NO POLICIES. 컬럼 암호화 = pgcrypto. 마스터 키는 Edge Function env.';
comment on column public.market_credentials.ciphertext_kid is
  '암호화 시점 마스터 키 식별자. 키 회전 시 신·구 키 양립을 위한 라우팅 키 (credential-vault.md §5).';
comment on column public.market_credentials.last_refresh_error is
  '마스킹된 오류 코드만 허용. raw token / API 응답 body 저장 금지.';

----------------------------------------------------------------------
-- 2. market_credentials RLS — 정책 0개 (credential-vault.md §3.2)
----------------------------------------------------------------------
alter table public.market_credentials enable row level security;
alter table public.market_credentials force row level security;
-- 정책 부재 = anon/authenticated 거부. service_role 만 RLS bypass.

----------------------------------------------------------------------
-- 3. oauth_state — 1회성 state 검증 (markets.md §2.5)
----------------------------------------------------------------------
create table public.oauth_state (
  state           text primary key,
  seller_id       uuid not null references auth.users(id) on delete cascade,
  market_id       text not null,
  redirect_to     text,                                -- 콜백 후 복귀 경로 (화이트리스트 검증 후만)
  pkce_verifier   text,                                -- Phase 2 PKCE 지원 시
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,                -- 발급 후 10분
  consumed_at     timestamptz                          -- 1회 사용 후 즉시 채움
);

create index oauth_state_seller_id_idx  on public.oauth_state (seller_id);
create index oauth_state_expires_at_idx on public.oauth_state (expires_at);

comment on table public.oauth_state is
  'OAuth state 1회성 토큰. service_role only. expires_at < now() 또는 consumed_at IS NOT NULL row 는 cron 으로 삭제 (markets.md §2.5).';

alter table public.oauth_state enable row level security;
alter table public.oauth_state force row level security;
-- 정책 0개 = service_role only.

----------------------------------------------------------------------
-- 4. market_credentials_audit (credential-vault.md §10.1) + append-only trigger
--    market_account_audit (markets.md §2.4) 가 본 함수를 재사용하므로 여기서 정의.
----------------------------------------------------------------------
create or replace function public.fn_block_credential_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'credential audit tables are append-only. UPDATE/DELETE blocked.';
end;
$$;

create table public.market_credentials_audit (
  id              bigserial primary key,
  credential_id   uuid references public.market_credentials(id) on delete set null,
  seller_id       uuid not null,
  market_id       text,
  event           text not null
                  check (event in (
                    'encrypt_store',
                    'decrypt',
                    'refresh_failed',
                    'revoke',
                    'rekey',
                    'recovery_verified'
                  )),
  kid_used        text,
  actor           text not null
                  check (actor in ('service_role','system_cron','incident_response')),
  correlation_id  text,
  error_code      text,
  occurred_at     timestamptz not null default now()
);

create index market_credentials_audit_credential_id_idx on public.market_credentials_audit (credential_id);
create index market_credentials_audit_seller_id_idx    on public.market_credentials_audit (seller_id);
create index market_credentials_audit_occurred_at_idx  on public.market_credentials_audit (occurred_at desc);
create index market_credentials_audit_event_idx        on public.market_credentials_audit (event);

alter table public.market_credentials_audit enable row level security;
alter table public.market_credentials_audit force row level security;
-- 정책 0개 = service_role only.

create trigger market_credentials_audit_no_update
  before update on public.market_credentials_audit
  for each row execute function public.fn_block_credential_audit_mutation();

create trigger market_credentials_audit_no_delete
  before delete on public.market_credentials_audit
  for each row execute function public.fn_block_credential_audit_mutation();

comment on table public.market_credentials_audit is
  'service_role only. append-only. 자격증명 토큰 자체 이벤트 (encrypt/decrypt/rekey/revoke).';

----------------------------------------------------------------------
-- 5. RPC: 암호화 저장 / 복호화 (credential-vault.md §4.3)
--    모두 SECURITY DEFINER + auth.role()='service_role' 가드.
----------------------------------------------------------------------
create or replace function public.fn_encrypt_and_store_credential(
  p_seller_id          uuid,
  p_market_id          text,
  p_account_label      text,
  p_access_token       text,
  p_refresh_token      text,
  p_expires_at         timestamptz,
  p_scope              text[],
  p_master_key         text,
  p_kid                text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'fn_encrypt_and_store_credential: service_role required';
  end if;

  insert into public.market_credentials (
    seller_id, market_id, market_account_label,
    encrypted_access_token, encrypted_refresh_token,
    token_expires_at, ciphertext_kid, scope
  ) values (
    p_seller_id, p_market_id, p_account_label,
    pgp_sym_encrypt(p_access_token,  p_master_key),
    pgp_sym_encrypt(p_refresh_token, p_master_key),
    p_expires_at, p_kid, p_scope
  )
  on conflict (seller_id, market_id, market_account_label)
  do update set
    encrypted_access_token  = excluded.encrypted_access_token,
    encrypted_refresh_token = excluded.encrypted_refresh_token,
    token_expires_at        = excluded.token_expires_at,
    ciphertext_kid          = excluded.ciphertext_kid,
    scope                   = excluded.scope,
    status                  = 'active',
    last_refresh_at         = now(),
    last_refresh_error      = null,
    refresh_failure_count   = 0,
    rotated_at              = now()
  returning id into v_id;

  insert into public.market_credentials_audit (credential_id, seller_id, market_id, event, kid_used, actor)
  values (v_id, p_seller_id, p_market_id, 'encrypt_store', p_kid, 'service_role');

  return v_id;
end;
$$;

revoke all on function public.fn_encrypt_and_store_credential(uuid, text, text, text, text, timestamptz, text[], text, text)
  from public, anon, authenticated;
grant  execute on function public.fn_encrypt_and_store_credential(uuid, text, text, text, text, timestamptz, text[], text, text)
  to service_role;

-- 복호화 RPC (credential-vault.md §4.2 / §4.3 동일 패턴)
create or replace function public.fn_decrypt_credential(
  p_credential_id  uuid,
  p_master_key     text,
  p_correlation_id text default null
) returns table (
  access_token     text,
  refresh_token    text,
  expires_at       timestamptz,
  market_id        text,
  seller_id        uuid,
  kid              text
)
language plpgsql
security definer
set search_path = public
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

  insert into public.market_credentials_audit (credential_id, seller_id, market_id, event, kid_used, actor, correlation_id)
  values (v_row.id, v_row.seller_id, v_row.market_id, 'decrypt', v_row.ciphertext_kid, 'service_role', p_correlation_id);

  return query
  select
    pgp_sym_decrypt(v_row.encrypted_access_token,  p_master_key)::text as access_token,
    pgp_sym_decrypt(v_row.encrypted_refresh_token, p_master_key)::text as refresh_token,
    v_row.token_expires_at as expires_at,
    v_row.market_id,
    v_row.seller_id,
    v_row.ciphertext_kid as kid;
end;
$$;

revoke all on function public.fn_decrypt_credential(uuid, text, text)
  from public, anon, authenticated;
grant  execute on function public.fn_decrypt_credential(uuid, text, text)
  to service_role;
