-- 20260519000004_market_accounts.sql
-- 출처: features/markets.md §2.1 ~ §2.4 (market_accounts + market_account_audit)
-- 목적: 셀러의 마켓 연결 메타데이터. RLS 로 셀러 본인 SELECT 가능. 토큰은 별 테이블 (market_credentials).

----------------------------------------------------------------------
-- 1. market_accounts (markets.md §2.1)
----------------------------------------------------------------------
create table public.market_accounts (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references auth.users(id) on delete cascade,
  market_id           text not null,
  credential_id       uuid not null references public.market_credentials(id) on delete cascade,
  account_label       text not null,                  -- market_credentials.market_account_label 와 동일값 (FK 무결성)
  external_account_id text,                            -- 마스킹된 외부 식별자 (예: "seller_a***"). 평문 PII 금지.
  status              text not null default 'active'
                      check (status in ('active','expired','revoked','error')),
  connected_at        timestamptz not null default now(),
  last_verified_at    timestamptz,
  last_error_code     text,                            -- 마스킹된 오류 코드만. raw response 금지.
  last_error_at       timestamptz,
  disconnected_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint market_accounts_unique_seller_market_label
    unique (seller_id, market_id, account_label)
);

create index market_accounts_seller_id_idx     on public.market_accounts (seller_id);
create index market_accounts_market_id_idx     on public.market_accounts (market_id);
create index market_accounts_status_idx        on public.market_accounts (status);
create index market_accounts_credential_id_idx on public.market_accounts (credential_id);

comment on table  public.market_accounts is
  '셀러별 마켓 연결 메타데이터. 토큰 ciphertext 는 market_credentials. 본 테이블은 RLS 로 셀러 본인 row 만 SELECT.';
comment on column public.market_accounts.last_error_code is
  '마스킹된 오류 코드만 (예: invalid_grant / rate_limit / network_timeout). raw response / 토큰 / PII 금지.';

-- updated_at 자동 갱신 (sellers 와 동일 함수 재사용)
create trigger trg_market_accounts_touch
  before update on public.market_accounts
  for each row execute function public.touch_updated_at();

----------------------------------------------------------------------
-- 2. market_accounts RLS (markets.md §2.2)
----------------------------------------------------------------------
alter table public.market_accounts enable row level security;

create policy market_accounts_select_own
  on public.market_accounts
  for select
  to authenticated
  using (seller_id = auth.uid());

-- INSERT/UPDATE/DELETE 정책 부재 → service_role 만 (Edge Function 경유).
-- 셀러 자발 해제도 markets-disconnect Edge Function 이 service_role 로 UPDATE.

comment on policy market_accounts_select_own on public.market_accounts is
  '셀러 본인 row 만 노출. 토큰은 market_credentials (RLS 차단). 본 테이블은 메타데이터만.';

----------------------------------------------------------------------
-- 3. market_account_audit (markets.md §2.4)
--    market_credentials_audit 와는 별도 테이블 — 본 audit 은 셀러 행동·계정 상태 이벤트.
--    append-only trigger 는 20260519000003 에서 정의된 fn_block_credential_audit_mutation 재사용.
----------------------------------------------------------------------
create table public.market_account_audit (
  id              bigserial primary key,
  account_id      uuid references public.market_accounts(id) on delete set null,
  seller_id       uuid not null,
  market_id       text,
  event           text not null
                  check (event in (
                    'connect_initiated',
                    'connect_succeeded',
                    'connect_failed',
                    'verify_succeeded',
                    'verify_failed',
                    'disconnected',
                    'auto_expired',
                    'auto_revoked'
                  )),
  ip              inet,                       -- raw IP 허용 (security.md §8 retention)
  ua              text,                       -- raw UA 허용 (PII 아님)
  correlation_id  text,
  error_code      text,                       -- 마스킹된 오류 코드만
  created_at      timestamptz not null default now()
);

create index market_account_audit_account_id_idx on public.market_account_audit (account_id);
create index market_account_audit_seller_id_idx  on public.market_account_audit (seller_id);
create index market_account_audit_event_idx      on public.market_account_audit (event);
create index market_account_audit_created_at_idx on public.market_account_audit (created_at desc);

alter table public.market_account_audit enable row level security;
alter table public.market_account_audit force row level security;
-- 정책 0개 = service_role only.

create trigger market_account_audit_no_update
  before update on public.market_account_audit
  for each row execute function public.fn_block_credential_audit_mutation();

create trigger market_account_audit_no_delete
  before delete on public.market_account_audit
  for each row execute function public.fn_block_credential_audit_mutation();

comment on table public.market_account_audit is
  'service_role only. append-only. 셀러의 마켓 계정 연결/해제/검증 이력. 토큰/코드/마켓 응답 body 저장 금지.';

----------------------------------------------------------------------
-- 4. Realtime publication 등록 (markets.md §9, registration-job-state.md §8.3)
--    status 변경을 클라이언트에 push. RLS 가 cross-tenant 자동 필터.
----------------------------------------------------------------------
alter publication supabase_realtime add table public.market_accounts;
