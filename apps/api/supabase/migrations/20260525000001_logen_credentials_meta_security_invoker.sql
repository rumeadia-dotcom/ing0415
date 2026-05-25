-- =====================================================================
-- logen_credentials_meta — SECURITY DEFINER 경고 해소 (security_invoker=on)
--
-- 마스터:
--   - apps/api/supabase/migrations/20260521000003_logen_credentials.sql (원본)
--   - docs/architecture/v1/cross-cutting/credential-vault.md (vault 패턴)
--   - Supabase Database Linter — `security_definer_view` 경고
--
-- 배경:
--   원본 마이그(20260521000003)에서 logen_credentials_meta view 가
--   `security_invoker = off` (= SECURITY DEFINER) 로 정의됨. 이유는
--   logen_credentials raw 테이블에 authenticated 가 SELECT 권한 0 인데
--   view 만 본인 row meta 를 노출하기 위함이었음.
--   그러나 Supabase Linter 가 `security_definer_view` 로 경고하므로
--   `security_invoker = on` 으로 전환하고 본 동등 동작을 다른 방식으로 구현.
--
-- 동등 동작을 유지하면서 invoker 모드로 전환하는 4 단계 변경:
--
-- 1) `connected` boolean 컬럼 신설 + 트리거로 자동 채움
--    (view 에서 user_id_enc / cust_cd_enc IS NOT NULL 식을 쓰지 않도록.
--     encrypted bytea 에 대한 SELECT 권한 불요.)
--
-- 2) authenticated 에 안전 컬럼만 SELECT GRANT (encrypted bytea 제외).
--    user_id_enc / cust_cd_enc 는 service_role 전용 유지.
--
-- 3) SELECT RLS 정책: `seller_id = auth.uid()` — 본인 row 만.
--
-- 4) view 를 `security_invoker = on` 으로 재정의. WHERE 절도 redundancy
--    위해 유지 (RLS + WHERE 양쪽 가드).
-- =====================================================================

-- 1. connected boolean 컬럼 + 자동 채움 트리거
alter table public.logen_credentials
  add column if not exists connected boolean not null default false;

create or replace function public.fn_logen_credentials_set_connected()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.connected := (new.user_id_enc is not null and new.cust_cd_enc is not null);
  return new;
end;
$$;

comment on function public.fn_logen_credentials_set_connected() is
  'logen_credentials 의 connected 컬럼을 user_id_enc / cust_cd_enc 존재 여부로 자동 갱신. '
  'view 에서 encrypted 컬럼 IS NOT NULL 식을 쓰지 않도록.';

drop trigger if exists tg_logen_credentials_set_connected
  on public.logen_credentials;

create trigger tg_logen_credentials_set_connected
  before insert or update on public.logen_credentials
  for each row
  execute function public.fn_logen_credentials_set_connected();

-- 기존 row 백필
update public.logen_credentials
set connected = (user_id_enc is not null and cust_cd_enc is not null)
where connected is distinct from (user_id_enc is not null and cust_cd_enc is not null);

-- 2. authenticated 에 안전 컬럼만 SELECT GRANT
--    (encrypted bytea 와 nonce 는 service_role 전용 유지)
grant select (
  id,
  seller_id,
  sender_name,
  sender_address,
  sender_phone,
  fare_ty,
  dlv_fare,
  connected,
  ciphertext_kid,
  created_at,
  updated_at
) on public.logen_credentials to authenticated;

-- 3. SELECT RLS 정책 — 본인 row 만
drop policy if exists "logen_credentials select own"
  on public.logen_credentials;

create policy "logen_credentials select own"
  on public.logen_credentials
  for select
  to authenticated
  using (seller_id = auth.uid());

-- 4. view 재정의 — security_invoker = on
--    underlying RLS + column GRANT 로 본인 row + 안전 컬럼만 접근 가능.
--    WHERE 절은 RLS 와 redundant 하지만 명시적 가드로 유지.
drop view if exists public.logen_credentials_meta;

create view public.logen_credentials_meta
with (security_invoker = on)
as
select
  id,
  seller_id,
  sender_name,
  sender_address,
  sender_phone,
  fare_ty,
  dlv_fare,
  connected,
  ciphertext_kid,
  created_at,
  updated_at
from public.logen_credentials
where seller_id = auth.uid();

comment on view public.logen_credentials_meta is
  'PRD-v2 §3: 셀러용 로젠 자격증명 메타. security_invoker=on (caller 권한) + '
  'underlying RLS + column GRANT + WHERE 절 가드. encrypted 컬럼 (user_id_enc / cust_cd_enc) '
  '은 service_role 만 SELECT 가능 (column GRANT 제외).';

grant select on public.logen_credentials_meta to authenticated, service_role;
