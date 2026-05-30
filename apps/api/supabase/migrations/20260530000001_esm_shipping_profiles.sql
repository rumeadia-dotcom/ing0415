-- 20260530000001_esm_shipping_profiles.sql
-- 출처:
--   docs/architecture/v1/features/esm.md §3 / §3.1 (DDL / RLS 계약 — PR-0 에서 확정)
--   esm-api/product/16.md (주소록) / 17.md (출하지) / 18.md (묶음배송비) / 19.md (발송정책)
-- 목적:
--   ESM(G마켓/옥션) 배송 선행값(addrNo/placeNo/bundlePolicyNo/dispatchPolicyNo)을
--   마켓 계정별로 1회 생성·재사용하는 "배송 프로필". 우리 앱(esm-shipping-profile Edge
--   Function)이 ESM 4단계 생성 API 를 호출한 결과 번호만 저장한다. 상품등록(PR-4) 3단계는
--   드롭다운에서 선택만 — 등록 폼 안에서 생성 API 호출 금지(고아 정책 방지, esm.md §1.3).
-- 보안:
--   - addr_no / place_no / dispatch_policy_no 등은 ESM 내부 식별 번호(PII 아님) → 셀러
--     본인 row SELECT 허용(RLS). 주소·전화·이름 등 PII 는 ESM 측에만 전달되고 DB 엔 미저장.
--   - raw_meta(jsonb) 는 "번호 외 부가" 한정. PII / 시크릿 저장 금지.
--   - INSERT/UPDATE/DELETE 정책 부재 = authenticated 거부. 생성/삭제는 service_role
--     (esm-shipping-profile Edge Function) 경유 (esm.md §3.1).

----------------------------------------------------------------------
-- 0. audit_log.category 에 'shipping' 추가
--    AuditCategory 타입(_shared/audit.ts)은 'shipping' 을 포함하나 DB constraint
--    (20260523000002) 에는 누락 → shipping 도메인 audit insert 가 23514 로 조용히 실패.
--    esm-shipping-profile / shipping-dispatch-job 의 audit 적재를 위해 추가.
----------------------------------------------------------------------
alter table public.audit_log drop constraint if exists audit_log_category_check;
alter table public.audit_log add constraint audit_log_category_check
  check (category in ('auth', 'market', 'markets', 'registration', 'security', 'account', 'shipping'));

----------------------------------------------------------------------
-- 1. esm_shipping_profiles (esm.md §3)
----------------------------------------------------------------------
create table public.esm_shipping_profiles (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references auth.users(id) on delete cascade,
  market_account_id   uuid not null references public.market_accounts(id) on delete cascade,
  site                text not null check (site in ('G', 'A')),     -- G=지마켓, A=옥션
  profile_label       text not null,                                -- 셀러 표시명 (예: "기본 출고지/택배")
  -- 번호 컬럼: status='active' 일 때만 NOT NULL 보장(아래 partial CHECK).
  -- status='error' (4단계 중 일부 성공 후 뒷단계 실패 → 고아 추적용 row) 시엔
  -- 아직 못 받은 번호가 NULL 일 수 있다 (QA-313 / esm.md §3).
  addr_no             text,                                         -- 판매자 주소록 번호 (POST /sellers/address)
  place_no            text,                                         -- 출하지 번호 (POST /shipping/places)
  bundle_policy_no    text,                                         -- 묶음배송비 정책 (POST /shipping/policies) — active 여도 사이트별 optional
  dispatch_policy_no  text,                                         -- 발송정책 번호 (POST /shipping/dispatch-policies)
  dispatch_type       text not null check (dispatch_type in ('A','B','C','D','E','F')), -- A=당일/B=순차/C=해외/D=요청일/E=주문제작/F=미정
  shipping_fee        integer not null default 0,                   -- 기본 배송비(원)
  fee_type            smallint not null check (fee_type in (1,2)),  -- 1=묶음배송비, 2=상품별배송비
  raw_meta            jsonb,                                        -- 생성 응답 메타(번호 외 부가). PII/시크릿 금지. error row 는 failedStep/esmErrorCode 만.
  status              text not null default 'active' check (status in ('active','error')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint esm_shipping_profiles_unique_label unique (market_account_id, profile_label),
  constraint esm_shipping_profiles_fee_nonneg   check (shipping_fee >= 0),
  -- status='active' = 4단계 모두 성공 → 필수 번호(addr_no/place_no/dispatch_policy_no) 보장.
  -- status='error' = 부분 성공 후 실패 → 확보된 번호만 채워지고 나머지는 NULL 허용.
  -- (bundle_policy_no 는 사이트별 미반환 케이스가 있어 active 여도 제약 대상 아님 — index.ts 415행 참고)
  constraint esm_shipping_profiles_active_nums_present check (
    status <> 'active'
    or (addr_no is not null and place_no is not null and dispatch_policy_no is not null)
  )
);

create index esm_shipping_profiles_seller_idx  on public.esm_shipping_profiles (seller_id);
create index esm_shipping_profiles_account_idx on public.esm_shipping_profiles (market_account_id);

comment on table public.esm_shipping_profiles is
  'ESM(G마켓/옥션) 배송 선행값 재사용 프로필. 우리 앱이 ESM 4단계 생성 API 호출 결과 번호를 저장. '
  '상품등록 시 dispatch_policy_no/place_no 를 주입. PII(주소/전화)는 ESM 측에만, DB 엔 번호만.';
comment on column public.esm_shipping_profiles.raw_meta is
  '생성 응답 메타(번호 외 부가). PII / 시크릿 저장 금지 (esm.md §3).';
comment on column public.esm_shipping_profiles.addr_no is
  '판매자 주소록 번호 (ESM POST /sellers/address 응답). ESM 내부 식별자 — PII 아님.';

-- updated_at 자동 갱신 (기존 공용 함수 재사용)
create trigger esm_shipping_profiles_set_updated_at
  before update on public.esm_shipping_profiles
  for each row execute function public.touch_updated_at();

----------------------------------------------------------------------
-- 2. RLS (esm.md §3.1)
--    셀러 본인 row 만 SELECT (3단계 드롭다운 / 설정 목록 조회).
--    INSERT/UPDATE/DELETE 미정의 = 거부 → 생성/수정/삭제는 Edge Function(service_role) 경유.
----------------------------------------------------------------------
alter table public.esm_shipping_profiles enable row level security;

create policy esm_shipping_profiles_select_own
  on public.esm_shipping_profiles
  for select
  to authenticated
  using (seller_id = auth.uid());

comment on policy esm_shipping_profiles_select_own on public.esm_shipping_profiles is
  '셀러 본인 row 만 SELECT. INSERT/UPDATE/DELETE 정책 부재 = service_role(Edge Function) 전용 (esm.md §3.1).';

-- GRANT: authenticated 는 SELECT 만(RLS 로 본인 row 필터). 변경은 service_role 만.
revoke all on public.esm_shipping_profiles from public, anon, authenticated;
grant  select on public.esm_shipping_profiles to authenticated;
grant  select, insert, update, delete on public.esm_shipping_profiles to service_role;

----------------------------------------------------------------------
-- 3. Realtime publication (배송 프로필 생성 완료를 설정 화면에 push — markets_accounts 와 동일 패턴)
--    RLS 가 cross-tenant 자동 필터.
----------------------------------------------------------------------
alter publication supabase_realtime add table public.esm_shipping_profiles;
