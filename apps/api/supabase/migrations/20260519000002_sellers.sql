-- 20260519000002_sellers.sql
-- 출처: features/auth.md §2.2 sellers DDL, §2.3 handle_new_seller 트리거, security.md §12 audit_log
-- 목적: s1 인증 도메인의 셀러 1:1 확장 + 통합 audit_log.

----------------------------------------------------------------------
-- 1. public.sellers : auth.users 1:1 확장 (features/auth.md §2.2)
----------------------------------------------------------------------
create table public.sellers (
  id                   uuid primary key references auth.users(id) on delete cascade,
  display_name         text not null check (char_length(display_name) between 1 and 60),
  business_type        text not null
                       check (business_type in ('individual','sole_proprietor','corporation','undecided'))
                       default 'undecided',
  marketing_consent    boolean not null default false,
  marketing_consent_at timestamptz,
  last_active_at       timestamptz not null default now(),
  signup_provider      text not null
                       check (signup_provider in ('email','google','kakao','naver'))
                       default 'email',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.sellers is
  's1 인증 도메인. auth.users 1:1 확장. PII (email/phone) 는 auth.users 에만 존재.';

-- updated_at 자동 갱신 (auth.md §2.2)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_sellers_touch
  before update on public.sellers
  for each row execute function public.touch_updated_at();

-- 변조 방지 트리거 (auth.md §2.2.2): id / signup_provider / created_at immutable
create or replace function public.sellers_protect_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'sellers.id is immutable';
  end if;
  if new.signup_provider is distinct from old.signup_provider then
    raise exception 'sellers.signup_provider is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'sellers.created_at is immutable';
  end if;
  return new;
end;
$$;

create trigger trg_sellers_protect_immutable
  before update on public.sellers
  for each row execute function public.sellers_protect_immutable();

----------------------------------------------------------------------
-- 2. sellers RLS 정책 (auth.md §2.2.1)
----------------------------------------------------------------------
alter table public.sellers enable row level security;

-- SELECT: 본인 행만
create policy "sellers_select_self"
  on public.sellers for select
  to authenticated
  using (id = auth.uid());

-- INSERT: 클라이언트 직접 금지. handle_new_seller 트리거(SECURITY DEFINER)로만 생성.
-- 정책 부재 = anon/authenticated 차단.

-- UPDATE: 본인 행만. 변조 금지 컬럼은 trigger 가 차단.
create policy "sellers_update_self"
  on public.sellers for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- DELETE: 클라이언트 금지 (탈퇴는 auth.users DELETE → CASCADE).

----------------------------------------------------------------------
-- 3. auth.users → public.sellers 동기화 트리거 (auth.md §2.3)
----------------------------------------------------------------------
create or replace function public.handle_new_seller()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name    text;
  v_signup_provider text;
  v_marketing       boolean;
begin
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );
  v_display_name := left(v_display_name, 60);

  v_signup_provider := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  if v_signup_provider not in ('email','google','kakao','naver') then
    v_signup_provider := 'email';
  end if;

  v_marketing := coalesce((new.raw_user_meta_data ->> 'marketing_consent')::boolean, false);

  insert into public.sellers (id, display_name, signup_provider, marketing_consent, marketing_consent_at)
  values (
    new.id,
    v_display_name,
    v_signup_provider,
    v_marketing,
    case when v_marketing then now() else null end
  )
  on conflict (id) do nothing;  -- 멱등성 (소셜 재로그인 중복 트리거 안전)

  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_seller();

----------------------------------------------------------------------
-- 4. public.audit_log : 전 카테고리 통합 감사 로그 (security.md §12)
----------------------------------------------------------------------
create table public.audit_log (
  id          bigserial primary key,
  category    text not null
              check (category in ('auth','market','registration','security','account')),
  event       text not null,
  seller_id   uuid references auth.users(id) on delete set null,
  ip_hash     text,                                   -- sha256(ip || daily_salt). 원본 IP 미저장.
  ua_hash     text,
  meta        jsonb not null default '{}'::jsonb,     -- PII / 토큰 포함 금지 (auth.md §2.4)
  at          timestamptz not null default now()
);

create index idx_audit_seller_at   on public.audit_log (seller_id, at desc);
create index idx_audit_category_at on public.audit_log (category, at desc);

comment on table public.audit_log is
  'append-only 통합 감사 로그. service_role 만 INSERT. 셀러는 본인 row 만 SELECT (security.md §12).';

alter table public.audit_log enable row level security;

-- SELECT: 본인 row 만 (운영자는 service_role 사용)
create policy "audit_select_own"
  on public.audit_log for select
  to authenticated
  using (seller_id = auth.uid());

-- INSERT/UPDATE/DELETE 정책 부재 = service_role 만 가능. append-only 강제.
-- (security.md §12.4) audit_log 는 append-only — UPDATE/DELETE 차단은 trigger 로 추가.
create or replace function public.fn_block_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit table is append-only. UPDATE/DELETE blocked.';
end;
$$;

create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function public.fn_block_audit_mutation();

create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.fn_block_audit_mutation();
