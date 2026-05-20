-- 20260519000015_schema_patch.sql
-- 출처:
--   docs/architecture/v1/features/markets.md §2.5 + §5.3 (oauth_state.account_label 컬럼 — v1.1 마이그레이션 가정)
--   docs/architecture/v1/cross-cutting/image-pipeline.md §6 + Wave 1 image-register Edge Function
--     (product_images.role 컬럼 — image-register 응답 메타로만 쓰던 것을 DB 컬럼으로 정착)
-- 목적:
--   Wave 1 Edge Function 들이 사용하는 컬럼 중, 기존 마이그레이션(004 / 005)에 누락된 것을 보강.
-- 비고:
--   - market_account_audit 의 `connect_initiated_rejected` 이벤트는 ENUM 이 아닌
--     CHECK 제약 대상이며, Wave 1 markets-oauth-start 는 해당 이벤트를
--     `market_account_audit` 가 아닌 `audit_log` (자유 텍스트 event 컬럼) 로 보낸다.
--     → 본 마이그레이션에서 별도 처리 불필요. 미해결 항목에서 다시 언급.
-- 보안 등급: ★★ (RLS 영향 없음, 컬럼 추가만).

----------------------------------------------------------------------
-- 1. oauth_state.account_label
--    markets.md §5.3 (8) 의 결정: markets-oauth-start 가 account_label 을
--    oauth_state row 에 함께 저장하여 콜백 시점에 복원.
----------------------------------------------------------------------
alter table public.oauth_state
  add column if not exists account_label text;

comment on column public.oauth_state.account_label is
  'markets.md §5.3: OAuth start 시점 셀러가 입력한 표시명. 콜백에서 market_accounts.account_label / market_credentials.market_account_label 로 전파.';

----------------------------------------------------------------------
-- 2. product_images.role
--    image-pipeline.md §6 + Wave 1 image-register: position=0 → 'main', else 'sub'.
--    기존 image-register 는 응답 메타로만 반환 (DB 컬럼 없음).
--    DB 컬럼으로 정착하여 마켓 어댑터(`transformProduct`) 가 단일 출처로 사용.
--    DEFAULT 'sub' + 백필 후 NOT NULL 강제.
----------------------------------------------------------------------
alter table public.product_images
  add column if not exists role public.product_image_role;

-- 기존 row 백필: position = 0 → main, 그 외 → sub.
update public.product_images
  set role = case when position = 0 then 'main'::public.product_image_role
                  else 'sub'::public.product_image_role end
  where role is null;

alter table public.product_images
  alter column role set default 'sub';

alter table public.product_images
  alter column role set not null;

comment on column public.product_images.role is
  'image-pipeline.md §6: 대표(main) / 부(sub) 이미지 구분. position=0 INSERT 시 main 일관 적용 (Edge Function image-register 책임).';

-- 대표 이미지는 상품당 최대 1개 (멱등 보장).
create unique index if not exists product_images_one_main_per_product
  on public.product_images (product_id)
  where role = 'main';

----------------------------------------------------------------------
-- 3. (참고) market_account_audit.event 의 `connect_initiated_rejected`
--    Wave 1 markets-oauth-start 는 `appendAudit({ category: 'markets',
--    event: 'connect_initiated_rejected' })` 를 사용 — 이는 `audit_log` 테이블
--    (security.md §12) 의 자유 텍스트 event 컬럼이며, CHECK 제약 대상 아님.
--    → 별도 마이그레이션 불필요. ENUM ADD VALUE 트랜잭션 제약도 무관.
----------------------------------------------------------------------
