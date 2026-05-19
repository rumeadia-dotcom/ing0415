# features/markets.md — 마켓 계정 (s5) 종합 설계 (v1)

> 본 문서는 **다중 마켓 상품 자동 등록 SaaS** 의 s5 마켓 계정 도메인을 단일 파일로 정의한다. backend·security·frontend·designer·qa 4 관점을 통합한다.
>
> **작성 책임**: backend (INTJ, 12년차) 주도. security / frontend / designer / qa 양측 리뷰 후 머지.
> **승인**: architect + security.
> **의존**: `docs/architecture/v1/platform.md`, `frontend.md`, `ui-system.md`, `security.md`, `testing.md`, `cross-cutting/market-adapter.md`, `cross-cutting/credential-vault.md`.
> **차단 권한**: 본 문서가 architect + security 승인 전까지 `src/features/markets/*` 및 `supabase/functions/markets-*` 구현 PR **금지**.
> **근거**: PRD §2.2 / §2.3 / §2.4, CLAUDE.md "마켓 자격증명 저장" / "외부 API 로깅 패턴" / "MVP 범위 v1", `user_flow.md` s5 (n34~n40).

---

## 1. 목적 · 범위 · user_flow 매핑

### 1.1 목적 (3줄)

- 셀러가 **네이버 스마트스토어** 와 **쿠팡** 계정을 OAuth 로 안전하게 연결·해제·상태 확인하도록 한다.
- 마켓 OAuth access/refresh 토큰은 `market_credentials` (credential-vault.md) 단일 경로로 저장하며, 클라이언트 평문 노출 0 을 유지한다.
- 마켓별 연결 상태(`active` / `expired` / `revoked` / `error`) 를 Realtime 으로 셀러 화면에 즉시 반영한다.

### 1.2 범위

- **포함**: s5 화면 4종 (`/markets` 목록 / `/markets/connect` 선택 / `/markets/connect/:provider` OAuth 진입 안내 / `/markets/callback/:provider` 결과), 마켓 어댑터 호출 Edge Function 5종 (oauth-start / oauth-callback / token-refresh / disconnect / verify), `market_accounts` 테이블, `market_account_audit` 테이블, Realtime 채널 구독.
- **제외 (다른 문서)**:
  - 토큰 암호화/복호화 / `market_credentials` DDL·RPC → `cross-cutting/credential-vault.md`.
  - MarketAdapter 5메서드 인터페이스 / 어댑터별 zod 응답 검증 / 재시도 / rate limit → `cross-cutting/market-adapter.md`.
  - 등록 잡 시점 토큰 사용 (`registration-run`) → `features/registration.md` (Phase 2).
  - Sentry 마스킹 / RLS 보안 헌법 → `security.md`.
  - 이미지 변환 → `cross-cutting/image-pipeline.md`.
- **MVP 우선**: 네이버 스마트스토어 + 쿠팡 실 구현. 11번가 / G마켓 / 옥션 = UI 에 "v2 예정" 비활성 카드 노출. 어댑터 stub 은 `market-adapter.md` 규약에 따라 v2 에서.

### 1.3 user_flow s5 노드 매핑

`user_flow.md` s5 의 6 노드를 본 문서 화면·Edge Function 에 1:1 매핑한다.

| user_flow 노드 | 의미 | 본 문서 매핑 | 비고 |
|---|---|---|---|
| s5-n34 | s5 진입 (대시보드 → 마켓 계정) | `GET /markets` 화면 (§7.1) | 사이드바 "마켓" |
| s5-n35 | 연결된 계정 목록 | `GET /markets` 의 MarketStack 카드 (§7.1) | Realtime 구독 (§9) |
| s5-n36 | 신규 연결 선택 | `GET /markets/connect` 화면 (§7.2) | 5개 마켓 그리드, naver/coupang 활성 |
| s5-n37 | OAuth 인증 안내 | `GET /markets/connect/:provider` 화면 (§7.3) | `markets-oauth-start` 호출 |
| s5-n38 | 외부 마켓 OAuth 동의 | 외부 마켓 도메인 (앱 책임 밖) | redirect 후 §s5-n39 로 복귀 |
| s5-n39 | 콜백 / 계정 연결 결과 | `GET /markets/callback/:provider` 화면 (§7.4) | `markets-oauth-callback` 결과 표시 |
| s5-n40 | 해제 / 상태 확인 | `/markets` 행 내 액션 (§7.1) — `markets-disconnect` / `markets-verify` | 확인 다이얼로그 강제 |

s5 외 진입점: 대시보드(s2) 위젯 "연결된 마켓 N" 클릭 → `/markets`. 상품 등록(s3) 마켓 선택 단계에서 "연결 안 됨" 표시 → `/markets/connect` deep link.

---

## 2. 데이터 모델

### 2.1 `market_accounts`

셀러가 연결한 마켓 계정의 메타데이터. `market_credentials` (토큰 ciphertext) 와 **1:1** 관계. 본 테이블은 클라이언트가 RLS 통해 직접 SELECT 가능 (토큰 미포함).

```sql
-- 마이그레이션: 20260518_market_accounts.sql
CREATE TABLE public.market_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id           text NOT NULL,
  credential_id       uuid NOT NULL REFERENCES public.market_credentials(id) ON DELETE CASCADE,
  account_label       text NOT NULL,                  -- 셀러가 부여한 표시명 (예: "메인 스토어"). market_credentials.market_account_label 와 동일값 (FK 무결성 trigger 로 보장).
  external_account_id text,                            -- 마켓 측 셀러 식별자 (마스킹된 표시용 — 예: "seller_a***"). 평문 PII 저장 금지.
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  connected_at        timestamptz NOT NULL DEFAULT now(),
  last_verified_at    timestamptz,                     -- markets-verify 마지막 성공 시각
  last_error_code     text,                            -- 마스킹된 오류 코드만. raw response 금지.
  last_error_at       timestamptz,
  disconnected_at     timestamptz,                     -- 셀러 자발 해제 시각
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT market_accounts_unique_seller_market_label
    UNIQUE (seller_id, market_id, account_label)
);

CREATE INDEX market_accounts_seller_id_idx ON public.market_accounts (seller_id);
CREATE INDEX market_accounts_market_id_idx ON public.market_accounts (market_id);
CREATE INDEX market_accounts_status_idx    ON public.market_accounts (status);
CREATE INDEX market_accounts_credential_id_idx ON public.market_accounts (credential_id);

COMMENT ON TABLE  public.market_accounts IS
  '셀러별 마켓 연결 메타데이터. 토큰 ciphertext 는 market_credentials. 본 테이블은 RLS 로 셀러 본인 row 만 SELECT 가능.';
COMMENT ON COLUMN public.market_accounts.last_error_code IS
  '마스킹된 오류 코드만 (예: invalid_grant / rate_limit / network_timeout). raw response / 토큰 / PII 금지.';
```

### 2.2 `market_accounts` RLS 정책

```sql
ALTER TABLE public.market_accounts ENABLE ROW LEVEL SECURITY;

-- 셀러 본인 row 만 SELECT
CREATE POLICY market_accounts_select_own
  ON public.market_accounts
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- INSERT / UPDATE / DELETE 는 service_role 전용 (Edge Function 경유). 정책 미정의 = 거부.
-- 셀러가 자발 해제 시에도 markets-disconnect Edge Function 이 service_role 로 UPDATE.

COMMENT ON POLICY market_accounts_select_own ON public.market_accounts IS
  '셀러 본인 row 만 노출. 토큰 ciphertext 는 market_credentials (RLS 차단). 본 테이블은 메타데이터만.';
```

- **필수**: INSERT/UPDATE/DELETE 정책 미정의 → authenticated role 의 직접 변경 거부. 모든 변경은 Edge Function (service_role) 경유.
- **금지**: `WITH CHECK` 절을 추가하여 authenticated 가 자기 row 를 INSERT/UPDATE 하도록 열기. OAuth state 검증·credential 무결성 검증이 우회된다.

### 2.3 `market_credentials` 참조

본 문서에서는 ID 만 참조. DDL / RLS / RPC / 키 회전 / audit 은 **`cross-cutting/credential-vault.md` §3 ~ §10** 가 ground truth. `market_accounts.credential_id` 는 거기 정의된 `market_credentials.id` 를 FK 로 가진다.

**관계 요지** (본 문서에서 가정):

- `market_credentials.id` = `market_accounts.credential_id` (1:1, ON DELETE CASCADE).
- `market_credentials` 는 service_role only. 클라이언트는 본 테이블 조회 0.
- 토큰 복호화는 Edge Function 의 `fn_decrypt_credential` RPC 만 가능 (credential-vault §4.3).

### 2.4 `market_account_audit`

`market_accounts` 의 모든 상태 전이·자발 해제·재인증 흐름을 append-only 로 기록. `market_credentials_audit` (credential-vault §10) 와는 **별도 테이블** — credential-vault audit 은 토큰 자체 이벤트(encrypt/decrypt/rekey), 본 audit 은 셀러 행동·계정 상태 이벤트.

```sql
CREATE TABLE public.market_account_audit (
  id              bigserial PRIMARY KEY,
  account_id      uuid REFERENCES public.market_accounts(id) ON DELETE SET NULL,
  seller_id       uuid NOT NULL,
  market_id       text,
  event           text NOT NULL
                  CHECK (event IN (
                    'connect_initiated',  -- markets-oauth-start 호출
                    'connect_succeeded',  -- markets-oauth-callback 성공
                    'connect_failed',     -- markets-oauth-callback 실패 (state/code/마켓 측 거부)
                    'verify_succeeded',   -- markets-verify 성공
                    'verify_failed',      -- markets-verify 실패
                    'disconnected',       -- 셀러 자발 해제
                    'auto_expired',       -- refresh 실패 누적으로 자동 expired 전환
                    'auto_revoked'        -- 마켓 측 invalid_grant 로 자동 revoked
                  )),
  ip              inet,                    -- 요청 IP (truncate 가능, security.md §8 retention)
  ua              text,                    -- User-Agent (raw 가능, PII 아님)
  correlation_id  text,                    -- 요청 단위 추적 ID
  error_code      text,                    -- 마스킹된 오류 코드만
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX market_account_audit_account_id_idx ON public.market_account_audit (account_id);
CREATE INDEX market_account_audit_seller_id_idx  ON public.market_account_audit (seller_id);
CREATE INDEX market_account_audit_event_idx      ON public.market_account_audit (event);
CREATE INDEX market_account_audit_created_at_idx ON public.market_account_audit (created_at DESC);

ALTER TABLE public.market_account_audit ENABLE ROW LEVEL SECURITY;
-- 정책 0개 — service_role only. 셀러 본인이라도 직접 조회 금지 (운영자 경유).

COMMENT ON TABLE public.market_account_audit IS
  'service_role only. append-only. 셀러의 마켓 계정 연결/해제/검증 이력. 토큰 / 코드 / 마켓 응답 body 저장 금지.';
```

**append-only 강제 trigger** — `credential-vault.md` §10.2 의 `fn_block_audit_mutation()` 함수를 재사용하여 UPDATE/DELETE 차단.

```sql
CREATE TRIGGER market_account_audit_no_update
  BEFORE UPDATE ON public.market_account_audit
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_audit_mutation();

CREATE TRIGGER market_account_audit_no_delete
  BEFORE DELETE ON public.market_account_audit
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_audit_mutation();
```

### 2.5 `oauth_state` (state 검증용 1회성 테이블)

```sql
CREATE TABLE public.oauth_state (
  state           text PRIMARY KEY,                    -- 32 bytes 난수 base64url
  seller_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id       text NOT NULL,
  redirect_to     text,                                -- 콜백 후 클라이언트 복귀 경로 (화이트리스트 검증된 값만)
  pkce_verifier   text,                                -- 마켓이 PKCE 지원 시 사용 (Phase 2 확인)
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,                -- 발급 후 10분
  consumed_at     timestamptz                          -- 1회 사용 후 즉시 채움
);

CREATE INDEX oauth_state_seller_id_idx  ON public.oauth_state (seller_id);
CREATE INDEX oauth_state_expires_at_idx ON public.oauth_state (expires_at);

ALTER TABLE public.oauth_state ENABLE ROW LEVEL SECURITY;
-- 정책 0개 — service_role only.

COMMENT ON TABLE public.oauth_state IS
  'OAuth state 1회성 토큰. service_role only. expires_at < now() 또는 consumed_at IS NOT NULL row 는 cron 으로 삭제.';
```

**정리 cron** (Supabase `pg_cron` 일간):

```sql
SELECT cron.schedule(
  'oauth_state_cleanup',
  '0 3 * * *',
  $$ DELETE FROM public.oauth_state WHERE expires_at < now() OR consumed_at IS NOT NULL; $$
);
```

---

## 3. 마켓별 OAuth 사양

> 본 표의 값은 Phase 2 통합 테스트에서 공식 문서로 검증. v1 문서 시점은 **잠정**.
> 미해결 사안은 §14 에 행으로 보존.

### 3.1 표 (네이버 스마트스토어 vs 쿠팡)

| 항목 | 네이버 스마트스토어 (`naver`) | 쿠팡 (`coupang`) |
|---|---|---|
| OAuth 표준 | OAuth 2.0 Authorization Code Grant | OAuth 2.0 (벤더 일부 비표준 절차 가능 — Phase 2 확인) |
| 인증 endpoint (Authorize URL) | `https://nid.naver.com/oauth2.0/authorize` (잠정 — 커머스 별도일 수 있음, Phase 2 확인) | `https://api-gateway.coupang.com/oauth2/authorize` (잠정) |
| 토큰 endpoint | `https://api.commerce.naver.com/external/v1/oauth2/token` (잠정) | `https://api-gateway.coupang.com/oauth2/token` (잠정) |
| `client_id` 보관 | Edge Function env: `NAVER_CLIENT_ID` | `COUPANG_CLIENT_ID` |
| `client_secret` 보관 | Edge Function env: `NAVER_CLIENT_SECRET` (Sentry/로그 마스킹 대상 — credential-vault §7.1) | `COUPANG_CLIENT_SECRET` |
| `redirect_uri` (화이트리스트) | `https://<app-host>/markets/callback/naver` (real) / `https://debug.<host>/markets/callback/naver` (debug) | `https://<app-host>/markets/callback/coupang` / debug 동일 패턴 |
| `scope` | `product.write product.read` (잠정 키 명, Phase 2 확인) | `seller.product.write seller.product.read` (잠정) |
| `state` | 32 bytes 난수 base64url, oauth_state + httpOnly cookie 동시 검증 | 동일 |
| PKCE | 미지원 추정 (Phase 2 확인) | 미지원 추정 |
| `code` 유효 시간 | 10분 (잠정) | 10분 (잠정) |
| `access_token` TTL | 잠정 1시간 | 잠정 6시간 |
| `refresh_token` TTL | 잠정 14일 | 잠정 30일 |
| refresh rotation | rotation 있음 (refresh 호출 시 새 refresh 발급) | rotation 여부 Phase 2 확인 |
| HTTP timeout (어댑터 fetch) | 15s | 20s |
| 429 헤더 | `Retry-After` (초) | `Retry-After` 또는 자체 헤더 (Phase 2 확인) |

### 3.2 차이점 요약

- **TTL 차이**: 네이버 refresh 14일 vs 쿠팡 30일 → §5.3 자동 갱신 cron 간격 마켓별로 다르지 않게 통합 처리 (둘 다 `token_expires_at < now() + 10min` 트리거).
- **refresh rotation**: 네이버는 회전 있음 가정 — refresh 호출 결과의 새 refresh 를 `fn_encrypt_and_store_credential` UPSERT 로 즉시 교체. 쿠팡 회전 여부는 Phase 2 확인 후 동일 처리.
- **scope 키 명**: 두 마켓 모두 Phase 2 에서 공식 키 명 확인. 본 문서는 `scope` text[] 컬럼에 마켓이 응답한 값 그대로 저장.
- **PKCE**: 두 마켓 모두 v1 시점 미사용 가정. Phase 2 에서 지원 확인되면 `oauth_state.pkce_verifier` 활용.

---

## 4. OAuth 콜백 흐름 (ASCII 시퀀스)

### 4.1 정상 연결 시퀀스

```
[Seller Browser]    [App SPA]                [Edge: oauth-start]    [Market OAuth]    [Edge: oauth-callback]    [Adapter.authenticate]    [Postgres]
      |                  |                          |                       |                       |                         |                      |
      | 1. /markets/connect/naver 진입             |                       |                       |                         |                      |
      |----------------->|                          |                       |                       |                         |                      |
      |                  | 2. "연결 시작" 클릭                              |                       |                         |                      |
      |                  |  POST markets-oauth-start { market: 'naver',     |                       |                         |                      |
      |                  |    accountLabel: '메인 스토어', redirectTo: '/markets' }                |                         |                      |
      |                  |------------------------->|                       |                       |                         |                      |
      |                  |                          | 3. authn (JWT)        |                       |                         |                      |
      |                  |                          |    seller_id 추출     |                       |                         |                      |
      |                  |                          | 4. state = rand(32B)  |                       |                         |                      |
      |                  |                          |    INSERT oauth_state |                       |                         |                      |
      |                  |                          |    (expires_at=+10m)  |                       |                         |                      |
      |                  |                          |--------------------->                         |                         |                      |
      |                  |                          | 5. Set-Cookie:        |                       |                         |                      |
      |                  |                          |    sb_oauth_state=...; httpOnly;Secure;SameSite=Lax                       |                      |
      |                  |                          | 6. authorizeUrl =     |                       |                         |                      |
      |                  |                          |    `${naver_authorize}?client_id&redirect_uri&state&scope`                |                      |
      |                  |<-------------------------|                       |                       |                         |                      |
      |                  |  200 { authorizeUrl }                            |                       |                         |                      |
      |                  | 7. window.location = authorizeUrl                |                       |                         |                      |
      |<-----------------|                          |                       |                       |                         |                      |
      | 8. 마켓 동의 화면 진입                                              |                       |                         |                      |
      |----------------------------------------------------------------->   |                       |                         |                      |
      |                                                                     | 9. 셀러 동의          |                         |                      |
      |                                                                     |---------------------->|                         |                      |
      |                                                                     | 10. callback redirect: /markets/callback/naver?code=...&state=...        |
      | <---------------------------------------------------------------------------------------------------|                                          |
      | 11. SPA route /markets/callback/naver                                                       |                         |                      |
      |----------------->|                                                                          |                         |                      |
      |                  | 12. POST markets-oauth-callback { market, code, state }                  |                         |                      |
      |                  |  (Cookie 자동 전송 — sb_oauth_state)                                     |                         |                      |
      |                  |---------------------------------------------------------------------------->                       |                      |
      |                  |                                                                          | 13. JWT authn → seller_id                       |
      |                  |                                                                          | 14. state 검증:                                  |
      |                  |                                                                          |     - Cookie state == query state                |
      |                  |                                                                          |     - oauth_state row 조회 (seller_id 일치)      |
      |                  |                                                                          |     - expires_at > now()                        |
      |                  |                                                                          |     - consumed_at IS NULL                       |
      |                  |                                                                          |     UPDATE oauth_state SET consumed_at = now()   |
      |                  |                                                                          | 15. getAdapter('naver').authenticate(code)       |
      |                  |                                                                          |--------------------->                            |
      |                  |                                                                          |                       | 16. POST token endpoint  |
      |                  |                                                                          |                       |    → TokenSet            |
      |                  |                                                                          |<---------------------|                          |
      |                  |                                                                          | 17. fn_encrypt_and_store_credential(             |
      |                  |                                                                          |       seller_id, 'naver', accountLabel,          |
      |                  |                                                                          |       access, refresh, expiresAt,                |
      |                  |                                                                          |       MASTER_KEY_<KID>, KID                     |
      |                  |                                                                          |     ) → credential_id                            |
      |                  |                                                                          |----------------------------------------------> 18. INSERT market_credentials |
      |                  |                                                                          |                                                |    INSERT market_credentials_audit (encrypt_store) |
      |                  |                                                                          |<---------------------------------------------- credential_id              |
      |                  |                                                                          | 19. INSERT market_accounts (                     |
      |                  |                                                                          |       seller_id, 'naver', credential_id,         |
      |                  |                                                                          |       account_label, status='active',            |
      |                  |                                                                          |       connected_at=now())                        |
      |                  |                                                                          |--------------------------------------------> 20. INSERT market_accounts |
      |                  |                                                                          |                                                |    INSERT market_account_audit (connect_succeeded) |
      |                  |<--- 200 { accountId, market, status: 'active', redirectTo: '/markets' }                                             |
      |                  | 21. router.replace('/markets')  + toast "스마트스토어 연결됨"                                                       |
      | 22. /markets 갱신 (Realtime: market_accounts INSERT push)                                                                              |
      |<-----------------|                                                                                                                    |
```

### 4.2 실패 분기 요약

- 14. state 검증 실패 → `400 { code: 'invalid_state' }` + `market_account_audit` (`connect_failed`, `error_code='invalid_state'`).
- 15. `adapter.authenticate` 가 `MarketError('unauthorized')` → `400 { code: 'oauth_denied' }` + audit (`connect_failed`, `invalid_grant`).
- 15. `MarketError('server')` 5xx → `withRetry` 5회 시도 후 `502 { code: 'market_unavailable' }` + audit (`connect_failed`, `server`).
- 17. fn_encrypt 실패 (master_key env 누락 등) → `500 { code: 'vault_unavailable' }` + alert (security 즉시 통지).

각 실패 시 `oauth_state.consumed_at` 은 14. 단계에서 이미 set 됨 → **state 재사용 공격 차단**.

---

## 5. Edge Functions

5개 함수 모두 Supabase Edge Functions (Deno + TypeScript). `supabase/functions/_shared/*` 의 logger / withRetry / mask / authGuard 재사용.

### 5.1 공통 규약

- **인증 가드**: 모든 함수는 호출자 JWT 검증 → `seller_id = auth.uid()` 추출. `markets-oauth-callback` 만 예외 — JWT + Cookie 양쪽 일치 검증.
- **service_role 사용 범위**: 함수 내부에서 Postgres RPC 호출 시에만 service_role. 호출자 권한과 분리.
- **로깅**: `cross-cutting/market-adapter.md` §6 패턴 강제. `correlationId` (uuid v4, 함수 진입 시 생성) 모든 로그·응답 헤더(`x-correlation-id`)에 포함.
- **에러 응답 형식**: `{ code: string; message: string; correlationId: string }`. 토큰·PII·마켓 raw response 미포함.

### 5.2 `markets-oauth-start`

**역할**: state 발급 + Cookie 설정 + 마켓 authorize URL 생성.

```ts
// supabase/functions/markets-oauth-start/index.ts (시그니처 요지)
import { z } from 'zod';

export const Request = z.object({
  market: z.enum(['naver', 'coupang']),               // v1: 11st/gmarket/auction 거부
  accountLabel: z.string().min(1).max(40),
  redirectTo: z.string().startsWith('/').max(200),    // 화이트리스트: '/markets' 로 시작하는 경로만 (cross-site 차단)
});

export const Response200 = z.object({
  authorizeUrl: z.string().url(),
  state: z.string().min(32),                           // 클라이언트가 직접 갖지는 않음 (Cookie 만). 단 응답 body 에 포함하지 않을지 결정 — 본 문서는 미포함.
  correlationId: z.string().uuid(),
});

export const ResponseError = z.object({
  code: z.enum([
    'market_not_supported',     // 11st/gmarket/auction 등
    'invalid_redirect',          // redirectTo 화이트리스트 외
    'duplicate_label',           // 동일 (seller, market, accountLabel) 이미 존재
    'unauthorized',              // JWT 없음/만료
    'internal',
  ]),
  message: z.string(),
  correlationId: z.string().uuid(),
});
```

처리:

1. JWT 검증 → seller_id.
2. `market` 가 v1 지원 (`naver`/`coupang`) 인지 확인. 아니면 `market_not_supported`.
3. `redirectTo` 가 `/` 로 시작 + 호스트 외부 URL 아닌지 검증 (절대 URL 거부). 위반 시 `invalid_redirect`.
4. `(seller_id, market, accountLabel)` 가 `market_accounts.status IN ('active','expired')` 로 이미 존재하면 `duplicate_label`. (`revoked`/`error` 는 재연결 허용 — UPSERT 경로 §5.3.)
5. `state = base64url(crypto.getRandomValues(32 bytes))`.
6. INSERT `oauth_state` (expires_at = now()+10min).
7. `Set-Cookie: sb_oauth_state=<state>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`.
8. authorize URL 빌드: `client_id` (env), `redirect_uri` (화이트리스트 상수), `scope` (마켓별 상수), `state`, `response_type=code`.
9. INSERT `market_account_audit` (`connect_initiated`).
10. 200 응답.

**금지**: `state` 를 응답 body 에 노출. Cookie 만 사용. 응답 body 의 `state` 필드는 운영 분석용으로 남길 수 있으나 클라이언트는 사용 금지 — 본 문서는 응답 스키마에서 제거 권고 (Phase 2 결정).

### 5.3 `markets-oauth-callback`

**역할**: state 검증 → adapter.authenticate(code) → 토큰 암호화 저장 → market_accounts UPSERT → 클라이언트 응답.

```ts
export const Request = z.object({
  market: z.enum(['naver', 'coupang']),
  code: z.string().min(1).max(2000),
  state: z.string().min(32),                           // URL query 의 state. Cookie 와 일치 확인.
});

export const Response200 = z.object({
  accountId: z.string().uuid(),
  market: z.enum(['naver', 'coupang']),
  accountLabel: z.string(),
  status: z.literal('active'),
  connectedAt: z.string().datetime({ offset: true }),
  redirectTo: z.string(),
  correlationId: z.string().uuid(),
});

export const ResponseError = z.object({
  code: z.enum([
    'invalid_state',             // state 불일치 / 만료 / 이미 사용됨
    'invalid_code',              // 마켓이 code 거부 (MarketError unauthorized)
    'oauth_denied',              // 셀러가 마켓 동의 거부
    'market_unavailable',        // 5xx + 재시도 5회 모두 실패
    'rate_limited',              // 429 + 재시도 모두 실패
    'vault_unavailable',         // fn_encrypt_and_store_credential 실패
    'unauthorized',
    'internal',
  ]),
  message: z.string(),
  correlationId: z.string().uuid(),
});
```

처리:

1. JWT 검증 → seller_id.
2. Cookie `sb_oauth_state` 와 query `state` 일치 확인. 불일치 → `invalid_state` + audit (`connect_failed`).
3. `oauth_state` row 조회 (state = ?). 없음 / expires_at < now() / consumed_at IS NOT NULL / seller_id 불일치 / market 불일치 → `invalid_state`.
4. `UPDATE oauth_state SET consumed_at = now() WHERE state = ?` (`RETURNING redirect_to`). 단일 트랜잭션으로 검증+소비.
5. `getAdapter(market).authenticate(code)` — `withRetry(DEFAULT_RETRY)` 으로 wrap. `unauthorized` → `invalid_code` / `oauth_denied`. `server` 재시도 후 실패 → `market_unavailable`. `rate_limit` 재시도 후 실패 → `rate_limited`.
6. `fn_encrypt_and_store_credential(seller_id, market, accountLabel, accessToken, refreshToken, expiresAt, scope, MASTER_KEY_<KID>, KID)` → `credential_id`. UPSERT 동작 — 동일 (seller, market, label) 이 `revoked` 상태였으면 그대로 갱신.
7. `INSERT INTO market_accounts (... credential_id ...) ON CONFLICT (seller_id, market_id, account_label) DO UPDATE SET status='active', credential_id=EXCLUDED.credential_id, last_verified_at=now(), last_error_code=NULL, last_error_at=NULL, disconnected_at=NULL, updated_at=now() RETURNING id`.
8. `account_label` 은 §5.2 에서 전달받지 않으므로, oauth_state 에 함께 저장하거나 또는 `markets-oauth-start` 에서 `oauth_state.account_label` 컬럼 추가 (이 문서는 후자 채택 — §2.5 `oauth_state` DDL 에 `account_label text` 컬럼을 v1.1 마이그레이션에서 추가, 본 v1 문서는 컬럼 포함 가정).
9. INSERT `market_account_audit` (`connect_succeeded`).
10. 200 응답. Cookie 는 `Set-Cookie: sb_oauth_state=; Max-Age=0` 로 삭제.

**금지**: 응답 body 에 access/refresh 토큰·`credential_id` 외 ciphertext 어떤 정보도 포함. `credential_id` 도 클라이언트엔 노출 안 함 — `account_id` 만 노출.

### 5.4 `markets-token-refresh`

**역할**: 만료 임박 토큰 자동 갱신. Supabase pg_cron 1분 간격 트리거 + 마켓 API 호출 직전 lazy 갱신 양 경로.

```ts
// cron 진입: Edge Function HTTP endpoint 를 pg_cron 이 호출
// lazy 진입: registration-run 등 다른 Edge Function 이 RPC 호출 직전 invoke

export const Request = z.object({
  mode: z.enum(['scheduled', 'on_demand']),
  // scheduled: cron 진입 — body 없음, 만료 임박 전체 스캔
  // on_demand: 단일 credential 대상 — credentialId 필수
  credentialId: z.string().uuid().optional(),
});

export const Response200 = z.object({
  refreshedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  correlationId: z.string().uuid(),
});
```

처리 (scheduled):

1. service_role 로 `SELECT id, seller_id, market_id FROM market_credentials WHERE status='active' AND token_expires_at < now() + interval '10 minutes' LIMIT 100`.
2. 각 row 에 대해:
   a. `fn_decrypt_credential(credentialId, MASTER_KEY_<KID>)` → refresh_token.
   b. `getAdapter(market).refreshToken(refresh)` — `withRetry`.
   c. 성공 → `fn_encrypt_and_store_credential` UPSERT (rotation 토큰 그대로).
   d. `MarketError('unauthorized')` → `UPDATE market_credentials SET status='revoked'`, `UPDATE market_accounts SET status='revoked', last_error_code='invalid_grant'`, `INSERT market_account_audit (auto_revoked)`.
   e. 그 외 실패 → `refresh_failure_count += 1`. `>= 3` 이면 `status='refresh_failed'`, `market_accounts.status='expired'`, audit (`auto_expired`).
3. 200 응답 with 통계.

처리 (on_demand): 단일 credential 만 위 (2) 수행.

**금지**: 토큰 평문을 함수 스코프 외 변수에 캐시. 갱신 후 즉시 dereference.

### 5.5 `markets-disconnect`

**역할**: 셀러 자발 연결 해제. 마켓 측 token revoke endpoint 호출(있으면) + DB 정리.

```ts
export const Request = z.object({
  accountId: z.string().uuid(),
});

export const Response200 = z.object({
  accountId: z.string().uuid(),
  status: z.literal('revoked'),
  correlationId: z.string().uuid(),
});

export const ResponseError = z.object({
  code: z.enum([
    'not_found',
    'forbidden',                 // accountId.seller_id != auth.uid()
    'unauthorized',
    'internal',
  ]),
  message: z.string(),
  correlationId: z.string().uuid(),
});
```

처리:

1. JWT → seller_id. `SELECT * FROM market_accounts WHERE id=? AND seller_id=auth.uid()`. 없으면 `not_found` (forbidden 과 외부 응답 동일 — 정보 누출 방지).
2. `fn_decrypt_credential(credential_id)` → access_token (마켓 측 revoke 호출용).
3. `getAdapter(market)` 가 `revokeToken(access)` 메서드를 **노출하지 않음** — `market-adapter.md` §2.1 의 5메서드 인터페이스 외이므로. 따라서 v1 에서는 마켓 측 revoke 호출 생략, DB 만 정리. (Phase 2 결정: 6번째 메서드 추가 vs 어댑터 외부에서 직접 fetch.)
4. `UPDATE market_credentials SET status='revoked', revoked_at=now() WHERE id=?`. (credential-vault audit `revoke` 자동 기록은 `fn_revoke_credential` RPC 신설 — credential-vault §10.1 의 event enum 에 이미 존재.)
5. `UPDATE market_accounts SET status='revoked', disconnected_at=now() WHERE id=?`.
6. INSERT `market_account_audit` (`disconnected`).
7. 200.

**필수**: 본 함수는 마켓 측 revoke endpoint 호출 누락을 §14 미해결 사안 O-3 으로 보존. Phase 2 에서 6번째 메서드 도입 vs 별도 헬퍼 결정.

### 5.6 `markets-verify`

**역할**: 토큰 유효성 즉시 확인. 셀러가 "상태 확인" 버튼 클릭 또는 등록 시점 사전 검증용.

```ts
export const Request = z.object({
  accountId: z.string().uuid(),
});

export const Response200 = z.object({
  accountId: z.string().uuid(),
  status: z.enum(['active', 'expired', 'revoked', 'error']),
  lastVerifiedAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
});
```

처리:

1. JWT → seller_id. account 조회 + 소유권 검증.
2. `fn_decrypt_credential` → access_token.
3. 어댑터의 **`fetchCategoryTree()` 1회 호출** 로 ping 대용 (별도 verify 엔드포인트 없는 마켓 대비). 성공 → `last_verified_at=now()`, `status='active'`.
4. `MarketError('unauthorized')` → refreshToken 1회 시도. 성공 → 토큰 재저장 + `status='active'`. 실패 → `status='revoked'`, audit (`auto_revoked`).
5. `MarketError('rate_limit'|'server'|'network')` → `status='error'`, `last_error_code=<code>`, audit (`verify_failed`).
6. 응답.

**근거**: `fetchCategoryTree` 는 비교적 가벼운 GET 이며 어댑터 5메서드에 이미 포함 — 별도 메서드 신설 회피. 마켓별 quirk 로 부적합 시 Phase 2 에 별도 verify 메서드 검토 (§14 O-4).

---

## 6. 클라이언트 zod 스키마 (`src/lib/schemas/markets.ts`)

```ts
// src/lib/schemas/markets.ts
import { z } from 'zod';

// market_accounts 의 클라이언트 노출 형식 (credential_id 제외)
export const MarketAccountStatusSchema = z.enum(['active', 'expired', 'revoked', 'error']);
export type MarketAccountStatus = z.infer<typeof MarketAccountStatusSchema>;

export const MarketAccountSchema = z.object({
  id: z.string().uuid(),
  marketId: z.enum(['naver', 'coupang', '11st', 'gmarket', 'auction']),
  accountLabel: z.string().min(1).max(40),
  externalAccountId: z.string().nullable(),            // 마스킹된 표시용
  status: MarketAccountStatusSchema,
  connectedAt: z.string().datetime({ offset: true }),
  lastVerifiedAt: z.string().datetime({ offset: true }).nullable(),
  lastErrorCode: z.string().nullable(),
  lastErrorAt: z.string().datetime({ offset: true }).nullable(),
});
export type MarketAccount = z.infer<typeof MarketAccountSchema>;

// 신규 연결 카드 표시용 (v1 지원 마켓 vs v2 예정)
export const MarketCatalogEntrySchema = z.object({
  marketId: z.enum(['naver', 'coupang', '11st', 'gmarket', 'auction']),
  displayName: z.string(),
  shortName: z.string(),
  brandColorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  enabled: z.boolean(),                                // v1 = naver/coupang true, 나머지 false
  comingSoonNote: z.string().nullable(),               // 비활성 시 표시 ("v2 예정")
});
export type MarketCatalogEntry = z.infer<typeof MarketCatalogEntrySchema>;

// markets-oauth-start 요청/응답
export const OAuthStartRequestSchema = z.object({
  market: z.enum(['naver', 'coupang']),
  accountLabel: z.string().min(1).max(40),
  redirectTo: z.string().startsWith('/').max(200),
});
export type OAuthStartRequest = z.infer<typeof OAuthStartRequestSchema>;

export const OAuthStartResponseSchema = z.object({
  authorizeUrl: z.string().url(),
  correlationId: z.string().uuid(),
});
export type OAuthStartResponse = z.infer<typeof OAuthStartResponseSchema>;

// markets-oauth-callback 요청/응답
export const OAuthCallbackRequestSchema = z.object({
  market: z.enum(['naver', 'coupang']),
  code: z.string().min(1),
  state: z.string().min(32),
});
export type OAuthCallbackRequest = z.infer<typeof OAuthCallbackRequestSchema>;

export const OAuthCallbackResponseSchema = z.object({
  accountId: z.string().uuid(),
  market: z.enum(['naver', 'coupang']),
  accountLabel: z.string(),
  status: z.literal('active'),
  connectedAt: z.string().datetime({ offset: true }),
  redirectTo: z.string(),
  correlationId: z.string().uuid(),
});
export type OAuthCallbackResponse = z.infer<typeof OAuthCallbackResponseSchema>;

// markets-disconnect / markets-verify
export const DisconnectRequestSchema = z.object({ accountId: z.string().uuid() });
export const DisconnectResponseSchema = z.object({
  accountId: z.string().uuid(),
  status: z.literal('revoked'),
  correlationId: z.string().uuid(),
});

export const VerifyRequestSchema = z.object({ accountId: z.string().uuid() });
export const VerifyResponseSchema = z.object({
  accountId: z.string().uuid(),
  status: MarketAccountStatusSchema,
  lastVerifiedAt: z.string().datetime({ offset: true }),
  correlationId: z.string().uuid(),
});

// 에러 응답 (공통)
export const MarketApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string().uuid(),
});
export type MarketApiError = z.infer<typeof MarketApiErrorSchema>;
```

본 스키마는 **백엔드 Edge Function 의 Request/Response 스키마와 동일 소스**. `supabase/functions/_shared/schemas.ts` 가 본 파일을 import 하거나, monorepo `import map` 으로 단일 소스 보장.

---

## 7. UI 흐름 — 화면별

### 7.1 `/markets` — 연결된 계정 목록 (s5-n34/n35/n40)

**목적**: 셀러가 자신이 연결한 마켓 목록을 보고, 상태 확인 / 해제 / 신규 연결 진입.

**데이터 페칭**:
- Query Key: `['marketAccounts', { sellerId }]`.
- Source: `from('market_accounts').select('id, market_id, account_label, external_account_id, status, connected_at, last_verified_at, last_error_code, last_error_at').order('connected_at', { ascending: false })`.
- RLS 가 `seller_id = auth.uid()` 자동 적용.
- Realtime: `supabase.channel('market_accounts:' + sellerId).on('postgres_changes', { event: '*', schema: 'public', table: 'market_accounts', filter: 'seller_id=eq.<sellerId>' }, ...) → invalidateQueries`.

**컴포넌트 트리** (`src/features/markets/pages/MarketsListPage.tsx`):

```
<MarketsListPage>
  <PageHeader title="마켓 계정" right={<Button onClick={connect}>신규 연결</Button>} />
  <MarketStackSummary accounts={data} />              {/* prototype 의 MarketStack 시각화 */}
  <MarketAccountTable>
    {data.map(a => <MarketAccountRow account={a} />)}
  </MarketAccountTable>
  <EmptyStateWhenZero />                              {/* 0개일 때 §8 */}
</MarketsListPage>
```

**ASCII 와이어 (데스크탑, 1200px+)**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │ 마켓 계정                                          [+ 신규 연결] │
│         │                                                                    │
│  대시   │ ┌──────────────────────────────────────────────────────────────┐ │
│  등록   │ │  ●●●●●  연결된 마켓 2 / 5                                   │ │
│ ▶ 마켓  │ │  (네이버 스마트스토어 + 쿠팡)                              │ │
│  이력   │ └──────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │ ┌─────────────────────────────────────────────────────────────┐  │
│         │ │ 마켓            라벨        상태      마지막 확인    액션  │  │
│         │ ├─────────────────────────────────────────────────────────────┤  │
│         │ │ ● 네이버스토어  메인 스토어 ● 활성   2분 전        [확인]  │  │
│         │ │                                                     [해제]  │  │
│         │ ├─────────────────────────────────────────────────────────────┤  │
│         │ │ ● 쿠팡          서브 계정   ● 만료   3일 전        [재인증]│  │
│         │ │   재인증 필요 — refresh token 만료                  [해제] │  │
│         │ └─────────────────────────────────────────────────────────────┘  │
│         │                                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**ASCII 와이어 (모바일, ~767px)**:

```
┌─────────────────────────────────┐
│ ← 마켓 계정                  ⋮ │
├─────────────────────────────────┤
│ ●●●●●  2 / 5 연결됨            │
├─────────────────────────────────┤
│ ● 네이버스토어                  │
│   메인 스토어                    │
│   ● 활성 · 2분 전 확인           │
│   [상태 확인]  [해제]            │
├─────────────────────────────────┤
│ ● 쿠팡                          │
│   서브 계정                      │
│   ● 만료 · 재인증 필요           │
│   [재인증]  [해제]               │
├─────────────────────────────────┤
│                                 │
│   [ + 신규 연결 ]               │
│                                 │
└─────────────────────────────────┘
```

**상태별 행 표시**:

| status | 뱃지 색상 (디자인 토큰) | 좌측 액션 | 우측 액션 |
|---|---|---|---|
| `active` | `--success-fg` | `[상태 확인]` | `[해제]` |
| `expired` | `--warning-fg` | `[재인증]` (= `/markets/connect/:provider` 진입) | `[해제]` |
| `revoked` | `--neutral-muted` | `[재연결]` | (해제 불필요 — disabled with tooltip "이미 해제됨") |
| `error` | `--danger-fg` | `[상태 확인]` | `[해제]` (오류 코드 hover tooltip) |

**blockingReasons** (실행류 버튼 비활성 사유):
- `[해제]` disabled 사유: `status === 'revoked'` → tooltip "이미 해제된 계정입니다".
- `[재인증]` disabled 사유: 다른 OAuth 세션 진행 중 → tooltip "다른 마켓 인증이 진행 중입니다. 완료 후 다시 시도하세요".

### 7.2 `/markets/connect` — 신규 연결 마켓 선택 (s5-n36)

**목적**: 5개 마켓을 그리드로 표시. 활성 (naver/coupang) / "v2 예정" 비활성 카드 명확히 구분.

**ASCII 와이어 (데스크탑)**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← 신규 마켓 연결                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                    │
│  │   ●            │ │   ●            │ │   ●            │                    │
│  │  네이버         │ │  쿠팡          │ │  11번가         │                    │
│  │ 스마트스토어    │ │                │ │   (v2 예정)    │                    │
│  │                │ │                │ │                │                    │
│  │  [연결하기]    │ │  [연결하기]    │ │  [곧 출시]     │                    │
│  │                │ │                │ │   disabled     │                    │
│  └────────────────┘ └────────────────┘ └────────────────┘                    │
│                                                                              │
│  ┌────────────────┐ ┌────────────────┐                                       │
│  │   ●            │ │   ●            │                                       │
│  │  G마켓          │ │  옥션          │                                       │
│  │   (v2 예정)    │ │   (v2 예정)    │                                       │
│  │                │ │                │                                       │
│  │  [곧 출시]     │ │  [곧 출시]     │                                       │
│  │   disabled     │ │   disabled     │                                       │
│  └────────────────┘ └────────────────┘                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**ASCII 와이어 (모바일)**:

```
┌─────────────────────────────────┐
│ ← 신규 마켓 연결                │
├─────────────────────────────────┤
│  ●  네이버 스마트스토어         │
│      [ 연결하기 ]                │
├─────────────────────────────────┤
│  ●  쿠팡                        │
│      [ 연결하기 ]                │
├─────────────────────────────────┤
│  ●  11번가 (v2 예정)            │
│      [ 곧 출시 ]  disabled       │
├─────────────────────────────────┤
│  ●  G마켓 (v2 예정)             │
│      [ 곧 출시 ]  disabled       │
├─────────────────────────────────┤
│  ●  옥션 (v2 예정)              │
│      [ 곧 출시 ]  disabled       │
└─────────────────────────────────┘
```

**카드 컴포넌트** (`MarketCatalogCard`):
- 색상: prototype `data.js` 의 마켓별 brandColorHex 그대로 사용 (naver `#03C75A` / coupang `#F11F44` / 11st `#FF0038` / gmarket `#00B147` / auction `#E73936`).
- 비활성 카드는 grayscale + `[곧 출시]` 라벨 + 클릭 무반응 + `aria-disabled="true"`.
- 활성 카드 클릭 → `/markets/connect/:provider` 로 이동.

### 7.3 `/markets/connect/:provider` — OAuth 진입 안내 (s5-n37)

**목적**: 셀러가 어떤 권한을 부여하게 되는지 안내 + accountLabel 입력 + 외부 OAuth 리다이렉트.

**ASCII 와이어 (데스크탑)**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← 네이버 스마트스토어 연결                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  스마트스토어 계정을 연결하면 아래 권한이 부여됩니다:                         │
│   · 상품 등록 / 수정                                                          │
│   · 상품 목록 조회                                                            │
│   · 카테고리 트리 조회                                                        │
│                                                                              │
│  ─────────────────────────────────────────────────                            │
│                                                                              │
│  계정 라벨 (구분용)                                                           │
│  ┌──────────────────────────────────────┐                                    │
│  │ 메인 스토어                          │                                    │
│  └──────────────────────────────────────┘                                    │
│  1~40자. 동일 마켓에서 라벨 중복 불가.                                        │
│                                                                              │
│                                                                              │
│            [ 취소 ]            [ 네이버 로그인으로 이동 → ]                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**ASCII 와이어 (모바일)**:

```
┌─────────────────────────────────┐
│ ← 네이버 스마트스토어 연결      │
├─────────────────────────────────┤
│ 부여될 권한                     │
│ · 상품 등록 / 수정              │
│ · 상품 조회                     │
│ · 카테고리 조회                 │
├─────────────────────────────────┤
│ 계정 라벨                       │
│ ┌─────────────────────────────┐ │
│ │ 메인 스토어                 │ │
│ └─────────────────────────────┘ │
│ 1~40자                          │
├─────────────────────────────────┤
│                                 │
│  [ 취소 ]                       │
│                                 │
│  [ 네이버 로그인으로 이동 → ]   │
│                                 │
└─────────────────────────────────┘
```

**버튼 동작**:
- 검색/필터류 버튼 없음.
- 실행류 = `[네이버 로그인으로 이동]`:
  - `disabled` 사유 (blockingReasons): `accountLabel` 비어있음 / 길이 초과 / 동일 마켓 중복 라벨 (사전 조회) / OAuth start 호출 중 loading.
  - tooltip: "라벨을 1~40자 입력하세요" / "이미 사용 중인 라벨입니다".
- 클릭 → `markets-oauth-start` 호출 → 응답의 `authorizeUrl` 로 `window.location.assign(...)`.

**RHF + zod**: `OAuthStartRequestSchema` 를 `zodResolver` 로 그대로 사용.

### 7.4 `/markets/callback/:provider` — 콜백 결과 (s5-n39)

**목적**: 마켓에서 redirect 된 직후 잠시 표시되는 화면. 자동으로 `markets-oauth-callback` 호출 → 성공 시 `/markets` 로 redirect, 실패 시 상세 에러 표시.

**ASCII 와이어 (로딩 상태)**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                          ●  연결 처리 중...                                  │
│                                                                              │
│                     네이버 스마트스토어 토큰을 안전하게 저장하고             │
│                     계정 정보를 확인하는 중입니다.                            │
│                                                                              │
│                          [   진행 중   ]  spinner                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**ASCII 와이어 (실패 상태)**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                          ⚠  연결에 실패했습니다                              │
│                                                                              │
│   사유: 인증 코드가 만료되었거나 이미 사용되었습니다.                         │
│   요청 ID: 7f3a-… (문의 시 알려주세요)                                       │
│                                                                              │
│   ▼ 자세한 오류 정보 (펼치기)                                                │
│                                                                              │
│            [ 처음부터 다시 시도 ]            [ 마켓 목록으로 ]                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

- `ErrorMessage` 공통 컴포넌트 사용 (`src/components/ui/error-message.tsx`). raw response 는 접힘 기본.
- `[처음부터 다시 시도]` → `/markets/connect/:provider`.
- `[마켓 목록으로]` → `/markets`.

---

## 8. 상태 처리 (loading / data / error / empty + 부분)

| 화면 | loading | data | error | empty | 부분(partial) |
|---|---|---|---|---|---|
| `/markets` | 스켈레톤 행 3개 (테이블 height 유지) | 카드 + 행 렌더 | 페이지 상단 `ErrorBanner` + 재시도 | "아직 연결된 마켓이 없습니다. [+ 신규 연결]" CTA 카드 | 활성 0 / 기타 N (예: 모두 expired) — 경고 배너 "모든 마켓이 재인증 필요" + 1차 액션 노출 |
| `/markets/connect` | 스켈레톤 카드 5개 | 카드 그리드 | 페이지 상단 `ErrorBanner` | 발생 불가 (마켓 카탈로그는 상수) | n/a |
| `/markets/connect/:provider` | 폼은 즉시 렌더, OAuth start mutation 로딩만 버튼 spinner | 폼 + 버튼 활성 | 인라인 폼 에러 + `ErrorMessage` | n/a | n/a |
| `/markets/callback/:provider` | 큰 spinner + 진행 메시지 | 즉시 `/markets` redirect (data 상태 화면 없음) | 실패 화면 (§7.4) | n/a | n/a |

**4상태 + 부분** 요구사항은 `CLAUDE.md` "프론트엔드 UI 일관성" §4상태 + partial 처리 와 정합.

**empty 상세** (`/markets` 가 0개일 때):

```
┌──────────────────────────────────────────┐
│                                          │
│            🔌 (큰 아이콘)                │
│                                          │
│      아직 연결된 마켓이 없습니다.        │
│                                          │
│  상품을 등록하려면 먼저 1개 이상의       │
│  마켓 계정을 연결하세요.                 │
│                                          │
│        [ + 첫 마켓 연결하기 ]            │
│                                          │
└──────────────────────────────────────────┘
```

---

## 9. Realtime 갱신

### 9.1 구독 패턴

```ts
// src/features/markets/hooks/useMarketAccountsRealtime.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useMarketAccountsRealtime(sellerId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`market_accounts:${sellerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'market_accounts',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          // payload 의 토큰·credential_id 등은 본 테이블에 없음 (메타데이터만) — 그대로 invalidate 만.
          qc.invalidateQueries({ queryKey: ['marketAccounts', { sellerId }] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sellerId, qc]);
}
```

### 9.2 트리거 이벤트

| 이벤트 | UI 반영 |
|---|---|
| `markets-oauth-callback` 성공 → market_accounts INSERT/UPDATE | `/markets` 자동 갱신, toast "연결됨" |
| `markets-token-refresh` 가 status='revoked'/'expired' 로 전환 | `/markets` 행 뱃지 갱신, 셀러가 화면 보고 있으면 inline 알림 |
| `markets-disconnect` 성공 → market_accounts UPDATE | 행 status='revoked' 로 갱신 |
| `markets-verify` 결과 → last_verified_at 갱신 | 행 우측 "마지막 확인" 즉시 갱신 |

**필수**: Realtime 채널 이름은 `market_accounts:<sellerId>` 로 고정. 셀러 ID 가 URL 에 들어가지 않도록 클라이언트 메모리만.

**금지**: `market_credentials` / `market_credentials_audit` / `market_account_audit` 테이블에 Realtime 구독. service_role only 테이블이며 클라이언트가 채널을 열 권한 없음. RLS 가 0 row 반환하더라도 채널 노출 자체가 위협.

---

## 10. 에러 매핑 — 사용자 한국어 메시지

| Edge Function code | 사용자 메시지 (한국어) | UI 위치 | 후속 액션 |
|---|---|---|---|
| `market_not_supported` | "현재 지원하지 않는 마켓입니다. (v2 예정)" | `/markets/connect` 카드 클릭 시 | 카드 비활성으로 사전 차단 |
| `invalid_redirect` | "복귀 경로가 올바르지 않습니다. 다시 시도해 주세요." | `/markets/connect/:provider` 인라인 | 페이지 새로고침 |
| `duplicate_label` | "이미 사용 중인 라벨입니다. 다른 이름을 사용하세요." | accountLabel 입력 인라인 | 라벨 변경 |
| `invalid_state` | "보안 검증에 실패했습니다. 처음부터 다시 시도해 주세요." | `/markets/callback/:provider` 에러 화면 | `/markets/connect/:provider` 재진입 |
| `invalid_code` | "인증 코드가 만료되었거나 이미 사용되었습니다." | 동일 | 재진입 |
| `oauth_denied` | "마켓에서 권한 부여를 거부했습니다." | 동일 | 재진입 또는 마켓에서 권한 재허용 |
| `market_unavailable` | "{마켓이름} 서버에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." | 동일 | 재시도 (5분 후 권장 안내) |
| `rate_limited` | "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." | 동일 | retry-after 시간 표시 |
| `vault_unavailable` | "내부 보안 저장소 오류입니다. 운영팀에 자동 알림되었습니다." | 동일 | Sentry 자동 보고, 셀러는 잠시 후 재시도 |
| `forbidden` / `not_found` | "해당 계정을 찾을 수 없습니다." | `/markets` 액션 결과 | `/markets` 새로고침 |
| `unauthorized` | "다시 로그인해 주세요." | 전역 | 로그아웃 후 로그인 화면 |
| `internal` | "알 수 없는 오류입니다. 문의 시 요청 ID 를 알려주세요." | 인라인 + correlationId 표시 | Sentry 보고됨, 요청 ID 노출 |

**필수**: 모든 에러 화면에 `correlationId` 노출 (요청 ID). 셀러가 문의 시 운영팀이 즉시 로그 추적 가능.

**금지**: 에러 메시지에 마켓 API 의 raw response / 토큰 / 셀러 이메일·전화 노출. `last_error_code` 의 마스킹된 코드만 사용.

---

## 11. 보안 (`security.md` + `credential-vault.md` 인용)

본 섹션은 `security.md` 및 `credential-vault.md` 의 통제를 본 도메인에 적용한다. 충돌 시 `security.md` 우선.

### 11.1 state CSRF 방지

- **필수**: state = 32 bytes 난수 base64url. `oauth_state` DB row + httpOnly Secure SameSite=Lax Cookie 양쪽 일치 검증. (`security.md` §7.2 / 본 문서 §2.5, §5.2, §5.3)
- **필수**: state 1회 사용 후 `consumed_at` 즉시 set. 단일 트랜잭션 검증+소비.
- **필수**: state 발급 후 10분 이내만 유효. 만료된 state 는 oauth_state cron 으로 삭제.
- **금지**: state 를 응답 body 에 노출. URL hash 또는 응답 body 통한 state 전달 금지.
- **금지**: `SameSite=None` 으로 Cookie 발급. 본 Cookie 는 동일 사이트 콜백에만 사용.

### 11.2 토큰 클라이언트 평문 노출 0

- **필수**: access/refresh 토큰은 `market_credentials` (service_role only, ciphertext) 에만 저장. (`credential-vault.md` §3.2)
- **필수**: Edge Function 응답 body 에 토큰 포함 금지. `markets-oauth-callback` / `markets-verify` 응답 schema 검토 — 토큰 필드 부재 확인.
- **금지**: 토큰 평문을 SPA localStorage / sessionStorage / cookie / IndexedDB 저장.
- **금지**: 클라이언트가 `market_credentials` 테이블에 SELECT 시도. RLS 정책 부재로 0 row 반환됨을 자동 테스트로 검증 (`testing.md` §보안 매트릭스).

### 11.3 로그 마스킹

- **필수**: `cross-cutting/market-adapter.md` §6 의 외부 호출 3종 로그 패턴 적용. 토큰은 길이만(`tokenLen: 187`), correlationId / sellerId / market / status / event 만 허용.
- **필수**: `last_error_code` / `last_error_at` 컬럼에 raw response body 저장 금지. 마스킹된 코드만 (예: `invalid_grant`, `rate_limit`, `network_timeout`).
- **필수**: Sentry `beforeSend` 마스킹 — `access_token` / `refresh_token` / `code` / `client_secret` / `Authorization` 자동 redact (`credential-vault.md` §7.1).
- **금지**: `console.log` 직접 사용. Edge Function 은 구조화 logger 만.

### 11.4 토큰 갱신 실패 → 재인증 유도 + 자동 무효화

- **필수**: `markets-token-refresh` 가 `MarketError('unauthorized')` 또는 마켓 측 `invalid_grant` 응답 받으면 즉시:
  1. `market_credentials.status = 'revoked'`, `revoked_at = now()`.
  2. `market_accounts.status = 'revoked'`, `last_error_code = 'invalid_grant'`, `last_error_at = now()`.
  3. `market_account_audit` (`auto_revoked`).
  4. Realtime 으로 `/markets` 화면 자동 갱신 → 셀러가 "재연결" 버튼 클릭 → `/markets/connect/:provider`.
- **필수**: 일반 네트워크 실패 누적 3회 → `market_credentials.status = 'refresh_failed'` + `market_accounts.status = 'expired'`. 셀러에게 "재인증 필요" 노출. (`credential-vault.md` §6.2)
- **금지**: 무한 갱신 재시도. `withRetry(DEFAULT_RETRY)` (5회) 상한 적용.

### 11.5 redirect_uri 화이트리스트

- **필수**: `markets-oauth-start` 가 마켓 authorize URL 조립 시 `redirect_uri` 는 Edge Function env 의 상수 화이트리스트에서만 선택. 클라이언트 입력 금지.
- **필수**: 마켓 콜백 후 SPA 의 `redirectTo` (앱 내부 경로) 도 `/markets` 로 시작하는 절대 경로만 허용. 외부 URL / 다른 도메인 거부.
- **금지**: 동적 `redirect_uri` 빌드. 동적 호스트명·서브도메인 사용 금지.

### 11.6 service_role 사용 범위 명시

본 도메인에서 service_role 을 사용하는 Edge Function 경로는 아래 5개 함수의 RPC 호출 구간뿐이다 — 그 외 위치에서 service_role 키 사용 금지.

- `markets-oauth-start`: `INSERT oauth_state`, `INSERT market_account_audit`, `SELECT market_accounts` (중복 라벨 확인).
- `markets-oauth-callback`: `UPDATE oauth_state` (consume), `fn_encrypt_and_store_credential`, `UPSERT market_accounts`, `INSERT market_account_audit`.
- `markets-token-refresh`: `SELECT market_credentials`, `fn_decrypt_credential`, `fn_encrypt_and_store_credential`, `UPDATE market_credentials/market_accounts`, `INSERT market_account_audit`, `INSERT market_credentials_audit`.
- `markets-disconnect`: `SELECT market_accounts`, `UPDATE market_credentials`, `UPDATE market_accounts`, `INSERT market_account_audit`.
- `markets-verify`: `SELECT market_accounts`, `fn_decrypt_credential`, `UPDATE market_accounts`, optional `fn_encrypt_and_store_credential` (refresh 갱신).

**security 검수 대상**: 위 5개 Edge Function PR 은 `security.md` §14 보안 체크리스트 + `credential-vault.md` §12 체크리스트 양쪽 통과 필요.

---

## 12. 테스트 매트릭스 (`testing.md` 양식)

본 매트릭스는 `testing.md` §3 (단위) / §4 (통합) / §5 (E2E) 양식을 따른다. **happy 3건 + failure 9건 + RLS 2건 = 14건** 필수.

### 12.1 매트릭스

| # | 분류 | 대상 | 시나리오 | 입력 | 기대 | 자동화 |
|---|---|---|---|---|---|---|
| M-H1 | happy | `markets-oauth-start` + callback (naver, mock) | 스마트스토어 연결 happy | mock authorize → mock callback code | `market_accounts.status='active'` / `market_credentials` row 존재 / Cookie 삭제됨 / audit `connect_succeeded` | Vitest + Playwright |
| M-H2 | happy | 동일 (coupang, mock) | 쿠팡 연결 happy | 동일 | 동일 (market='coupang') | Vitest + Playwright |
| M-H3 | happy | 양쪽 연속 연결 | naver 연결 후 coupang 연결 | 순차 두 번 OAuth | `market_accounts` 2 rows / `/markets` 목록 2개 표시 / Realtime 양쪽 push 수신 | Playwright |
| M-F1 | failure | `markets-oauth-callback` | 사용자가 마켓 동의 거부 | callback `?error=access_denied` (state 정상) | `400 { code: 'oauth_denied' }` / audit `connect_failed` / `oauth_state.consumed_at` set | Vitest + MSW |
| M-F2 | failure | 동일 | state 불일치 (Cookie ≠ query) | Cookie 변조 | `400 { code: 'invalid_state' }` / `market_credentials` row 미생성 | Vitest |
| M-F3 | failure | 동일 | state 재사용 (consumed_at 이미 set) | 동일 state 2회 callback | 두 번째 호출 `400 { code: 'invalid_state' }` | Vitest |
| M-F4 | failure | 동일 | 마켓 token endpoint 가 `invalid_grant` (mock 401) | mock SCENARIO='401' | `400 { code: 'invalid_code' }` / 재시도 안 함 | Vitest + mock 어댑터 |
| M-F5 | failure | 동일 | 마켓 5xx 5회 (mock) | mock SCENARIO='5xx' | `withRetry` 5회 시도 후 `502 { code: 'market_unavailable' }` / 각 시도 로그 attempt 번호 포함 | Vitest + mock + withRetry |
| M-F6 | failure | 동일 | 429 + retry-after 후 성공 | mock 429 → 200 | wrapper 가 retryAfterMs 대기 후 성공, `200 { status: 'active' }` | Vitest + withRetry |
| M-F7 | failure | `markets-token-refresh` | refresh 실패 누적 3회 → expired 전환 | 네트워크 실패 mock 3회 | `market_credentials.status='refresh_failed'`, `market_accounts.status='expired'`, audit `auto_expired`, Realtime push | Vitest |
| M-F8 | failure | `markets-token-refresh` | refresh 가 `invalid_grant` → 즉시 revoked | mock 401 | `market_credentials.status='revoked'`, `market_accounts.status='revoked'`, audit `auto_revoked` | Vitest |
| M-F9 | failure | `markets-token-refresh` (scheduled) | 만료 임박 토큰 자동 갱신 성공 | `token_expires_at < now()+10min` mock row | refreshToken 호출 → 새 ciphertext 저장 → `last_refresh_at=now()`, `status='active'` 유지 | Vitest |
| M-F10 | failure | `markets-disconnect` | 다른 셀러의 accountId 시도 | seller A 가 seller B 의 accountId | `404 { code: 'not_found' }` (forbidden 과 외부 메시지 동일 — 정보 누출 방지) | Vitest |
| M-R1 | RLS | `market_credentials` | authenticated role 직접 SELECT 시도 | 셀러 본인의 credential_id 로도 SELECT | 0 row 반환 (정책 부재로 거부) | pgTAP 또는 Vitest + supabase-js |
| M-R2 | RLS | `market_accounts` | 다른 셀러의 row SELECT 시도 | seller A 로 seller B 의 row 조회 | 0 row 반환 (RLS `seller_id = auth.uid()` 적용) | 동일 |
| M-E2E | E2E | 골든 패스 일부 | s1 로그인 → s5 마켓 연결 (naver+coupang) → /markets 표시 | Playwright 시나리오 | 양쪽 연결 성공 / 목록 2개 / Realtime push 확인 | Playwright (`testing.md` §3) |

### 12.2 RLS 테스트 코드 예시

```ts
// src/features/markets/__tests__/rls.test.ts (Vitest + supabase-js)
import { createClient } from '@supabase/supabase-js';

describe('market_credentials RLS — anon/authenticated 직접 접근 0 row', () => {
  it('authenticated 가 자기 row 조회 시도해도 0 row', async () => {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await userClient.auth.signInWithPassword({ email, password });
    const { data, error } = await userClient.from('market_credentials').select('id');
    expect(error).toBeNull();              // 에러 아님 — 정책 부재 = 0 row
    expect(data).toEqual([]);
  });
});

describe('market_accounts RLS — 셀러 본인 row 만 SELECT', () => {
  it('seller A 가 seller B 의 row 조회 0 row', async () => {
    const aClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await aClient.auth.signInWithPassword({ email: aEmail, password: aPwd });
    const { data } = await aClient.from('market_accounts').select('id').eq('seller_id', bId);
    expect(data).toEqual([]);
  });
});
```

### 12.3 자동화 매핑

- **Vitest 단위**: M-F1 ~ M-F10, M-R1 ~ M-R2, mock 어댑터 동등성 (`market-adapter.md` §11).
- **Vitest 통합**: M-H1 / M-H2 (Edge Function + Postgres + mock 어댑터 통합).
- **Playwright E2E**: M-H3, M-E2E.
- **CI 차단**: 위 14건 전부 통과 시에만 머지 (PR check 강제).

---

## 13. 수락 기준 체크리스트

본 문서 기반 PR (`supabase/functions/markets-*`, `src/features/markets/*`, 마이그레이션) 은 아래를 **전부** 통과해야 머지 가능.

- [ ] 1. `market_accounts` DDL 이 §2.1 과 일치 (컬럼·인덱스·제약·코멘트).
- [ ] 2. `market_accounts` RLS 정책 — SELECT 본인 row 만, INSERT/UPDATE/DELETE 정책 0개 (service_role only) 확인. 다른 셀러 row 조회 0건 테스트 (M-R2) 통과.
- [ ] 3. `market_credentials` 참조는 `credential-vault.md` §3 ~ §4 의 RPC (`fn_encrypt_and_store_credential` / `fn_decrypt_credential`) 만 사용. 본 도메인 코드 어디에서도 `market_credentials` 직접 SELECT/UPDATE 없음.
- [ ] 4. `market_account_audit` DDL + append-only trigger 적용. UPDATE/DELETE 차단 테스트 통과.
- [ ] 5. `oauth_state` DDL + cron 정리 jobs 등록 + 1회 사용 보장 (consumed_at 검증) 단위 테스트 통과.
- [ ] 6. 5개 Edge Function (`markets-oauth-start` / `markets-oauth-callback` / `markets-token-refresh` / `markets-disconnect` / `markets-verify`) 의 Request/Response zod 스키마가 §5 / §6 와 일치.
- [ ] 7. 모든 Edge Function 응답 body 에 access/refresh 토큰·`credential_id`·`master_key` 미포함 자동 검증 (Vitest schema assertion).
- [ ] 8. Sentry `beforeSend` 마스킹 룰에 토큰·code·client_secret·Authorization 헤더 redact 룰 적용. CI grep 통과.
- [ ] 9. state CSRF 방지: 32 bytes 난수 / httpOnly Secure SameSite=Lax Cookie / 10분 만료 / 1회 사용. M-F2 / M-F3 테스트 통과.
- [ ] 10. `redirect_uri` 화이트리스트 검증 — 코드 상수만 허용. M-F (invalid_redirect) 테스트 통과.
- [ ] 11. `withRetry` 적용: rate_limit / server / network 만 재시도, unauthorized 즉시 throw. M-F5 / M-F6 테스트 통과.
- [ ] 12. 토큰 자동 갱신 (10분 전) cron 등록 + lazy 갱신 (60초 이내 만료 시) 양쪽 경로 테스트. M-F9 통과.
- [ ] 13. 토큰 갱신 실패 누적 3회 → `expired`, `invalid_grant` → `revoked` 자동 전환. M-F7 / M-F8 통과.
- [ ] 14. Realtime 채널: `market_accounts:<sellerId>` 만 구독. `market_credentials` / audit 테이블 구독 금지 — ESLint 룰 또는 코드 리뷰 강제.
- [ ] 15. UI 4상태 + partial: `/markets` 의 loading / data / error / empty / 부분 모두 구현. RTL 테스트 통과.
- [ ] 16. blockingReasons tooltip: 실행류 버튼 모두에 비활성 사유 노출. 키보드 focus 로도 tooltip 표시 확인 (a11y).
- [ ] 17. 접근성 WCAG 2.1 AA: jsx-a11y lint 통과 + Playwright axe 검사 통과 + 모든 버튼 키보드 동선 확인.
- [ ] 18. 사용자 에러 메시지 한국어 + correlationId 노출. raw response / 토큰 / PII 미포함 자동 검증.
- [ ] 19. 디자인 토큰만 사용 (raw 색상값 금지). prototype `data.js` 의 brandColorHex 는 `src/lib/markets/catalog.ts` 단일 출처로 이식.
- [ ] 20. `cross-cutting/market-adapter.md` 의 `getAdapter` 만 사용. 본 도메인 코드 어디서도 어댑터 직접 import 없음. 모드 분기 1지점 검증.
- [ ] 21. debug 모드 동등성: mock 어댑터 5 시나리오 (`happy` / `5xx` / `401` / `429` / `timeout` / `partial`) 가 본 도메인 전 흐름 통과. CI 통과.
- [ ] 22. 본 문서가 `frontend.md` / `ui-system.md` / `security.md` / `credential-vault.md` / `market-adapter.md` 와 정합. 충돌 시 후자 우선 명시.

---

## 14. 미해결 사안 (Phase 2 결정)

| # | 사안 | 영향 | 결정 시점 |
|---|---|---|---|
| O-1 | 네이버 스마트스토어 실제 OAuth endpoint / scope 명 / refresh TTL | §3.1 표 갱신 | Phase 2 통합 시작 |
| O-2 | 쿠팡 OAuth 표준 준수 여부 / refresh rotation 유무 | §3.1 / §5.4 | Phase 2 |
| O-3 | 마켓 측 token revoke endpoint 호출 — `MarketAdapter` 6번째 메서드 추가 vs 어댑터 외부 헬퍼 | §5.5 `markets-disconnect` | Phase 2 + architect + security 합의 |
| O-4 | `markets-verify` 의 ping 메서드 — `fetchCategoryTree` 재사용 vs 별도 verify 메서드 신설 | §5.6 / `market-adapter.md` 인터페이스 | Phase 2 마켓 quirk 확인 후 |
| O-5 | `external_account_id` 마스킹 형식 — 어느 자리수까지 노출할지 | §2.1 / §6 / §7.1 행 표시 | Phase 1 디자인 + security 합의 |
| O-6 | OAuth state 와 함께 `account_label` 보존 방식 — `oauth_state.account_label` 컬럼 추가 (본 문서 가정) vs `markets-oauth-start` 의 state 에 서명 페이로드로 embed | §2.5 / §5.2 / §5.3 | Phase 1 코드 작성 직전 |
| O-7 | PKCE 지원 — 네이버 / 쿠팡 OAuth 가 PKCE 수용 시 `code_verifier` 도입 | §3.1 / §2.5 `pkce_verifier` 컬럼 활용 | Phase 2 |
| O-8 | 11번가 / G마켓 / 옥션 어댑터 stub 단위 테스트 — v1 시점 `market-adapter.md` §11 의 8개 케이스 중 어디까지 강제 | `market-adapter.md` §10 신규 마켓 절차 | v2 진입 직전 |
| O-9 | Realtime 채널 이름에 sellerId 노출 안전성 — Supabase Realtime 토큰 검증으로 충분한지 | §9.1 | security 추가 검토 |
| O-10 | 일일 등록 한도 (소프트 limit) 와 마켓 연결 한도 — 셀러당 마켓별 N계정까지 허용할지 | §7.1 / §2.1 unique 제약 변경 가능성 | 베타 운영 데이터 후 |

---

## 부록 A. 본 문서 외부 의존

본 문서가 인용하거나 의존하는 외부 산출물. 이들 중 어느 하나라도 변경 시 본 문서 정합성 재검토 필수.

- `docs/architecture/v1/platform.md` — Supabase 프로젝트 분리 (debug / real), pg_cron, Edge Function timeout.
- `docs/architecture/v1/frontend.md` — React Router / TanStack Query / RHF + zod / Realtime 통합 패턴.
- `docs/architecture/v1/ui-system.md` — shadcn/ui, 디자인 토큰, 4상태 + partial, blockingReasons tooltip, ErrorMessage.
- `docs/architecture/v1/security.md` — RLS 헌법, state CSRF, redirect_uri 화이트리스트, Sentry 마스킹.
- `docs/architecture/v1/testing.md` — 단위 / 통합 / E2E 매트릭스, RLS 테스트, axe a11y.
- `docs/architecture/v1/cross-cutting/credential-vault.md` — `market_credentials` DDL / RLS / RPC / 키 회전 / audit.
- `docs/architecture/v1/cross-cutting/market-adapter.md` — `MarketAdapter` 5메서드 인터페이스 / `MarketError` / `withRetry` / OAuth 시퀀스 / 마켓별 차이 매트릭스 / mock 동등성.
- `CLAUDE.md` — "마켓 자격증명 저장" / "외부 API 로깅 패턴" / "MVP 범위 v1" / "프론트엔드 UI 일관성" / "3개 산출물 동기화".
- `PRD.md` §2.2 마켓 계정 관리, §2.3 마켓 연결 상태, §2.4 자격증명 보안.
- `user_flow.md` s5 마켓 계정 (n34 ~ n40).

---

## 부록 B. 3개 산출물 동기화 대상

본 문서 변경 시 다음 3개를 함께 갱신한다 (`CLAUDE.md` "3개 산출물 동기화" 규약).

| 분류 | 경로 | 갱신 시점 |
|---|---|---|
| 설계문서 | `docs/architecture/v1/features/markets.md` (본 문서) | 모든 결정 변경 시 |
| HTML 프로토타입 | `docs/frontend_html_design/v1/markets/` (Phase 2 신설) | UI 와이어 §7 변경 시 |
| 실제 구현 | `src/features/markets/`, `supabase/functions/markets-*/`, `src/lib/schemas/markets.ts` | 모든 결정 적용 시 |

---

## 부록 C. 개정 이력

개정 이력은 본 문서가 아닌 git 로그를 ground truth 로 한다. 본 v1.0 작성 시점 = 2026-05-18.
