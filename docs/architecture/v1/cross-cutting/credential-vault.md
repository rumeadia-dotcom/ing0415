# credential-vault.md — 마켓 자격증명 보관 설계 (v1)

> 본 문서는 `security.md` §4 "마켓 자격증명 저장" 의 **상세 구현 사양**이다. OAuth access/refresh 토큰 및 마켓 API 키의 저장·복호화·회전·감사 전 구간을 다룬다.
>
> **작성 책임**: security 에이전트 (INTJ, 15년차).
> **승인**: architect.
> **의존**: `security.md` (헌법), `platform.md` (Supabase 프로젝트 분리), `testing.md` (보안 테스트 매트릭스).
> **차단 권한**: 본 문서가 architect + security 양측 승인되기 전까지 `features/markets.md` (Phase 2) 진입 **금지**. 마켓 어댑터 구현·OAuth 콜백 Edge Function 구현 모두 본 문서의 DDL·키 관리 절차를 기준으로만 한다.
> **개정 절차**: 본 문서의 모든 "필수 / 금지" 항목은 PR 단위로 security + architect 양측 승인 필수. 단독 수정 금지.
> **근거**: PRD §2.4 (자격증명 암호화 / 정기 보안 감사 / 백업·복구), CLAUDE.md "마켓 자격증명 저장" / "외부 API 로깅 패턴", `security.md` §1.3 위협 T1·T3.

---

## 1. 목적·범위 + 위협 모델

### 1.1 목적

- 셀러가 연결한 마켓(스마트스토어·쿠팡·11번가·G마켓·옥션) OAuth access/refresh 토큰과 API 키를 **DB 평문 노출 0** 상태로 보관한다.
- 토큰 복호화 권한은 **Edge Function (service_role)** 에만 부여하고, 클라이언트·anon·authenticated role 의 복호화 경로를 **물리적으로 차단**한다.
- 키 회전·토큰 회전·사고 대응 절차를 사전에 정의하여, 사고 발생 시 **수동 즉흥 대응 금지**한다.

### 1.2 범위

- **포함**: `market_credentials` 테이블 DDL·RLS, 암호화/복호화 흐름, 마스터 키 관리, OAuth refresh 토큰 자동 갱신, `market_credentials_audit` 감사 로그, 사고 대응 runbook, debug 모드 동등성.
- **제외 (다른 문서)**: 마켓 어댑터 인터페이스 (`features/markets.md`), OAuth 콜백 화이트리스트 (`security.md` §6), Sentry 마스킹 룰 (`security.md` §7), 백업 일정 (`ops/backup.md` — Phase 3 예정).

### 1.3 위협 모델

자격증명 보관에 한정된 STRIDE 매핑. `security.md` §1.3 의 T1·T3 을 본 문서 통제로 차단한다.

| ID | 위협 actor | 시나리오 | 영향 등급 | 1차 통제 |
|---|---|---|---|---|
| CV-T1 | 외부 침입자 | DB SQLi·Supabase 대시보드 탈취·anon key 유출로 `market_credentials` 평문 SELECT 시도 | 치명적 | RLS 전 정책 차단 + 컬럼 암호화 |
| CV-T2 | 외부 침입자 | DB 백업 파일(`.sql.gz`·snapshot) 매체 유출 | 치명적 | 백업 시점에도 ciphertext 만 존재 (envelope 암호화 / 마스터 키 분리 보관) |
| CV-T3 | 내부 권한자 | 운영자가 Supabase Studio 로 `market_credentials` 조회 → 토큰 화면 노출 | 높음 | 컬럼 암호화 (Studio 에서도 ciphertext) + 감사 로그 + 키 접근권 분리 |
| CV-T4 | 로그 누출 | Edge Function 로그·Sentry breadcrumb·CI artifact 에 복호화된 토큰 평문 노출 | 높음 | `beforeSend` 마스킹 + 키 이름 화이트리스트 + 응답 body 검증 |
| CV-T5 | 내부 권한자 | Edge Function 코드 변경으로 평문 토큰을 외부 로 송출 | 높음 | 코드 리뷰 (security 거부권) + 감사 로그 + 데이터 송출 도메인 화이트리스트 |
| CV-T6 | 키 관리 실패 | 마스터 키 분실·키 회전 누락으로 ciphertext 복호 불가 또는 구 키 유출 시 전수 복호화 | 치명적 | 키 회전 절차 + `ciphertext_kid` 컬럼 + 다중 키 양립 기간 |
| CV-T7 | OAuth provider 측 토큰 폐기 | 마켓 측에서 refresh token revoke → 자동 갱신 실패 누적 | 중간 | 갱신 실패 감사 로그 + 셀러 재인증 유도 흐름 |

본 7개 위협이 §2 ~ §11 모든 통제의 1차 근거다. 신규 통제 추가 시 어느 ID 를 줄이는지 본 표에 매핑한다.

---

## 2. 저장 방식 결정: pgcrypto vs Supabase Vault

### 2.1 비교표

두 옵션 모두 Supabase 내부에서 envelope 암호화를 제공하지만 키 관리 책임 분담이 다르다.

| 항목 | pgcrypto (`pgp_sym_encrypt` / `pgp_sym_decrypt`) | Supabase Vault |
|---|---|---|
| **키 관리** | 마스터 키를 우리가 보관 (GitHub Secrets 또는 Edge Function env). 키 로테이션 절차 직접 구현 필요. | Supabase 가 KMS 로 마스터 키 보관 (libsodium + project-scoped DEK). 우리는 `vault.secrets` 테이블에 secret 만 등록. |
| **회전 절차** | `ciphertext_kid` 컬럼으로 다중 키 양립 (직접 구현). 회전 도중 다운타임 0 가능. | Supabase 측 키 회전 정책에 의존. 우리 측에서는 secret 자체 재등록만 트리거. |
| **Edge Function 접근** | `pgp_sym_decrypt(col, current_setting('app.master_key'))` 형태 RPC 로만 가능. 마스터 키는 Edge Function env 에서 RPC 호출 시 전달. | `select decrypted_secret from vault.decrypted_secrets where id = ?` 의 RLS-bypass view 를 service_role 로 호출. |
| **백업 보호** | 백업에는 ciphertext + `ciphertext_kid` 만 존재. 마스터 키는 별도 매체(GitHub Secrets) 에 분리 보관 → 백업 매체 유출만으로 복호 불가. | 백업에 `vault.secrets` (ciphertext) 포함. project-scoped DEK 는 Supabase 측. 백업 매체 + Supabase project 접근권 동시 탈취 시에만 복호 가능. |
| **RLS 호환** | 컬럼 자체는 RLS 통상 정책 적용. 복호 RPC 는 `security definer` + service_role 가드. | `vault.decrypted_secrets` view 는 service_role 전용. RLS 호환성 명시적. |
| **비용** | 추가 비용 없음 (Supabase Postgres 확장 무료). | Supabase Vault 는 모든 플랜에서 무료 제공 (2026-05 기준 확인 필수). |
| **운영 난이도** | 키 회전·KID 관리·키 분실 대응 모두 직접 구현·운영 책임. | Supabase 의존성 추가 (장애 시 우리 토큰 복호 불가). |
| **debug/real 격리** | 마스터 키만 프로젝트별 분리하면 됨. CI 시크릿 스코프로 보장. | Supabase 프로젝트 분리 = Vault 분리 (자동). |
| **이식성** | Postgres 표준. Supabase 외부로 이전 가능. | Supabase 종속. 이전 시 모든 secret 재등록 필요. |

### 2.2 결정

**1안 — pgcrypto 채택 (필수).**

**근거:**

1. **키와 데이터 분리 보관**: 마스터 키는 GitHub Secrets (배포 시 Edge Function env 로 주입), ciphertext 는 Postgres 에 저장. 백업 매체 단독 유출 시 복호 불가 — CV-T2 1차 통제.
2. **회전 절차 자기통제**: 사고 대응 시 마스터 키 즉시 회전이 외부 의존 없이 가능. Supabase Vault 채택 시 Supabase 측 키 회전 SLA 에 종속.
3. **이식성**: 향후 Supabase 외부로 이전 또는 다중 region 분산 시 표준 Postgres 확장으로 호환.
4. **debug 동등성 보장 용이**: 두 Supabase 프로젝트 모두 동일 pgcrypto 확장 활성화 + 별도 마스터 키 주입. mock 토큰도 동일 경로로 암호화.

**금지**: Supabase Vault 와 pgcrypto 를 **혼용** 금지. 단일 경로로만 운영해야 사고 시 추적·감사가 가능하다.

**금지**: 마스터 키를 Postgres DB 안(`app.settings` 등) 에 저장 금지. DB 와 키가 같은 매체에 있으면 envelope 암호화 의미가 소멸한다.

---

## 3. 테이블 DDL

### 3.1 `market_credentials`

마켓 OAuth 토큰·API 키의 단일 저장소. 한 셀러 × 한 마켓 × 한 계정 = 1 row.

```sql
-- pgcrypto 확장 활성화 (debug / real 양 프로젝트 모두)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.market_credentials (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id                text NOT NULL,           -- 'naver' | 'coupang' | '11st' | 'gmarket' | 'auction' (market-adapter.md 단일 출처)
  market_account_label     text NOT NULL,           -- 셀러가 부여한 표시 이름 (예: "메인 스토어")
  encrypted_access_token   bytea NOT NULL,          -- pgp_sym_encrypt 결과
  encrypted_refresh_token  bytea NOT NULL,
  token_expires_at         timestamptz NOT NULL,    -- access_token 만료 시각
  ciphertext_kid           text NOT NULL,           -- 사용된 마스터 키 식별자 (예: 'mk_2026_q2')
  scope                    text[] NOT NULL DEFAULT '{}',
  status                   text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'revoked', 'refresh_failed', 'expired')),
  last_refresh_at          timestamptz,
  last_refresh_error       text,                    -- 마스킹된 오류 코드만. 토큰·PII 금지.
  refresh_failure_count    integer NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  rotated_at               timestamptz NOT NULL DEFAULT now(),  -- 마지막 키 회전·토큰 회전 시각
  revoked_at               timestamptz,

  CONSTRAINT market_credentials_unique_seller_market_account
    UNIQUE (seller_id, market_id, market_account_label)
);

CREATE INDEX market_credentials_seller_id_idx        ON public.market_credentials (seller_id);
CREATE INDEX market_credentials_market_id_idx        ON public.market_credentials (market_id);
CREATE INDEX market_credentials_token_expires_at_idx ON public.market_credentials (token_expires_at)
  WHERE status = 'active';   -- 만료 임박 토큰 스캔용 부분 인덱스
CREATE INDEX market_credentials_status_idx           ON public.market_credentials (status);

COMMENT ON TABLE  public.market_credentials IS
  'service_role only. 마켓 OAuth 토큰 · API 키. 컬럼 암호화는 pgcrypto / 마스터 키는 Edge Function env. 클라이언트 직접 접근 금지.';
COMMENT ON COLUMN public.market_credentials.ciphertext_kid IS
  '암호화 시점 마스터 키 식별자. 키 회전 시 신·구 키 양립을 위한 라우팅 키.';
COMMENT ON COLUMN public.market_credentials.last_refresh_error IS
  '마스킹된 오류 코드만 허용. raw token / API 응답 body 저장 금지.';
```

### 3.2 RLS 정책

- **필수**: RLS `ENABLE` + **클라이언트 정책 부재** (= 모든 anon/authenticated 접근 거부). `security.md` §3.1 의 "service_role only" 패턴.

```sql
ALTER TABLE public.market_credentials ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = anon/authenticated 어떤 SELECT/INSERT/UPDATE/DELETE 도 거부.
-- service_role 은 RLS bypass 이므로 Edge Function 만 접근 가능.

-- 명시적 거부 코멘트 (운영자 실수 방지)
COMMENT ON TABLE public.market_credentials IS
  'RLS ENABLED with NO POLICIES. service_role only. 클라이언트 SDK 로 select 시도하면 0 row 반환.';
```

- **금지**: 본 테이블에 `FOR SELECT TO authenticated USING (seller_id = auth.uid())` 류의 정책 **추가 금지**. 셀러 본인이라도 토큰 평문·암호문 어떤 형태로도 클라이언트 직접 조회 금지. 모든 조회는 Edge Function 경유.
- **금지**: `service_role` 키를 클라이언트 번들·프론트엔드 env (`VITE_*`) 에 노출 금지. service_role 키는 Edge Function env 에서만 사용.

### 3.3 `market_credentials_audit`

§10 에서 상세. 모든 INSERT/UPDATE/SELECT 이벤트 기록 테이블. DDL 은 §10.1 참조.

---

## 4. 암호화 / 복호화 흐름

### 4.1 저장 흐름 (OAuth 콜백 직후 또는 토큰 갱신 후)

```
[Browser]                [Edge Function: oauth-callback]      [Postgres]              [Master Key Store]
   |                              |                                |                          |
   | --- code, state ---------->  |                                |                          |
   |                              | validate state (CSRF)          |                          |
   |                              | exchange code → tokens         |                          |
   |                              |   (call market OAuth endpoint) |                          |
   |                              |                                |                          |
   |                              | load master key (current KID)  |  <----- env: MASTER_KEY_CURRENT (mk_2026_q2)
   |                              |                                |                          |
   |                              | RPC: encrypt_and_store(        |                          |
   |                              |   seller_id, market_id,        |                          |
   |                              |   access_token, refresh_token, |                          |
   |                              |   expires_at, kid              |                          |
   |                              | )  ----------------------->    |                          |
   |                              |                                | pgp_sym_encrypt(token,   |
   |                              |                                |   master_key) → bytea    |
   |                              |                                | INSERT market_credentials|
   |                              |                                | INSERT market_credentials_audit |
   |                              |                                |                          |
   |                              |  <---- credential_id  ---------|                          |
   |                              | log: { sellerId, market, kid, tokenLen } (마스킹 적용)    |
   |  <--- 200 OK (no token) ---  |                                |                          |
```

- **필수**: 토큰 평문은 Edge Function 메모리 외부로 절대 나가지 않는다. Postgres 에는 즉시 암호화 후 저장.
- **필수**: Edge Function 응답 body 에 토큰 포함 금지. 클라이언트는 `credentialId` + 마스킹된 상태만 받는다.
- **금지**: `console.log(tokens)` 류 디버그 출력 금지 (debug 모드 포함). lint 룰로 검출 — `security.md` §7 의 자동 grep 통과 필수.

### 4.2 복호화 흐름 (마켓 API 호출 직전)

```
[Edge Function: register-product]    [Postgres]                    [Master Key Store]
        |                                |                                |
        | RPC: fetch_and_decrypt(        |                                |
        |   credential_id, kid_override? |                                |
        | )  ------------------------->  |                                |
        |                                | SELECT encrypted_*, kid        |
        |                                |   FROM market_credentials      |
        |                                |   WHERE id = ?                 |
        |                                |                                |
        |                                | look up master_key by kid      |
        |                                |   (env 에서 라우팅)  <---------|  MASTER_KEY_mk_2026_q1
        |                                |                                |  MASTER_KEY_mk_2026_q2 (current)
        |                                | pgp_sym_decrypt(...) → plaintext
        |                                | INSERT market_credentials_audit (event='decrypt')
        |                                |                                |
        |  <--- { access_token, ... } ---|                                |
        |                                |                                |
        | call market API with token     |                                |
        | (메모리 변수 즉시 폐기)        |                                |
```

- **필수**: 복호화 RPC 는 `SECURITY DEFINER` + `service_role` only. RPC 내부에서 호출자가 service_role 인지 명시 검증 (`auth.role() = 'service_role'`).
- **필수**: 복호 결과 평문은 Edge Function 의 단일 함수 스코프에만 존재. 외부 변수·캐시·전역 상태 저장 금지.
- **금지**: 복호화 RPC 를 Postgres view 로 expose 금지. RPC (함수) 만 허용 — view 는 RLS bypass 경로가 의도치 않게 열릴 위험.

### 4.3 RPC 정의 (참고 시그니처)

```sql
CREATE OR REPLACE FUNCTION public.fn_encrypt_and_store_credential(
  p_seller_id          uuid,
  p_market_id          text,
  p_account_label      text,
  p_access_token       text,
  p_refresh_token      text,
  p_expires_at         timestamptz,
  p_scope              text[],
  p_master_key         text,    -- Edge Function 에서 env 로 전달
  p_kid                text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- service_role 검증
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'fn_encrypt_and_store_credential: service_role required';
  END IF;

  INSERT INTO public.market_credentials (
    seller_id, market_id, market_account_label,
    encrypted_access_token, encrypted_refresh_token,
    token_expires_at, ciphertext_kid, scope
  ) VALUES (
    p_seller_id, p_market_id, p_account_label,
    pgp_sym_encrypt(p_access_token, p_master_key),
    pgp_sym_encrypt(p_refresh_token, p_master_key),
    p_expires_at, p_kid, p_scope
  )
  ON CONFLICT (seller_id, market_id, market_account_label)
  DO UPDATE SET
    encrypted_access_token  = EXCLUDED.encrypted_access_token,
    encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
    token_expires_at        = EXCLUDED.token_expires_at,
    ciphertext_kid          = EXCLUDED.ciphertext_kid,
    scope                   = EXCLUDED.scope,
    status                  = 'active',
    last_refresh_at         = now(),
    last_refresh_error      = NULL,
    refresh_failure_count   = 0,
    rotated_at              = now()
  RETURNING id INTO v_id;

  INSERT INTO public.market_credentials_audit (credential_id, seller_id, event, kid_used, actor)
  VALUES (v_id, p_seller_id, 'encrypt_store', p_kid, 'service_role');

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_encrypt_and_store_credential FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_encrypt_and_store_credential TO service_role;
```

복호화 RPC `fn_decrypt_credential(p_credential_id uuid, p_master_key text)` 도 동일 패턴으로 정의. `auth.role() = 'service_role'` 가드 + audit insert 필수.

---

## 5. 키 회전 (마스터 키)

### 5.1 키 식별자 규약

- **필수**: 마스터 키 식별자(`ciphertext_kid`) 형식 = `mk_<year>_<quarter>` (예: `mk_2026_q2`).
- **필수**: 한 시점에 최대 **2개** 키 양립 (current + previous). 3개 이상 양립 금지 — 회전 완료 후 즉시 구 키 폐기.
- **필수**: Edge Function env 변수명 = `MASTER_KEY_<KID>` (예: `MASTER_KEY_mk_2026_q2`). 추가로 `MASTER_KEY_CURRENT_KID` 환경 변수에 현재 KID 명시.

### 5.2 회전 절차 (정기 — 분기 1회)

1. 새 키 생성: 256-bit 랜덤 (`openssl rand -base64 32`). 새 KID 부여 (예: `mk_2026_q3`).
2. GitHub Secrets 에 `MASTER_KEY_mk_2026_q3` 추가 (debug / real 각각 별도).
3. Edge Function 재배포 — 두 키 모두 env 에 존재. `MASTER_KEY_CURRENT_KID` 는 아직 구 KID.
4. 신규 저장(INSERT/UPDATE) 만 새 KID 로 전환 (`MASTER_KEY_CURRENT_KID` 갱신 + 재배포).
5. 백그라운드 잡: 구 KID row 를 새 KID 로 재암호화 (`fn_rotate_credential_kid(credential_id, from_kid, to_kid)`).
   - 잡은 한 번에 N row 씩 배치, 트랜잭션 단위로 실패 재시도 가능.
   - 진행 상황은 `market_credentials_audit` 에 `event='rekey'` 로 기록.
6. 전수 재암호화 완료 확인: `SELECT count(*) FROM market_credentials WHERE ciphertext_kid <> 'mk_2026_q3'` = 0.
7. 구 키 GitHub Secrets 에서 삭제 + Edge Function env 재배포.

### 5.3 회전 절차 (긴급 — 사고 대응)

- **필수**: 마스터 키 유출 의심 시 §9 사고 대응 runbook 발동. 정기 회전 절차의 (3) ~ (7) 을 압축 실행.
- **필수**: 긴급 회전 동안 신규 OAuth 콜백·refresh 는 **즉시 새 KID 로 저장**. 기존 row 재암호화는 백그라운드.
- **금지**: 긴급 회전 중 모든 토큰을 평문으로 한 번에 export 후 재암호화 금지 — 평문 노출 윈도우가 사고를 확대한다. 반드시 row 단위 트랜잭션으로 read → decrypt → encrypt → write 한다.

### 5.4 키 분실 대응

- **금지**: 구 KID 의 키를 GitHub Secrets 에서 삭제하기 전, `SELECT count(*) WHERE ciphertext_kid = old_kid` = 0 검증을 누락 금지. 검증 누락 시 해당 row 는 복호 영구 불가 → 셀러 재인증 강제.
- **필수**: 키 분실 시 §9 사고 대응 (3) 셀러 재인증 통보 절차로 fallback.

---

## 6. 토큰 회전 (OAuth refresh)

### 6.1 자동 갱신 트리거

- **필수**: 만료 **10분 전** 시점에 백그라운드 갱신 트리거. Edge Function 스케줄 (Supabase cron) + 마켓 API 호출 직전 lazy 갱신 양 경로 모두 가동.
- **필수**: 갱신은 §4.1 의 저장 흐름과 동일 — refresh token 으로 새 access/refresh token 받아서 `fn_encrypt_and_store_credential` UPSERT.
- **필수**: 갱신 도중 (1) 마켓 API 호출 시점에 만료 발생 방지 — 마켓 API 호출 직전 RPC `fn_decrypt_credential` 이 `token_expires_at < now() + 60s` 면 동기 갱신 후 토큰 반환.

### 6.2 갱신 실패 처리

- **필수**: 마켓 OAuth refresh 호출 실패 시:
  1. `market_credentials.last_refresh_error` 에 **마스킹된 오류 코드만** 기록 (예: `invalid_grant`, `network_timeout`). raw response body 저장 금지.
  2. `refresh_failure_count` += 1.
  3. `market_credentials_audit` 에 `event='refresh_failed'` 로 기록.
- **필수**: `refresh_failure_count >= 3` 시 `status = 'refresh_failed'` 로 전환. 클라이언트 마켓 연결 상태 화면(user_flow.md s5 n31) 에 "재인증 필요" 상태 노출.
- **필수**: `invalid_grant` (refresh token revoke 됨) 응답 시 즉시 `status = 'revoked'` + `revoked_at = now()`. 셀러에게 마켓 재연결 유도 (s5 n29 신규 연결 화면).

### 6.3 user_flow.md s5 연결

- 정상 갱신: 셀러 화면 변화 없음. 백그라운드 진행.
- `refresh_failed`: s5 n31 "연결 상태 확인" 노드에서 "재인증 필요" 뱃지 + 재인증 버튼 노출.
- `revoked`: s5 n29 신규 연결 흐름 강제 — 기존 row 는 `revoked` 상태로 audit 보존, 신규 row 로 재연결.

---

## 7. 로그·Sentry 처리

### 7.1 금지 키 화이트리스트

`security.md` §7 의 마스킹 룰을 본 문서에서 다시 명시 (필수 의무).

- **금지** (로그·Sentry breadcrumb·event body·tag·extra 어디에도 포함 금지):
  - `access_token`, `refresh_token`, `id_token`, `code` (OAuth authorization code)
  - `encrypted_access_token`, `encrypted_refresh_token` (ciphertext 도 금지 — 키 유출 시 복호 가능)
  - `master_key`, `MASTER_KEY_*` env 변수 값
  - `client_secret`, `api_key`, `Authorization` 헤더
- **허용**:
  - `correlationId`, `jobId`, `credentialId` (UUID)
  - `sellerId` (UUID, `auth.users.id`)
  - `market` (예: `naver`)
  - `tokenLen` (토큰 평문 길이 — 디버깅용. 평문 자체 아님)
  - `kid` (마스터 키 식별자 — 키 자체 아님, 라우팅용)
  - `event` (`encrypt_store` / `decrypt` / `refresh_failed` / `rekey` / `revoke`)

### 7.2 마스킹 검증

- **필수**: Sentry SDK 초기화 시 `beforeSend` 훅에서 금지 키 자동 마스킹. event 전체 JSON 을 재귀 순회하여 키 이름 매칭 시 `[MASKED]` 치환.
- **필수**: CI 파이프라인에 `grep -E '(access_token|refresh_token|master_key)' src/ supabase/functions/` 가 코드 베이스에서 의도되지 않은 토큰 변수 노출이 없는지 검증. Edge Function 로깅 호출의 첫 번째 인자 객체 키도 ESLint 룰로 검출 시도 (security 가 룰 작성).
- **금지**: `console.log(credential)` `console.log({ ...credential, encrypted_access_token })` 같이 객체 통째 출력 금지. 명시적 화이트리스트 키만 추출하여 출력.

### 7.3 외부 API 로깅 패턴 적용

`CLAUDE.md` "외부 API 로깅 패턴" 의 의무 형식:

```ts
logger.info({ market: 'naver', method: 'POST', url, sellerId, correlationId }, '→ market request');
logger.info({ market: 'naver', status, tokenLen: token.length }, '← market response');
logger.error({ market: 'naver', err: maskError(e), correlationId }, '← market error');
```

- **필수**: `maskError(e)` 는 error message 에서 토큰 패턴(`Bearer\s+\S+`, 길이 ≥ 32 의 영숫자 시퀀스) 을 자동 마스킹 후 반환. 구현 위치 = `supabase/functions/_shared/mask.ts` (Phase 2 에서 신설).

---

## 8. 백업·복구

### 8.1 백업 시 보호

- **필수**: Supabase Postgres 자동 백업 (`pg_dump` / Point-in-Time Recovery) 산출물에는 `market_credentials.encrypted_*` 컬럼이 ciphertext 상태로만 존재. 평문 컬럼 (`last_refresh_error` 등) 도 마스킹된 오류 코드만 포함.
- **필수**: 마스터 키는 GitHub Secrets 에만 존재. DB 백업 매체와 **물리적으로 분리**. 백업 매체 단독 유출 시 복호 불가능 — CV-T2 1차 통제.
- **금지**: 백업 산출물을 평문 토큰으로 복호하여 별도 저장소에 보관 금지. 어떤 분석·디버그 목적이라도 평문 export 금지.

### 8.2 백업 매체 접근 통제

- **필수**: Supabase 대시보드 백업 다운로드 권한은 architect + security 만 보유. 다른 운영자 접근 차단.
- **필수**: 백업 다운로드는 audit 대상. Supabase 의 access log 를 분기 1회 검토.

### 8.3 복구 절차

1. Supabase Point-in-Time Recovery 또는 백업 복원 → DB 복원 완료.
2. 마스터 키 (`MASTER_KEY_<KID>`) 가 GitHub Secrets 에 존재하는지 확인. 누락 시 복호 불가 — §5.4 분실 대응.
3. Edge Function 재배포 (env 재주입).
4. 복구 직후 `SELECT count(*) FROM market_credentials WHERE status = 'active'` 정상치 확인.
5. 샘플 1건에 대해 `fn_decrypt_credential` 호출 → 복호 성공 확인. 실패 시 즉시 §9 사고 대응.
6. `market_credentials_audit` 에 `event='recovery_verified'` 로 운영자가 수동 기록.

### 8.4 키와 데이터 분리 보관 (절대 원칙)

- **금지**: 마스터 키와 DB 백업을 같은 매체·같은 클라우드 계정·같은 권한 부여 대상에 보관 금지.
- **필수**: 키 = GitHub Secrets (Anthropic 외부, GitHub 권한 분리). 데이터 백업 = Supabase 프로젝트 (debug / real 별도). 두 매체의 접근 권한자가 **다른 사람**.

---

## 9. 사고 대응

### 9.1 토큰 유출 의심 시나리오

- DB 백업 매체 유출 가능성 보고
- Edge Function 로그·Sentry event 에서 평문 토큰 흔적 발견
- 마스터 키 GitHub Secrets 접근 권한자 변동
- 셀러로부터 "내 마켓 계정에서 부정 등록 발견" 신고
- 마켓 측 보안팀으로부터 비정상 API 호출 패턴 통보

### 9.2 runbook (T+0 ~ T+24h)

| 시점 | 액션 | 책임 |
|---|---|---|
| T+0 | 사고 보고 채널에 등록. `incident-YYYYMMDD-NN` 식별자 부여. | security |
| T+5m | 마스터 키 **즉시 회전** (§5.3 긴급 회전). 신규 KID 생성·GitHub Secrets 등록·Edge Function 재배포. | security + architect |
| T+15m | 영향 범위 평가: 유출 의심 시점·접근 가능 매체·KID 사용 row 수 산정. | security |
| T+30m | 모든 `status='active'` 자격증명을 **강제 `status='refresh_failed'` 전환** + audit insert. 다음 마켓 API 호출 시 재인증 유도. (정책 결정 — 영향 범위에 따라 부분 적용 가능) | security |
| T+1h | 영향 받은 셀러에게 알림 — 마켓 재연결 안내 (s5 n29). 알림 채널은 v1 에 인앱 배너 + 이메일 (Supabase Auth 이메일). | architect + 운영 |
| T+4h | `market_credentials_audit` 분석 — 사고 발생 추정 시점 전후 의심 패턴 (대량 decrypt, 비정상 시간대 접근) 식별. | security |
| T+24h | 사고 보고서 작성 — 원인·영향·재발 방지. `docs/architecture/v1/ops/incidents/incident-YYYYMMDD-NN.md` 신설. | security + architect |

### 9.3 마스터 키 유출 vs 토큰 유출 구분

- **마스터 키 유출**: 키 회전만으로 부족 — 모든 ciphertext 가 구 키로 복호 가능. 전수 재암호화 + 영향 받은 모든 access_token revoke 시도 (마켓별 revoke endpoint 호출).
- **개별 토큰 유출**: 해당 row 만 `status='revoked'` + 셀러 재인증. 마스터 키 회전 불필요.
- **불분명 시**: 마스터 키 유출로 간주하여 보수적으로 대응.

### 9.4 금지 행위 (사고 대응 중)

- **금지**: 사고 대응 중 평문 토큰을 별도 저장소에 export 금지 (디버그 목적이라도).
- **금지**: 사고 보고서에 평문 토큰·복호 결과·마스터 키 값 포함 금지. 통계·KID·UUID 만 허용.
- **금지**: 단독 판단으로 회전 절차 생략 금지 — security + architect 양측 합의 필수.

---

## 10. 감사 로그

### 10.1 `market_credentials_audit` DDL

모든 자격증명 관련 이벤트를 append-only 로 기록. Edge Function 이 RPC 내부에서 직접 INSERT.

```sql
CREATE TABLE public.market_credentials_audit (
  id              bigserial PRIMARY KEY,
  credential_id   uuid REFERENCES public.market_credentials(id) ON DELETE SET NULL,
  seller_id       uuid NOT NULL,
  market_id       text,
  event           text NOT NULL
                  CHECK (event IN (
                    'encrypt_store',     -- 신규 저장 또는 갱신 UPSERT
                    'decrypt',           -- 복호화 (마켓 API 호출 직전)
                    'refresh_failed',    -- OAuth refresh 실패
                    'revoke',            -- 토큰 revoke (셀러 자발 또는 마켓 측 invalid_grant)
                    'rekey',             -- 마스터 키 회전 (재암호화)
                    'recovery_verified'  -- 백업 복구 후 검증 (수동)
                  )),
  kid_used        text,                  -- 해당 이벤트 시점 KID
  actor           text NOT NULL          -- 'service_role' | 'system_cron' | 'incident_response'
                  CHECK (actor IN ('service_role', 'system_cron', 'incident_response')),
  correlation_id  text,                  -- 요청 단위 추적 ID
  error_code      text,                  -- 마스킹된 오류 코드만. raw response 금지.
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX market_credentials_audit_credential_id_idx ON public.market_credentials_audit (credential_id);
CREATE INDEX market_credentials_audit_seller_id_idx    ON public.market_credentials_audit (seller_id);
CREATE INDEX market_credentials_audit_occurred_at_idx  ON public.market_credentials_audit (occurred_at DESC);
CREATE INDEX market_credentials_audit_event_idx        ON public.market_credentials_audit (event);

ALTER TABLE public.market_credentials_audit ENABLE ROW LEVEL SECURITY;
-- 정책 없음 — service_role only. 클라이언트 조회 차단.

COMMENT ON TABLE public.market_credentials_audit IS
  'service_role only. append-only. UPDATE / DELETE 금지 (trigger 로 차단).';
```

### 10.2 append-only 강제

```sql
CREATE OR REPLACE FUNCTION public.fn_block_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'market_credentials_audit is append-only. UPDATE/DELETE blocked.';
END;
$$;

CREATE TRIGGER market_credentials_audit_no_update
  BEFORE UPDATE ON public.market_credentials_audit
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_audit_mutation();

CREATE TRIGGER market_credentials_audit_no_delete
  BEFORE DELETE ON public.market_credentials_audit
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_audit_mutation();
```

- **필수**: audit 테이블은 INSERT 만 허용. UPDATE/DELETE 시도는 trigger 로 차단.
- **필수**: audit row 의 retention 은 **3년**. 분기 1회 백업 후 보존 매체 (외부 cold storage) 로 archive. archive 대상 row 는 `archived_at` 컬럼 추가 (v1.1 에서 컬럼 추가 마이그레이션).
- **금지**: audit 에 토큰 평문·암호문·API raw response 저장 금지. 메타데이터(UUID·KID·event·error_code) 만.

### 10.3 정기 검토

- **필수**: 분기 1회 security 가 다음 쿼리로 audit 검토:
  - `decrypt` 이벤트 비정상 폭증 (셀러당 평소 N배 이상)
  - 비정상 시간대 (KST 03:00 ~ 06:00) 의 decrypt
  - `refresh_failed` 누적 ≥ 5 인 자격증명 — 마켓 측 정책 변경 가능성
  - `rekey` 이벤트가 정기 회전 일정과 일치하는지
- **필수**: 검토 결과는 `docs/architecture/v1/ops/audit-reviews/YYYY-Q?.md` 로 보존 (Phase 3 신설 예정).

---

## 11. debug 모드 동등성

### 11.1 보안 경로 1:1 보장

- **필수**: debug Supabase 프로젝트도 동일 `market_credentials` DDL · 동일 RLS · 동일 pgcrypto 확장 · 동일 audit trigger 적용. 마이그레이션 SQL 은 단일 소스로 양 프로젝트에 적용.
- **필수**: debug 환경에서도 별도 `MASTER_KEY_<KID>` 를 GitHub Secrets (debug 스코프) 에 등록. real 환경 키와 **절대 동일값 사용 금지**.
- **필수**: debug 의 mock 어댑터가 발급하는 가짜 토큰도 동일 `fn_encrypt_and_store_credential` RPC 로 저장. mock 이라고 평문 저장 금지 — 실 경로 검증이 목적.

### 11.2 시크릿 격리 검증

- **필수**: CI 파이프라인의 빌드 모드 매트릭스에 다음 검증 추가:
  - debug 빌드 산출물에 real 프로젝트 URL/key 가 포함되지 않는지 grep
  - real 빌드 산출물에 debug 프로젝트 URL/key 가 포함되지 않는지 grep
  - GitHub Secrets 스코프가 environment 별로 분리되어 있는지 (debug environment / real environment)
- **금지**: 한 PR 에서 양 환경 시크릿을 동시에 export 금지. 환경별 PR 분리.

### 11.3 mock 토큰 폐기

- **필수**: debug 환경의 `market_credentials` row 는 **30일 retention**. 30일 초과 시 cron 으로 자동 삭제 + audit `event='revoke'` 기록.
- **필수**: real 환경의 자격증명은 셀러가 명시적으로 연결 해제하기 전까지 보존. 자동 삭제 정책 적용 금지.

---

## 12. 수락 기준 체크리스트 (PR 차단 기준)

본 문서 기반으로 작성되는 마이그레이션 / Edge Function PR 은 아래 항목을 **전부** 통과해야 머지 가능. security 가 거부권 행사.

- [ ] 1. `market_credentials` 테이블 DDL 이 본 문서 §3.1 과 일치 (컬럼·인덱스·제약·코멘트).
- [ ] 2. `market_credentials` RLS `ENABLE` + 정책 0개 (service_role only) 확인. 클라이언트 SDK 로 `select` 시도 시 0 row 반환 테스트 통과.
- [ ] 3. `fn_encrypt_and_store_credential` / `fn_decrypt_credential` RPC 가 `SECURITY DEFINER` + `auth.role() = 'service_role'` 가드 + `REVOKE ALL FROM PUBLIC, anon, authenticated` 적용.
- [ ] 4. `market_credentials_audit` DDL + append-only trigger 적용. UPDATE/DELETE 시도 시 RAISE 확인 테스트 통과.
- [ ] 5. 마스터 키 GitHub Secrets 에 KID 별로 등록 + Edge Function env 에 주입. real / debug 키 값 다른지 검증.
- [ ] 6. Sentry `beforeSend` 마스킹 룰에 §7.1 화이트리스트 적용. 자동 grep (`access_token` / `refresh_token` / `master_key` / `encrypted_*`) CI 통과.
- [ ] 7. `last_refresh_error` 에 raw response body 가 저장되지 않는지 단위 테스트 (의도된 마스킹 코드만 통과).
- [ ] 8. OAuth refresh 자동 갱신 (만료 10분 전) 스케줄 등록 + lazy 갱신 (60초 이내 만료 시) 경로 양쪽 테스트.
- [ ] 9. debug 프로젝트에 동일 마이그레이션·동일 audit·다른 마스터 키 적용 확인. mock 토큰도 평문 저장되지 않는지 단위 테스트.
- [ ] 10. 본 문서 §9 사고 대응 runbook 이 `docs/architecture/v1/ops/incident-runbook.md` 에 인용 또는 복제됨 (Phase 3 신설 시).

본 체크리스트는 `security.md` 의 보안 체크리스트와 **별도**로 적용된다. 두 체크리스트 모두 통과해야 자격증명 관련 PR 머지 가능.

---

## 부록 A. 참조 위협 매핑

| 통제 위치 | 차단 위협 ID |
|---|---|
| §3.2 RLS 정책 부재 | CV-T1, CV-T3 |
| §3.1 컬럼 암호화 (pgcrypto) | CV-T1, CV-T2 |
| §4 RPC + service_role 가드 | CV-T1, CV-T5 |
| §5 키 회전 + ciphertext_kid | CV-T6 |
| §6 토큰 자동 갱신·실패 처리 | CV-T7 |
| §7 로그·Sentry 마스킹 | CV-T4 |
| §8 백업·키 분리 보관 | CV-T2 |
| §9 사고 대응 runbook | CV-T1, CV-T6 |
| §10 audit append-only | CV-T3, CV-T5 |
| §11 debug 동등성 | (전 위협의 debug 진입점 차단) |

---

## 부록 B. 본 문서 외부 의존

본 문서가 인용하거나 의존하는 외부 산출물 목록. 이들 중 어느 하나라도 변경 시 본 문서 정합성 재검토 필수.

- `security.md` §1.3 위협 모델, §3 RLS, §7 로깅 마스킹
- `platform.md` Supabase 프로젝트 2개 분리 (debug / real)
- `testing.md` 보안 테스트 매트릭스 (RLS 우회 시도 / 마스킹 검증 / RPC 권한 가드)
- `CLAUDE.md` "외부 API 로깅 패턴" / "마켓 자격증명 저장" / "빌드 모드: debug / real"
- `PRD.md` §2.4 자격증명 암호화·정기 보안 감사·백업·복구
- `user_flow.md` s5 마켓 계정 (n29 신규 연결 / n31 연결 상태 확인)

**개정 이력은 본 문서가 아닌 git 로그를 ground truth 로 한다.**
