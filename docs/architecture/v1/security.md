# security.md — 보안 원칙 헌법 (v1)

> 본 문서는 다중 마켓 상품 자동 등록 SaaS 의 **보안 헌법**이다. 모든 후속 설계 문서(`credential-vault.md`, `features/auth.md`, `features/markets.md`, `features/registration.md` 등)는 본 문서를 인용·준수한다. 본 문서의 규칙은 "권장"이 아니라 **필수 / 금지 / 선택** 세 단계로만 표기한다. 모호한 어휘(괜찮음 / 가능하면 / 나중에)는 사용하지 않는다.
>
> **작성 책임**: security 에이전트 (INTJ, 15년차).
> **승인**: architect.
> **개정 절차**: 본 문서의 규칙 변경은 PR 단위로 security + architect 양측 승인 필수. 단독 수정 금지.
> **근거**: PRD §2.1 / §2.4, CLAUDE.md "인프라 결정" / "Rules" / "외부 API 로깅 패턴".

---

## 1. 목적·범위 + 위협 모델

### 1.1 목적

- 셀러 회원의 마켓 OAuth 자격증명·PII·등록 데이터의 **기밀성·무결성·가용성**을 보장한다.
- 한 셀러의 자격증명 유출이 다른 셀러로 전파되지 않도록 격리한다.
- debug 모드와 real 모드의 보안 경계를 명확히 분리한다.

### 1.2 범위

- **포함**: Supabase Auth, Postgres RLS, Edge Functions, Storage, 마켓 OAuth 토큰 보관·갱신, 프론트엔드 Sentry, GitHub Actions 시크릿, 감사 로그.
- **제외 (v2 이후)**: 2FA 강제, 결제·정산(PCI-DSS), 외부 분석 도구, SOC2 인증 절차.

### 1.3 위협 모델 (OWASP Top 10 + STRIDE 매핑)

| ID | 위협 | OWASP/STRIDE | 시나리오 | 영향 등급 |
|---|---|---|---|---|
| T1 | **마켓 OAuth 토큰 대량 유출** | A02 Cryptographic Failures / Information Disclosure | DB 백업 유출·SQLi·관리자 권한 남용으로 평문 토큰 노출 → 셀러 마켓 계정 전면 탈취 | 치명적 |
| T2 | **RLS 우회로 타 셀러 데이터 접근** | A01 Broken Access Control / Elevation of Privilege | RLS 미설정 테이블·service_role 키 유출·JWT 위조 | 치명적 |
| T3 | **로그·Sentry·에러 응답에 PII/토큰 노출** | A09 Logging Failures / Information Disclosure | Sentry breadcrumb·콘솔 로그·서버 응답 body 에 access_token 포함 | 높음 |
| T4 | **OAuth CSRF / Open Redirect** | A01 / Tampering | `state` 미검증, redirect_uri 화이트리스트 부재로 셀러 토큰을 공격자 콜백으로 회수 | 높음 |
| T5 | **debug → real 시크릿 교차 사용** | A05 Security Misconfiguration | CI 시크릿 스코프 잘못 설정으로 debug 빌드가 real Supabase 에 접속 | 높음 |

상기 5개 위협이 본 문서 전체 통제의 1차 근거다. 신규 통제 추가 시 어느 위협을 줄이는지 본 표에 매핑한다.

---

## 2. 인증 (Authentication)

### 2.1 Supabase Auth JWT 세션

- **필수**: 모든 셀러 인증은 Supabase Auth 발급 JWT 로만 한다. 자체 세션 발급 금지.
- **필수**: 클라이언트는 `@supabase/supabase-js` SDK 의 `auth.signInWithPassword` / `auth.signInWithOAuth` / `auth.signInWithOtp` 만 사용. raw HTTP 로 Auth endpoint 직접 호출 금지.
- **필수**: Auth flow 는 **PKCE** 로 고정. `implicit` flow 금지 (토큰이 URL fragment 로 노출됨).
- **필수**: `persistSession: true` (LocalStorage). "이 기기 기억하지 않기" 옵션 선택 시 `persistSession: false` 로 전환 — 메모리에만 보관, 탭 종료 시 폐기.
- **금지**: 토큰을 별도 쿠키·sessionStorage 에 복사 저장 금지. Supabase SDK 의 storage 인터페이스 외 경로 차단.

**근거**: PKCE 는 SPA 표준 OAuth 안전 흐름이고 implicit 는 IETF Best Current Practice (RFC 8252) 에서 폐지 권고됨.

### 2.2 세션 정책

- **필수**: JWT `expiry` = **1시간**. refresh token 회전(rotation) **활성화** (Supabase Auth 기본값 유지, 비활성화 금지).
- **필수**: refresh token TTL = **30일**. 사용되지 않으면 자동 만료.
- **필수**: 로그아웃은 `auth.signOut({ scope: 'global' })` 로 동시 발급된 모든 세션 무효화.
- **필수**: 비밀번호 변경·이메일 변경 시 기존 모든 세션 강제 무효화 후 재로그인 요구.

### 2.3 비밀번호 정책

- **필수**: 최소 길이 **10자**, 영문 대소문자 + 숫자 + 특수문자 중 **3종 이상** 혼합.
- **필수**: 알려진 유출 비밀번호(haveibeenpwned k-anonymity API) 차단. Supabase Auth 의 password leak protection 기능 **활성화**.
- **금지**: 비밀번호 평문을 메모리 덤프·로그·이벤트·analytics 어디에도 남기지 않음. RHF state 는 mount 동안만 유지, submit 직후 폼 reset.

### 2.4 소셜 로그인

- **필수**: provider 화이트리스트 — **Google / Kakao / Naver** 만. 그 외 provider 활성화는 본 문서 개정 절차로만 추가.
- **필수**: 각 provider 의 redirect_uri 는 debug / real 환경별로 별도 등록. 와일드카드 금지.
- **필수**: 첫 소셜 로그인 시 이메일 인증 상태가 provider 측에서 verified 인지 확인. 미인증이면 추가 이메일 인증 강제.

### 2.5 mock 모드 (debug) 인증 동등성

- **필수**: debug 모드도 Supabase Auth JWT 발급 경로를 그대로 사용. mock user 는 debug Supabase 프로젝트에 실제 등록된 계정.
- **금지**: `if (mode === 'debug') { user = MOCK_USER }` 형태로 Auth 우회 분기 금지. 보안 경로는 debug 에서도 1:1 검증된다.
- **근거**: debug 에서 우회된 경로는 real 에서 처음 실행되며, 그때 발견되는 결함은 셀러 데이터에 직접 영향.

---

## 3. 인가 (Authorization) + RLS 의무화

### 3.1 RLS 의무 원칙

- **필수**: 모든 신규 테이블은 생성과 **동시에** RLS `ENABLE` + 명시 정책(SELECT / INSERT / UPDATE / DELETE) 동봉. RLS 정책 없는 테이블 PR 은 **차단**.
- **필수**: 정책은 `seller_id = auth.uid()` 로 본인 데이터만 접근 가능하도록 작성.
- **금지**: `USING (true)` 같은 전체 허용 정책 금지. service_role 전용 테이블이면 RLS `ENABLE` + **모든 정책 부재** (= 정책 일치 row 0건이므로 anon/authenticated 차단) + 코멘트로 "service_role only" 명시.

### 3.2 표준 RLS 템플릿

신규 테이블 마이그레이션에는 아래 4개 정책을 기본 세트로 동봉한다. 컬럼명 `seller_id` 는 `auth.uid()` 와 직접 비교 가능한 `uuid` 타입.

```sql
-- 테이블 RLS 활성화
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 데이터만 조회
CREATE POLICY "products_select_own"
  ON public.products FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- INSERT: 본인 seller_id 로만 생성
CREATE POLICY "products_insert_own"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());

-- UPDATE: 본인 데이터만 수정, seller_id 변조 차단
CREATE POLICY "products_update_own"
  ON public.products FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- DELETE: 본인 데이터만 삭제
CREATE POLICY "products_delete_own"
  ON public.products FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid());
```

### 3.3 service_role 전용 테이블 (마켓 토큰 등)

- **필수**: `market_accounts`, `market_credentials`, `audit_log`, `registration_jobs_internal` 등 클라이언트가 직접 조회해선 안 되는 테이블은 RLS 활성화 + **authenticated/anon 정책 0개**.
- **필수**: Edge Function 은 `SUPABASE_SERVICE_ROLE_KEY` 로 접근. service_role 키는 Edge Function 환경변수에만 존재.
- **금지**: 프론트엔드 코드에서 service_role 키를 절대 import / 빌드 / 노출하지 않음. CI 빌드 후 `dist/` 산출물에 grep `SUPABASE_SERVICE_ROLE` → 0건 강제.

```sql
ALTER TABLE public.market_credentials ENABLE ROW LEVEL SECURITY;
-- 의도적으로 authenticated/anon 정책 없음.
-- service_role 만 접근. (Edge Function 경로: docs/architecture/v1/features/markets.md §토큰 갱신)
```

### 3.4 RLS 검증 의무

- **필수**: 신규 테이블 PR 에는 RLS 정책 테스트 (`pgtap` 또는 vitest + supabase test client) 1개 이상 동봉. "다른 셀러 데이터 SELECT 시 0건" 케이스 포함.
- **필수**: 정책 변경 시 위 테스트도 함께 갱신.

---

## 4. 마켓 자격증명 저장 (T1 대응)

### 4.1 대원칙

- **필수**: 마켓 OAuth `access_token`, `refresh_token`, API 키, 마켓 측 발급 시크릿은 **평문 저장 금지**. 컬럼 단위 암호화 후 저장.
- **필수**: 토큰 테이블은 §3.3 service_role 전용 접근.
- **금지**: 토큰을 디버그 목적으로라도 별도 테이블·뷰·로그·캐시에 복제하지 않음.

### 4.2 저장 방식 결정: pgcrypto vs Supabase Vault

| 항목 | pgcrypto (`pgp_sym_encrypt`) | Supabase Vault |
|---|---|---|
| 키 보관 | 마스터 키를 Edge Function 환경변수로 주입, 매 쿼리 시 전달 | Supabase 가 관리하는 KMS, 컬럼은 secret_id 참조 |
| 키 회전 | 수동 (re-encrypt 마이그레이션 직접 작성) | Vault 자체 회전 메커니즘 (베타 시점 기능셋 확인 필요) |
| 마이그레이션 의존 | pg extension `pgcrypto` 활성화만 필요 | Vault extension + 정책 추가 필요 |
| 검증된 패턴 | 광범위, 운영 사례 다수 | 비교적 신규, Supabase 자체 권장 흐름 |
| 키 노출 표면 | Edge Function env (Supabase 대시보드 + GitHub Secrets 미러링 시) | Vault 내부 (Supabase 인프라) |
| debug/real 분리 | 마스터 키 2개 (각 프로젝트 환경변수) | 각 프로젝트 Vault 자동 분리 |

**결정 (필수, v1)**: **pgcrypto 1차 채택** (`cross-cutting/credential-vault.md` §2 단일 출처 인용). 마스터 키는 Edge Function 환경변수 (`MASTER_KEY_<kid>`) 로 주입하고, `pgp_sym_encrypt` / `pgp_sym_decrypt` 로 컬럼 단위 암호화. **Supabase Vault 검토는 v2 백로그**로 보류 — v1 시점 Vault 기능셋(동적 재암호화·자동 회전 등) 검증 결과가 부족.

**근거**: (1) pgcrypto 는 광범위한 운영 사례·검증된 패턴이 있어 v1 신뢰성 확보에 유리. (2) 키 노출 표면(Edge Function env)은 §5.2 의 GitHub Secrets 미러링 금지 + Edge Function 시크릿 단일 보관으로 축소. (3) v2 에서 Vault 도입 시 동일 컬럼 위에 envelope 패턴(Vault 마스터 키 + pgcrypto 데이터 컬럼) 으로 점진 전환 가능 — credential-vault.md §2 가 마이그레이션 경로를 정의.

### 4.3 테이블 스키마

> **`market_credentials` DDL 은 `cross-cutting/credential-vault.md` §3 단일 출처**로 정의한다. 본 절은 보안 관점의 운영 제약만 명시.
>
> - RLS: authenticated / anon 정책 0개 — Edge Function `service_role` 만 접근 (§3.3).
> - 컬럼 암호화: `encrypted_access_token` / `encrypted_refresh_token` 은 `pgp_sym_encrypt` 결과 (`bytea`). `ciphertext_kid` 로 마스터 키 라우팅.
> - 인덱스: `token_expires_at` 기반 만료 조회 (사전 갱신 §4.4).
> - DDL 변경은 credential-vault.md 갱신 후 본 문서가 그 §번호를 인용한다.

### 4.4 토큰 회전 정책

- **필수**: refresh token 으로 access token 갱신은 만료 **5분 전** 사전 갱신. on-demand 갱신은 보조 경로.
- **필수**: 갱신 실패(invalid_grant, revoked) 시 해당 `market_credentials` row 의 상태를 `disconnected` 로 표기 + 셀러에게 재인증 유도 알림.
- **필수**: 갱신 실패는 §12 감사 로그에 기록 (PII 제외).
- **금지**: refresh token 으로 갱신 후 기존 refresh token 을 그대로 재사용 금지. 마켓이 회전된 refresh 를 발급하면 즉시 교체 저장.

### 4.5 마스터 키 회전

- **필수**: 마스터 키(또는 Vault 키)는 **연 1회** 회전. 회전 시 절차:
  1. 신키 K2 발급, Vault/환경변수에 추가 (구키 K1 병행 유지).
  2. 배경 작업으로 K1 으로 암호화된 row 를 K2 로 재암호화 (Edge Function cron).
  3. 100% 재암호화 검증 후 K1 폐기.
- **필수**: 회전 이력은 별도 `key_rotation_log` 테이블에 기록 (키 자체 미포함, ID와 타임스탬프만).
- **필수**: 사고 의심 시(§13) 비정기 즉시 회전.

---

## 5. 시크릿·환경변수 관리

### 5.1 분류표

| 시크릿 | 보관 위치 | 클라이언트 노출 | 비고 |
|---|---|---|---|
| `VITE_SUPABASE_URL` | GitHub Secrets → Vite build env | **노출 가능** | public anon endpoint |
| `VITE_SUPABASE_ANON_KEY` | GitHub Secrets → Vite build env | **노출 가능** | RLS 가 1차 방어선 |
| `VITE_SENTRY_DSN` | GitHub Secrets → Vite build env | **노출 가능** | DSN 자체는 공개되어도 무방 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 대시보드 Edge Function env | **금지** | 빌드 산출물 grep 0건 강제 |
| 마켓 OAuth client secret | Supabase 대시보드 Edge Function env | **금지** | 마켓별 분리 |
| 마켓 webhook signing key | Supabase 대시보드 Edge Function env | **금지** | |
| pgcrypto 마스터 키 (`MASTER_KEY_<kid>`) | Supabase Edge Function env | **금지** | §4.5 회전, v2 Vault 검토 시 envelope 패턴 |

### 5.2 분담 규칙

- **필수**: `VITE_*` prefix 가 붙은 환경변수만 클라이언트 번들에 포함. Vite 가 자동 prune.
- **필수**: Edge Function 시크릿은 Supabase 대시보드에만 입력. GitHub Secrets 와 미러링 금지(이중 보관은 누출 표면 2배).
- **금지**: `.env*` 파일 git 커밋. `.gitignore` 에 `.env`, `.env.*`, `!.env.example` 강제.
- **필수**: `.env.example` 에 키 이름만 기록, 값 부분은 빈 문자열.

### 5.3 debug / real Supabase 프로젝트 격리

- **필수**: debug / real 각각 **독립 Supabase 프로젝트**. URL·anon key·service_role key·Vault·Storage 버킷·RLS 정책 전부 분리.
- **필수**: GitHub Actions 워크플로우에서 시크릿 스코프 분리:
  - PR / develop 브랜치 워크플로우 → debug 시크릿만 접근.
  - main 브랜치 워크플로우 → real 시크릿만 접근.
- **금지**: 동일 workflow job 에서 두 환경 시크릿을 함께 노출하지 않음.
- **필수**: CI 시작 시 `${{ secrets.SUPABASE_URL }}` 이 어느 프로젝트인지 검증 단계(`echo "url=$VITE_SUPABASE_URL"` 로 호스트 prefix 만 출력) 포함.

**근거**: T5 위협 — 시크릿 교차 사용 시 debug 빌드가 real DB 에 접근하면 mock 데이터로 운영 DB 가 오염될 수 있음.

---

## 6. 로깅·관측 (Sentry beforeSend) — T3 대응

### 6.1 금지 키 화이트리스트

다음 키 이름은 로그·Sentry event·analytics 어디에도 **원본 값 그대로** 등장 금지:

```
access_token, refresh_token, id_token, accessToken, refreshToken, idToken,
apiKey, api_key, secret, client_secret, password, passwordConfirm,
email, phone, phoneNumber, name, fullName, realName,
businessNumber, businessRegistrationNumber, bankAccount, accountNumber,
authorization, Authorization, cookie, Cookie, set-cookie
```

대소문자·camelCase·snake_case 변형 모두 동일하게 마스킹한다.

### 6.2 마스킹 코드 (Edge Function / 프론트 공용)

```ts
// src/lib/security/redact.ts (프론트)
// supabase/functions/_shared/redact.ts (Edge)

const REDACT_KEYS = new Set([
  'access_token', 'refresh_token', 'id_token',
  'accesstoken', 'refreshtoken', 'idtoken',
  'apikey', 'api_key', 'secret', 'client_secret',
  'password', 'passwordconfirm',
  'email', 'phone', 'phonenumber',
  'name', 'fullname', 'realname',
  'businessnumber', 'businessregistrationnumber',
  'bankaccount', 'accountnumber',
  'authorization', 'cookie', 'set-cookie',
]);

const looksLikeJwt = (v: string) => /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v);

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[REDACT:depth]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (looksLikeJwt(value)) return `[REDACT:jwt:len=${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        if (typeof v === 'string') out[k] = `[REDACT:${k}:len=${v.length}]`;
        else out[k] = '[REDACT]';
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}
```

### 6.3 Sentry 초기화 시 강제

```ts
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';
import { redact } from '@/lib/security/redact';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_APP_MODE, // 'debug' | 'real'
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // request / response / extra / contexts / tags / breadcrumbs 전체 마스킹
    if (event.request) event.request = redact(event.request) as typeof event.request;
    if (event.extra) event.extra = redact(event.extra) as typeof event.extra;
    if (event.contexts) event.contexts = redact(event.contexts) as typeof event.contexts;
    if (event.tags) event.tags = redact(event.tags) as typeof event.tags;
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => ({
        ...b,
        data: b.data ? (redact(b.data) as typeof b.data) : b.data,
        message: b.message, // 메시지 자체는 코드 작성자 책임
      }));
    }
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data) {
      breadcrumb.data = redact(breadcrumb.data) as typeof breadcrumb.data;
    }
    return breadcrumb;
  },
});
```

- **필수**: 프론트엔드 `src/lib/sentry.ts` + Edge Function `supabase/functions/_shared/sentry.ts` **둘 다** 위 beforeSend 적용. 한쪽만 적용된 PR 차단.
- **필수**: 신규 키 이름이 등장하면 `REDACT_KEYS` 에 추가하는 PR 을 동반.
- **금지**: `console.log(token)` / `console.log(user)` 같은 원시 출력. ESLint `no-console` warn 으로 가시화.

### 6.4 구조화 로그 규약

CLAUDE.md "외부 API 로깅 패턴" 을 그대로 본 문서 규칙으로 승격한다.

```ts
logger.info({ market: 'naver', method: 'GET', url, sellerId, correlationId }, '→ market request');
logger.info({ market: 'naver', status, correlationId }, '← market response');
logger.error({ market: 'naver', err: maskError(e), correlationId }, '← market error');
```

- **필수**: 모든 외부 호출(마켓 API, Supabase RPC, Storage)에 `correlationId` (uuid v4, 요청 단위) 부여.
- **필수**: RegistrationJob 컨텍스트는 `jobId` 추가.
- **필수**: 식별 가능한 정보는 internal `sellerId` (UUID) 만. 마켓 측 셀러 ID·이메일·전화번호 금지.
- **필수**: 토큰은 길이만 (`tokenLength: 187`).

### 6.5 PII 원격 분석 차단

- **금지**: PostHog, Mixpanel, Amplitude, Google Analytics, Hotjar 등 외부 분석 SDK 도입. KPI 측정은 Supabase 테이블 + view 자체 집계(CLAUDE.md "MVP 범위 — KPI 측정").
- **근거**: 외부 분석 SDK 는 자동으로 URL · referrer · user_id 를 수집하며 마스킹 책임이 외부에 있음. PII 외부 노출 위험 0 정책 위배.

---

## 7. 외부 마켓 API 호출 (T4 대응)

### 7.1 호출 경로

- **필수**: 모든 마켓 API 호출은 Edge Function 에서만 수행. 클라이언트에서 마켓 API 직접 호출 **금지**.
- **근거**: (1) 시크릿(client_secret) 클라이언트 노출 회피, (2) CORS 문제 회피, (3) 토큰 평문 메모리 노출 회피, (4) 감사 로그 일관성.

### 7.2 OAuth state 검증 (CSRF 방지)

- **필수**: OAuth 시작 시 32 bytes 이상 난수 `state` 생성. `state` 는 서버측 단기 저장(Edge Function + Postgres `oauth_state` 테이블, TTL 10분) + httpOnly 쿠키 양쪽에 저장.
- **필수**: 콜백에서 두 값 일치 확인. 불일치 시 콜백 처리 거부 + §12 감사 로그.
- **필수**: `state` 사용 후 즉시 삭제 (replay 방지).

> **`oauth_state` DDL 은 `features/markets.md` §3 단일 출처**로 정의한다. 본 절은 보안 운영 제약 (TTL 10분, 1회 사용 후 삭제, RLS service_role only) 만 명시. DDL 변경은 features/markets.md 갱신 후 본 문서가 그 §번호를 인용한다.

### 7.3 redirect_uri 화이트리스트

- **필수**: redirect_uri 는 코드 상수로 명시. 동적 입력 금지.

```ts
const ALLOWED_REDIRECT_URIS: Record<'debug' | 'real', Record<Market, string>> = {
  debug: {
    naver:   'https://<debug-domain>/oauth/naver/callback',
    coupang: 'https://<debug-domain>/oauth/coupang/callback',
  },
  real: {
    naver:   'https://<real-domain>/oauth/naver/callback',
    coupang: 'https://<real-domain>/oauth/coupang/callback',
  },
};
```

- **필수**: 콜백 성공 후 프론트로 돌려보낼 `redirect_to` 도 화이트리스트(`/dashboard`, `/markets`, `/register` 등 내부 경로) 만. 외부 URL 금지 = Open Redirect 차단.

### 7.4 CORS

- **필수**: Edge Function 의 `Access-Control-Allow-Origin` 은 debug / real 별 프론트 도메인 1개씩 명시. `*` 금지.
- **필수**: `Access-Control-Allow-Credentials: true` 사용 시 origin 화이트리스트와 함께만.

### 7.5 마켓 webhook 검증

- **필수**: 마켓이 보내는 webhook 은 마켓별 signing key 로 HMAC 검증. 미검증 webhook 처리 금지.
- **필수**: 서명 검증 실패는 §12 감사 로그.

---

## 8. 데이터 보호 (PII)

### 8.1 PII 분류

| 등급 | 항목 | 저장 | 로그 | 화면 표시 |
|---|---|---|---|---|
| **민감 (Sensitive)** | 비밀번호 | Supabase Auth 해시 | 금지 | 금지 |
| **민감** | 마켓 access/refresh 토큰, API 키 | §4 암호화 | 금지 (길이만) | 금지 (마지막 4자만) |
| **개인식별 (PII)** | 이메일, 휴대전화, 사업자등록번호 | 평문 (RLS 보호) | **금지** | 본인 화면만 |
| **개인식별** | 사업장 주소, 정산 계좌 | 평문 (RLS 보호) | **금지** | 본인 화면만 |
| **준식별 (Quasi-PII)** | 마켓 측 셀러 ID (`external_seller_id`) | 평문 (RLS 보호) | **금지** | 본인 화면만 |
| **공개** | 상품명, 카테고리, 가격 | 평문 | 허용 | 허용 |

- **필수**: 민감/개인식별 컬럼은 §6.1 마스킹 키 목록에 1:1 매핑.
- **금지**: PII 컬럼을 `events` (행동 분석) 테이블에 복제하지 않음. events 는 `seller_id` UUID + 이벤트 타입 + 시각만.

### 8.2 PII 표시 시 마스킹

- **필수**: UI 에서 PII 표시 시 본인 화면에서도 부분 마스킹 옵션 제공:
  - 이메일: `j***@example.com`
  - 휴대전화: `010-****-1234`
  - 사업자등록번호: `123-**-*****`

### 8.3 백업·복구

- **필수**: Supabase 자동 백업 활성화. 백업 보존 7일 (debug) / 30일 (real).
- **필수**: 백업 파일도 §4 암호화된 토큰 상태로 보존(평문 export 금지).
- **필수**: PII 컬럼은 별도 export 시 토큰화(`hash(seller_id + salt)`) 또는 제외. 분석 목적 export 는 PII 제거 후만 허용.

### 8.4 삭제·탈퇴 (Right to be forgotten)

- **필수**: 셀러 탈퇴 시 `auth.users` 삭제 → CASCADE 로 모든 본인 데이터 삭제(테이블 설계 시 `ON DELETE CASCADE` 강제).
- **필수**: 마켓 토큰은 탈퇴 즉시 해당 마켓 측 revoke API 호출. revoke 실패해도 자체 row 삭제 진행.
- **필수**: 감사 로그(§12)는 보존(법적 의무 가능성). PII 컬럼만 비식별화(`sha256(seller_id)`) 후 보존.

---

## 9. debug 모드 보안 동등성

- **필수**: debug 에서도 (1) Supabase Auth JWT, (2) RLS, (3) 토큰 암호화 저장, (4) Sentry beforeSend, (5) OAuth state 검증 — 5개 경로 모두 그대로 적용.
- **금지**: `if (mode === 'debug')` 가드로 보안 통제를 비활성화하는 분기. 통제는 데이터 소스(mock vs real)와 독립.
- **필수**: mock 마켓 어댑터도 access/refresh 토큰 형태(JWT 또는 opaque string)를 동일하게 발급·갱신. 만료 시뮬레이션 포함.

**근거**: debug 에서 우회된 통제는 real 에서 처음 실행. 그때 발견되는 결함은 운영 셀러의 데이터에 직접 영향.

---

## 10. Supabase Auth 정책

### 10.1 비밀번호

§2.3 참조. Supabase Auth Dashboard 설정:

- Password Policy: minimum length 10, require letters / numbers / symbols.
- HaveIBeenPwned password check: **ON**.

### 10.2 이메일 인증

- **필수**: 신규 가입 시 이메일 인증 강제 (`email_confirm = required`). 미인증 사용자는 로그인 차단.
- **필수**: 이메일 변경 시 신/구 양쪽 이메일에 확인 발송 (Supabase 기본 동작 유지).

### 10.3 비밀번호 재설정

- **필수**: 재설정 토큰 TTL 1시간. 사용 후 즉시 무효.
- **필수**: 재설정 후 모든 기존 세션 무효화.

### 10.4 Rate limiting

- **필수**: Auth endpoint 에 Supabase 기본 rate limit 적용. 초과 시 429 응답.
- **선택**: IP 기반 fail2ban 패턴은 v2 검토.

### 10.5 소셜 로그인 provider

§2.4 참조. Google / Kakao / Naver 만.

---

## 11. 세션·CSRF·XSS·SQLi 표준 대응

### 11.1 CSRF

- **필수**: Supabase Auth 는 토큰 기반(JWT in Authorization header) → 전통적 쿠키 CSRF 표면 없음. Edge Function 도 `Authorization: Bearer <jwt>` 검증.
- **필수**: OAuth 콜백 등 cookie 사용 경로(§7.2 state cookie)는 `SameSite=Lax` + `HttpOnly` + `Secure`.

### 11.2 XSS

- **필수**: React 의 기본 escape 의존. `dangerouslySetInnerHTML` 사용은 PR 사유 명시 + DOMPurify 통과 후만.
- **필수**: 상품 상세 HTML(PRD §3.6, v2) 사용자 입력은 서버측 sanitize 후 저장. raw HTML 저장 금지.
- **필수**: CSP 헤더 — `default-src 'self'`, `script-src 'self' https://browser.sentry-cdn.com`, `connect-src 'self' https://*.supabase.co https://sentry.io <market-domains>`. inline-script 금지(Vite 기본 산출물 호환).

### 11.3 SQLi

- **필수**: Postgres 접근은 Supabase JS / Edge Function 의 parameterized query 만 사용. raw string 연결로 SQL 생성 금지.
- **금지**: 사용자 입력을 RPC 함수에 raw text 로 흘리면서 `EXECUTE` 로 동적 SQL 실행 금지.

### 11.4 의존성 취약점

- **필수**: PR CI 단계에 `pnpm audit --prod --audit-level high` 통과 강제. high 이상 0건.
- **필수**: 주 1회 Dependabot 또는 Renovate 로 보안 패치 PR 자동 생성.

---

## 12. 감사 로그 (Audit Log)

### 12.1 적재 대상 이벤트

| 카테고리 | 이벤트 | 필수 필드 |
|---|---|---|
| Auth | login_success / login_failure / logout / password_reset / password_change / email_change | seller_id, ip_hash, user_agent_hash, at |
| Auth | session_revoked_global | seller_id, reason, at |
| Market | market_connected / market_disconnected / market_token_refresh_failed | seller_id, market, reason?, at |
| Registration | registration_job_started / registration_job_succeeded / registration_job_failed | seller_id, job_id, market_count, at |
| Security | rls_denied (DB trigger) / oauth_state_mismatch / webhook_signature_failure | seller_id?, market?, detail, at |
| Account | seller_signup / seller_deleted | seller_id, at |

### 12.2 스키마

```sql
CREATE TABLE public.audit_log (
  id          bigserial PRIMARY KEY,
  category    text NOT NULL,
  event       text NOT NULL,
  seller_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash     text,          -- sha256(ip + daily_salt). 원본 IP 미저장.
  ua_hash     text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- PII / 토큰 포함 금지
  at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- service_role 만 INSERT. authenticated 는 본인 row 만 SELECT (`seller_id = auth.uid()`) 허용.
CREATE POLICY "audit_select_own"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

CREATE INDEX idx_audit_seller_at ON public.audit_log (seller_id, at DESC);
CREATE INDEX idx_audit_category_at ON public.audit_log (category, at DESC);
```

### 12.3 보존 기간

- **필수**: Auth / Security 카테고리 = **2년**.
- **필수**: Market / Registration 카테고리 = **1년**.
- **필수**: 보존 기간 경과 시 익명화(`seller_id` 해시화) 후 통계용 보관 또는 삭제. 결정은 운영 시점에 architect 합의.

### 12.4 무결성

- **필수**: audit_log 는 **append-only**. UPDATE / DELETE 정책 부재 = 모든 클라이언트 차단.
- **선택**: 월별 파티션 + 파티션 단위 해시체인은 v2 검토.

---

## 13. 사고 대응 (Incident Response)

### 13.1 사고 등급

| 등급 | 정의 | 예시 |
|---|---|---|
| SEV-1 | 마켓 토큰 평문 유출 / 다중 셀러 데이터 무단 접근 확인 | DB 백업 유실, service_role 키 유출 |
| SEV-2 | 단일 셀러 데이터 무단 접근 의심 / RLS 정책 결함 | 특정 셀러 데이터가 다른 셀러에게 노출 |
| SEV-3 | 의존성 취약점 / 설정 미스 (실 피해 미확인) | high CVE 노출 |

### 13.2 SEV-1 절차 (토큰 유출 의심)

1. **즉시 (T+0)**: real Supabase service_role 키 회전. 모든 Edge Function 환경변수 재배포.
2. **T+5분**: 모든 마켓 OAuth 토큰을 마켓 측 revoke API 일괄 호출 (Edge Function 잡). 실패한 row 는 `disconnected` 상태로 표기.
3. **T+10분**: Vault 마스터 키 회전(§4.5).
4. **T+15분**: 영향받은 셀러 전원에게 알림 (인앱 + 이메일) — "재인증 필요".
5. **T+30분**: 감사 로그·Sentry 에서 시점 전후 1시간 이벤트 dump → security 분석.
6. **T+24시간**: 원인 보고서(`docs/architecture/v1/incidents/<date>-<slug>.md`) 작성, architect / security 공동 서명.

### 13.3 SEV-2 절차

- RLS 정책 즉시 재검토 + 결함 테이블 일시 service_role 전용으로 회수. 패치 PR + RLS 테스트 추가 후 복구.

### 13.4 SEV-3 절차

- 24시간 내 패치 PR. 운영 영향 없으면 정규 배포 흐름.

### 13.5 알림 흐름

- **필수**: SEV-1 / SEV-2 발생 시 즉시 architect + security 알림. 외부 공지(셀러)는 영향 확정 후 24시간 이내.
- **금지**: 사고 사실 은폐. 영향 범위 미확정 상태라도 내부 알림은 즉시.

---

## 14. 보안 검수 체크리스트 (PR 게이트)

신규 기능 PR 머지 전 본 체크리스트 통과 필수. 한 항목이라도 미통과 시 **차단**.

```
## docs/architecture/v1/security-checklist.md
- [ ] 1.  Supabase Auth 세션이 PKCE flow 로 발급 — implicit 미사용 확인
- [ ] 2.  모든 신규 테이블에 RLS 정책 SQL 동봉 + service_role 전용 경로는 사유 명시
- [ ] 3.  마켓 OAuth access/refresh 토큰이 pgcrypto 컬럼 암호화 (`credential-vault.md` §2/§3) 로 저장 (v2 Vault envelope 도입 시 갱신)
- [ ] 4.  로그·에러 응답·Sentry event 에 토큰/PII 미노출 — `pnpm grep:secrets` 자동 검사 통과
- [ ] 5.  Sentry beforeSend / beforeBreadcrumb 가 프론트 + Edge Function 양쪽에 적용
- [ ] 6.  OAuth state + redirect_uri 화이트리스트 적용 (debug / real 분리)
- [ ] 7.  Auth 실패 / 마켓 연결·해제 / 토큰 갱신 실패가 audit_log 에 기록됨
- [ ] 8.  CORS 가 명시된 origin 만 허용 (`*` 금지)
- [ ] 9.  `pnpm audit --audit-level high` 0건 통과
- [ ] 10. debug / real Supabase 프로젝트 시크릿 격리 확인 (CI 워크플로우 스코프 점검)
- [ ] 11. 새 PII 컬럼 추가 시 §8.1 분류표·§6.1 마스킹 키 목록 갱신
- [ ] 12. debug 모드에서 보안 통제 우회 분기 부재 (`if (mode === 'debug')` 가드로 인증/RLS 우회 없음)
```

### 14.1 자동화 가능 항목

- 4번: 빌드 산출물 `dist/` + Edge Function 빌드물에 대해 `service_role`, `eyJ`(JWT prefix) 등 grep 0건 강제 — `pnpm grep:secrets` 스크립트.
- 9번: `pnpm audit` 을 CI 단계로.
- 10번: CI 시작 시 `VITE_SUPABASE_URL` 호스트 prefix 가 브랜치와 매칭되는지 검증.
- 12번: ESLint custom rule 또는 grep 으로 `mode === 'debug'` 근처 `bypass|skip|disable.*auth|disable.*rls` 패턴 차단.

### 14.2 수동 검토 항목

- 1, 2, 3, 5, 6, 7, 8, 11 — security 에이전트 직접 검토. PR 코멘트로 통과/차단 명시.

---

## 15. 본 문서 인용 가이드 (후속 설계용)

- `docs/architecture/v1/features/auth.md` → §2, §10, §12.
- `docs/architecture/v1/features/markets.md` → §4, §7, §12, §13.
- `docs/architecture/v1/features/registration.md` → §6, §12.
- `docs/architecture/v1/cross-cutting/credential-vault.md` → §4 전체.
- `docs/architecture/v1/cross-cutting/observability.md` → §6.
- `docs/architecture/v1/ops/incident-response.md` → §13.

각 후속 문서는 본 문서 섹션 번호를 명시 인용(`security.md §4.2`)하고, 본 문서 규칙과 충돌할 경우 본 문서가 우선한다.

---

## 16. 개정 이력

| 일자 | 버전 | 변경 | 작성 |
|---|---|---|---|
| 2026-05-18 | v1.0 | 최초 작성. PRD §2.1 / §2.4, CLAUDE.md 인프라 결정 반영. | security |
