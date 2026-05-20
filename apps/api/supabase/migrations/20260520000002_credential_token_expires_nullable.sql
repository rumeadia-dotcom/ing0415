-- 20260520000002_credential_token_expires_nullable.sql
-- 5마켓 MVP 확장 (Wave 2):
--   market_credentials.token_expires_at 의 NOT NULL 제약 완화.
--
-- 사유:
--   마이그레이션 016 (20260520000001_credential_payload_jsonb.sql) 가 credential_kind 컬럼을
--   추가하면서 4-way AuthInput (oauth | hmac | esm_jwt | api_key) 을 통합 저장하도록 변경됨.
--   그러나 003 (20260519000003_market_credentials.sql) 의 token_expires_at NOT NULL 제약은 그대로 남아 있어,
--   hmac / esm_jwt / api_key 영구 키 저장 시점에 NOT NULL 위반으로 INSERT 가 실패한다.
--
--   - oauth kind  : access_token + refresh_token + token_expires_at (필수). 본 컬럼 유지.
--   - hmac kind   : ACCESS_KEY / SECRET_KEY / VENDOR_ID 영구 키. 만료 시각 없음 → NULL.
--   - esm_jwt kind: masterId / secretKey / sellerId / site 영구 키. 만료 시각 없음 → NULL.
--   - api_key kind: apiKey 영구 키 (v1 미사용 / 인터페이스 호환). NULL.
--
-- 호환성:
--   - 003 / 016 의 컬럼 자체는 유지. NOT NULL 제약만 제거.
--   - 016 의 fn_encrypt_and_store_credential 은 이미 oauth kind 에 한해 p_token_expires_at NULL 거부 로직 보유.
--     본 마이그레이션 이후에도 oauth kind 에서는 RPC 가 NULL 차단 → 안전.
--   - 016 의 fn_decrypt_credential 반환 컬럼 token_expires_at 는 nullable timestamptz 그대로.
--
-- 보안 등급: ★★☆☆☆ (제약 완화 — RPC 측 kind 별 가드가 데이터 무결성 1차 책임).

alter table public.market_credentials
  alter column token_expires_at drop not null;

comment on column public.market_credentials.token_expires_at is
  'OAuth refresh 트리거용. oauth kind 만 의미 있음 (RPC fn_encrypt_and_store_credential 가 NOT NULL 강제). '
  'hmac / esm_jwt / api_key kind 는 영구 키 → NULL. '
  '003 의 NOT NULL 은 017 (20260520000002_credential_token_expires_nullable.sql) 에서 완화됨.';
