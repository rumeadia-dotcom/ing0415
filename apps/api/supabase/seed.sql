-- dev 환경 시드 데이터 (mock 어댑터 + 실 DB 흐름 비교용)
-- 마스터: docs/handoff/WIP-5markets-mvp.md §"phase 2: dev DB seed"
--
-- 사용:
--   1. Supabase Studio (dev) 에서 테스트 셀러 1명 회원가입 (Auth 가 auth.users 생성)
--   2. SQL Editor 에서 그 UUID 확인:
--        select id from auth.users where email = '<your-test-email>';
--   3. 본 파일의 `:test_seller_id` placeholder 를 그 UUID 로 치환 후 실행
--   4. (또는) supabase db reset 시 supabase CLI 가 자동 적용 — 이 경우 placeholder
--      가 인식 안 되므로 미리 sed 로 치환 또는 본 파일을 SQL Editor 수동 실행.
--
-- 정책:
--   - mock 자격증명 / mock URL 만. 실 마켓 API 호출 absolutely 금지.
--   - placeholder UUID (`00000000-...-0001`) 는 dev 환경에서만 유효. real 환경 사용 금지.
--   - 모든 row 가 RLS 통과해야 한다 — `seller_id = :test_seller_id` 강제.

-- ─────────────────────────────────────────────────────────────
-- 변수 정의 (psql \set 또는 수동 sed 치환)
-- ─────────────────────────────────────────────────────────────
-- 운영자는 본 파일을 SQL Editor 에 붙여넣기 전, 아래 UUID 를 본인 테스트 셀러로 치환.
\set test_seller_id '00000000-0000-0000-0000-000000000001'

-- ─────────────────────────────────────────────────────────────
-- 1. 셀러 프로필 (sellers — auth.users 의 mirror 메타)
-- ─────────────────────────────────────────────────────────────
insert into public.sellers (id, display_name, plan, created_at, updated_at)
values (
  :'test_seller_id', '테스트 셀러', 'free', now(), now()
)
on conflict (id) do update set
  display_name = excluded.display_name,
  updated_at = now();

-- ─────────────────────────────────────────────────────────────
-- 2. 배송 정책 (v0.6 신규 — shipping_policies)
-- ─────────────────────────────────────────────────────────────
insert into public.shipping_policies (id, seller_id, name, fee, method, eta_days, is_default, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', :'test_seller_id', '기본 정책 (3,000원)', 3000, 'courier', 2, true, now(), now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', :'test_seller_id', '무료 배송', 0, 'courier', 3, false, now(), now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', :'test_seller_id', '제주/도서산간 추가 2,500원', 3000, 'courier', 4, false, now(), now())
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 3. 마켓 계정 (market_accounts — 실 자격증명 아님, status='active' placeholder)
-- ─────────────────────────────────────────────────────────────
-- 실 credential_payload 는 market_credentials 테이블에 pgcrypto 암호화 — seed 에선 생략.
-- 본 row 는 UI 의 s5 화면이 "이미 연결됨" 카드로 표시되도록 status 만 active.
insert into public.market_accounts (id, seller_id, market_id, account_label, status, connected_at, last_verified_at, created_at, updated_at)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', :'test_seller_id', 'naver',   '네이버 본점',   'active', now(), now(), now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', :'test_seller_id', 'coupang', '쿠팡 메인',     'active', now(), now(), now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', :'test_seller_id', 'gmarket', 'G마켓 본점',    'active', now(), now(), now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', :'test_seller_id', 'auction', '옥션 본점',     'active', now(), now(), now(), now())
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 4. 상품 (products — 5개 샘플)
-- ─────────────────────────────────────────────────────────────
insert into public.products (id, seller_id, name, price, original_price, brand, manufacturer, description_html, base_category_id, shipping_policy_id, created_at, updated_at)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', :'test_seller_id', '테스트 상품 A — 기본 의류', 29900, 39900, 'TestBrand', 'TestMfg',
   '<p>테스트 상품 A 의 상세 설명. <strong>WYSIWYG</strong> 미리보기.</p>',
   'category-clothing-default', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', :'test_seller_id', '테스트 상품 B — 뷰티 세트', 49900, null, 'TestBrand', null,
   '<p>뷰티 세트 상세.</p>',
   'category-beauty-default', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', :'test_seller_id', '테스트 상품 C — 식품', 12000, null, null, '식품 제조사',
   '<p>식품 상세.</p>',
   'category-food-default', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccc04', :'test_seller_id', '테스트 상품 D — 가전', 199000, 250000, 'TestBrand', 'TestMfg',
   '<p>가전 상세. <em>WYSIWYG</em> 적용.</p>',
   'category-appliance-default', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccc05', :'test_seller_id', '테스트 상품 E — 도서', 18000, null, null, null,
   '<p>도서 상세.</p>',
   'category-book-default', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', now(), now())
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 5. 등록 잡 (registration_jobs — 3개 샘플, 다양한 상태)
-- ─────────────────────────────────────────────────────────────
insert into public.registration_jobs (id, seller_id, product_id, status, market_ids, created_at, completed_at, updated_at)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddd01', :'test_seller_id', 'cccccccc-cccc-cccc-cccc-cccccccccc01',
   'succeeded', '{naver,coupang,gmarket,auction}', now() - interval '2 hours', now() - interval '1 hour 50 minutes', now()),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', :'test_seller_id', 'cccccccc-cccc-cccc-cccc-cccccccccc02',
   'partial', '{naver,coupang,gmarket,auction}', now() - interval '5 hours', now() - interval '4 hours 45 minutes', now()),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', :'test_seller_id', 'cccccccc-cccc-cccc-cccc-cccccccccc03',
   'failed', '{naver,coupang}', now() - interval '1 day', now() - interval '23 hours 50 minutes', now())
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 6. 등록 잡 마켓별 결과 (registration_job_market_results)
-- ─────────────────────────────────────────────────────────────
insert into public.registration_job_market_results (id, job_id, market_id, status, external_product_id, error_message, completed_at)
values
  -- 잡 01: 4 마켓 모두 성공
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'naver',   'succeeded', 'naver-mock-001',   null, now() - interval '1 hour 55 minutes'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'coupang', 'succeeded', 'coupang-mock-001', null, now() - interval '1 hour 54 minutes'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'gmarket', 'succeeded', 'gmarket-mock-001', null, now() - interval '1 hour 53 minutes'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'auction', 'succeeded', 'auction-mock-001', null, now() - interval '1 hour 52 minutes'),
  -- 잡 02: 부분 성공 (naver/coupang success, gmarket/auction fail)
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'naver',   'succeeded', 'naver-mock-002',   null, now() - interval '4 hours 50 minutes'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'coupang', 'succeeded', 'coupang-mock-002', null, now() - interval '4 hours 49 minutes'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee7', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'gmarket', 'failed',    null,               '카테고리 매핑 실패 (mock)', now() - interval '4 hours 48 minutes'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee8', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'auction', 'failed',    null,               '이미지 규격 초과 (mock)', now() - interval '4 hours 47 minutes'),
  -- 잡 03: 전체 실패
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee9', 'dddddddd-dddd-dddd-dddd-dddddddddd03', 'naver',   'failed',    null,               'OAuth 토큰 만료 (mock)', now() - interval '23 hours 55 minutes'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeea', 'dddddddd-dddd-dddd-dddd-dddddddddd03', 'coupang', 'failed',    null,               'HMAC 인증 실패 (mock)', now() - interval '23 hours 54 minutes')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 7. 검증 + 종료
-- ─────────────────────────────────────────────────────────────
do $$
declare
  seller_count int;
  policy_count int;
  account_count int;
  product_count int;
  job_count int;
  result_count int;
begin
  select count(*) into seller_count from public.sellers where id = '00000000-0000-0000-0000-000000000001';
  select count(*) into policy_count from public.shipping_policies where seller_id = '00000000-0000-0000-0000-000000000001';
  select count(*) into account_count from public.market_accounts where seller_id = '00000000-0000-0000-0000-000000000001';
  select count(*) into product_count from public.products where seller_id = '00000000-0000-0000-0000-000000000001';
  select count(*) into job_count from public.registration_jobs where seller_id = '00000000-0000-0000-0000-000000000001';
  select count(*) into result_count from public.registration_job_market_results
    where job_id in (
      'dddddddd-dddd-dddd-dddd-dddddddddd01',
      'dddddddd-dddd-dddd-dddd-dddddddddd02',
      'dddddddd-dddd-dddd-dddd-dddddddddd03'
    );
  raise notice 'seed.sql complete — sellers=%, policies=%, accounts=%, products=%, jobs=%, results=%',
    seller_count, policy_count, account_count, product_count, job_count, result_count;
end $$;
