-- 20260521000003_logen_credentials.sql
-- 출처:
--   docs/spec/PRD.md §7 (로젠 API 인증: userId + custCd), §8 (logen_credentials DDL 마스터)
--   docs/architecture/v1/cross-cutting/credential-vault.md §3 / §4 (pgcrypto + bytea 패턴)
-- 목적:
--   셀러별 로젠택배 B2B 자격증명 (userId / custCd) 저장. pgcrypto pgp_sym_encrypt 로 bytea 암호화.
--   발송인 정보 (sender_name / sender_address / sender_phone / fareTy / dlvFare) 는 평문 저장 (셀러 본인 노출 허용).
-- 보안:
--   - encrypted bytea 컬럼(user_id_enc / cust_cd_enc) 은 클라이언트 SELECT 차단.
--     셀러는 logen_credentials_meta view 로 "연결됨 / 미연결 + 발송인 정보" 만 확인.
--   - raw 테이블 SELECT 는 service_role 만 (logen-register-shipment Edge Function 이 사용).
-- 보안 등급: ★★★★★ (자격증명 평문 노출 시 셀러 로젠 계정 도용 가능)

----------------------------------------------------------------------
-- 1. logen_credentials (PRD-v2 §4)
----------------------------------------------------------------------
create table public.logen_credentials (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid not null unique references auth.users(id) on delete cascade,

  -- 암호화 컬럼 (credential-vault.md §3.1 패턴: bytea 만 노출, 평문 절대 금지)
  user_id_enc       bytea not null,    -- userId (연동업체코드) pgp_sym_encrypt
  cust_cd_enc       bytea not null,    -- custCd (거래처코드) pgp_sym_encrypt

  -- 발송인 정보 (셀러 본인 노출 허용 = 평문)
  sender_name       text not null,
  sender_address    text not null,
  sender_phone      text not null,

  -- 로젠 registerOrderData 파라미터 기본값
  fare_ty           text not null default 'C',
  dlv_fare          integer not null default 0 check (dlv_fare >= 0),

  -- 회전 이력 (credential-vault.md §3.1 ciphertext_kid 와 동일 패턴)
  ciphertext_kid    text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint logen_sender_name_len    check (char_length(sender_name) between 1 and 50),
  constraint logen_sender_addr_len    check (char_length(sender_address) between 1 and 500),
  constraint logen_sender_phone_len   check (char_length(sender_phone) between 1 and 30),
  constraint logen_fare_ty_check      check (fare_ty in ('C','P','M'))    -- 신용/선불/착불 가정
);

create index logen_credentials_seller_idx on public.logen_credentials (seller_id);

alter table public.logen_credentials enable row level security;

-- 본 테이블에 인증된 셀러의 정책 부재 → authenticated 의 SELECT/INSERT/UPDATE/DELETE
-- 모두 차단. encrypted bytea 가 직접 노출되지 않도록 강제. service_role 만 직접 접근.
-- 셀러용 메타 조회는 아래 logen_credentials_meta view 로 한정.

comment on table public.logen_credentials is
  'PRD-v2 §3 / §4: 셀러별 로젠택배 B2B 자격증명. user_id_enc / cust_cd_enc 는 pgcrypto pgp_sym_encrypt(bytea). '
  'RLS 정책 0개 = authenticated 전면 차단. service_role 만 SELECT/INSERT/UPDATE 가능. '
  '셀러용 메타는 logen_credentials_meta view 로만 노출.';
comment on column public.logen_credentials.user_id_enc is
  'userId (로젠 연동업체코드) 의 pgp_sym_encrypt 결과 (bytea). 평문 노출 금지.';
comment on column public.logen_credentials.cust_cd_enc is
  'custCd (로젠 거래처코드) 의 pgp_sym_encrypt 결과 (bytea). 평문 노출 금지.';

-- updated_at 트리거
create trigger logen_credentials_set_updated_at
  before update on public.logen_credentials
  for each row execute function public.touch_updated_at();

----------------------------------------------------------------------
-- 2. logen_credentials_meta view
--    셀러용 메타 조회. encrypted bytea 컬럼을 노출하지 않고 "연결됨 여부 + 발송인 정보 + 회전 시각" 만 노출.
--    security_invoker=on → 호출자 권한으로 RLS 적용. logen_credentials 의 RLS 가 0정책이라
--    authenticated 는 직접 못 보지만, 본 view 는 별도 GRANT 로 본인 row 만 노출하도록 WHERE 절을 박는다.
----------------------------------------------------------------------
create or replace view public.logen_credentials_meta
with (security_invoker = off)
as
select
  id,
  seller_id,
  sender_name,
  sender_address,
  sender_phone,
  fare_ty,
  dlv_fare,
  (user_id_enc is not null and cust_cd_enc is not null) as connected,
  ciphertext_kid,
  created_at,
  updated_at
from public.logen_credentials
where seller_id = auth.uid();

comment on view public.logen_credentials_meta is
  'PRD-v2 §3: 셀러용 로젠 자격증명 메타. security_invoker=off (view owner 권한) + WHERE seller_id = auth.uid() '
  '로 본인 row 만 노출. encrypted 컬럼은 의도적으로 제외.';

-- raw 테이블은 service_role 만 SELECT, view 는 authenticated 도 SELECT.
revoke all on public.logen_credentials      from public, anon, authenticated;
grant  select, insert, update, delete on public.logen_credentials to service_role;

grant  select on public.logen_credentials_meta to authenticated, service_role;
