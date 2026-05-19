# features/auth.md — s1 인증 종합 설계 (v1)

> 본 문서는 다중 마켓 상품 자동 등록 SaaS 의 **s1 인증** 도메인 종합 설계문서다. 데이터 모델·API·UI 흐름·zod 스키마·수락 기준을 단일 파일로 묶는다.
>
> **작성 책임**: ing-backend (오너) + security (검수) + frontend (UI) + designer (와이어) + qa (수락 기준).
> **승인**: architect.
> **상위 인용**:
>   - `docs/architecture/v1/platform.md` §2.2 (Supabase Auth JWT), §4 (debug/real 모드), §5 (프로젝트 분리).
>   - `docs/architecture/v1/security.md` §2 (인증), §10 (Supabase Auth 정책), §12 (감사 로그), §14 (PR 게이트).
>   - `docs/architecture/v1/frontend.md` §2.3 (user_flow → URL 매핑), §7 (RHF + zod), §9 (4상태), §11 (에러 경계).
>   - `docs/architecture/v1/ui-system.md` §7 (shadcn 카탈로그), §8 (ErrorMessage).
>   - `docs/architecture/v1/testing.md` §3 (골든 패스 G1), §4 (수락 기준 매트릭스 양식), §5 (실패 시나리오 강제).
>   - `docs/architecture/v1/cross-cutting/credential-vault.md` §1 (위협 CV-T4), §11 (debug 동등성).
>   - `docs/architecture/v1/cross-cutting/registration-job-state.md` (간접 참조 — 로그인 후 진입점).
> **근거**: PRD §2.1.1 (회원가입), §2.1.2 (로그인), §2.1.5 (비밀번호 재설정), §2.1.4 (세션 관리), CLAUDE.md "MVP 범위 (v1) — s1 인증".
> **개정 절차**: 본 문서 §2 (데이터 모델), §4 (보안 통제) 변경은 security + architect 양측 승인 필수. UI 와이어·문구는 designer + frontend 합의로 충분.

---

## 1. 목적·범위 + user_flow 매핑

### 1.1 목적

- 셀러가 **이메일/비밀번호 또는 소셜 OAuth** 로 가입·로그인할 수 있는 흐름을 v1 에 한정해 정의한다.
- Supabase Auth 의 JWT 세션을 단일 ground truth 로 두고, 자체 세션·자체 비밀번호 해싱·자체 토큰 발급을 도입하지 않는다.
- 모든 인증 동선이 `security.md` §2 / §10 / §12 의 헌법을 위반 없이 흐르도록 보장한다.

### 1.2 범위

- **포함 (v1)**: 이메일 회원가입(이메일 인증 포함), 이메일/비밀번호 로그인, 소셜 로그인 (Google / Kakao / Naver), 비밀번호 재설정, 세션 정책, `sellers` 확장 테이블, 감사 로그.
- **제외 (v2 이후)**: 2FA (PRD §2.1.3 명시 보류), SSO/SAML, "이 기기 기억하지 않기" 토글 UI (정책은 정의하되 v1 화면 미노출), captcha (Supabase Auth rate limit 으로 1차 방어), 비밀번호 만료 정책.

### 1.3 user_flow.md s1 노드 매핑표

| 노드 | 이름 | 본 문서 §  | 라우트 | 비고 |
|---|---|---|---|---|
| n1 | 시작 (앱 진입) | §6.1 부트스트랩 | `/` | 세션 존재 시 `/dashboard`, 없으면 `/login` |
| n2 | 로그인 화면 | §6.2 | `/login` | 이메일/소셜 탭 UI |
| n3 | 이메일 로그인 | §3.2 | `/login` (탭) | `signInWithPassword` |
| n4 | 소셜 로그인 | §3.3 | `/login` (탭) + provider redirect | `signInWithOAuth` (PKCE) |
| n5 | 회원가입 화면 | §6.3 | `/signup` | `signUp` + 이메일 인증 |
| n6 | 비밀번호 찾기 | §6.4 | `/forgot-password` | `resetPasswordForEmail` |
| n7 | 비밀번호 재설정 (메일 콜백) | §6.5 | `/reset-password` (`?token=...&type=recovery`) | `updateUser({ password })` |
| n8 | 대시보드 진입 | (s2 책임) | `/dashboard` | 본 문서 종착점. s2 문서로 인계 |

라우트 prefix·404 fallback 은 `frontend.md` §2.2 를 따른다. URL 검증은 §5.4 의 zod 스키마로 강제.

---

## 2. 데이터 모델 (Postgres)

### 2.1 활용 / 신설 테이블 요약

| 테이블 | 위치 | 책임 | 본 문서가 신설? |
|---|---|---|---|
| `auth.users` | Supabase Auth 관리 영역 | 이메일·비밀번호 해시·이메일 인증 상태·소셜 provider 연결 | **신설 안 함** (Supabase 제공) |
| `public.sellers` | 본 도메인 | `auth.users` 1:1 확장. 표시명·사업자 유형·마지막 활동·마케팅 동의 | **신설** |
| `public.auth_audit_log` | 본 도메인 | 인증 이벤트 감사 로그 (login_success / failure / password_change 등) | **신설** (security.md §12 `audit_log` 의 Auth 카테고리 전용 view 대신 별도 테이블로 분리 — 보존 기간·정책이 다르므로) |

> **`security.md` §12 `audit_log` 와의 관계**: `security.md` 가 정의한 `public.audit_log` 는 **전 카테고리 (Auth / Market / Registration / Security / Account) 통합 테이블**이다. 본 문서 §2.4 의 `auth_audit_log` 는 **그 통합 테이블의 카테고리 = `auth` row 만 적재**하는 단일 진실원으로 사용한다. 즉 별도 테이블을 추가하지 않고, `audit_log` 를 그대로 쓰되 Auth 카테고리 적재 패턴을 본 문서가 명시한다. (혼동 방지를 위해 본 문서에서는 "`audit_log` (auth 카테고리)" 로 통일 표기.)

### 2.2 `public.sellers` DDL

`auth.users` 는 Supabase 가 관리하는 스키마이므로 직접 컬럼 추가가 위험하다. `public.sellers` 가 1:1 확장이며 `id` 가 `auth.users.id` 외래키.

```sql
-- supabase/migrations/<ts>_create_sellers.sql

CREATE TABLE public.sellers (
  id                   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name         text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  business_type        text NOT NULL CHECK (business_type IN ('individual','sole_proprietor','corporation','undecided')) DEFAULT 'undecided',
  marketing_consent    boolean NOT NULL DEFAULT false,
  marketing_consent_at timestamptz,
  last_active_at       timestamptz NOT NULL DEFAULT now(),
  signup_provider      text NOT NULL CHECK (signup_provider IN ('email','google','kakao','naver')) DEFAULT 'email',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sellers IS
  's1 인증 도메인. auth.users 1:1 확장. PII (email/phone) 는 auth.users 에만 존재.';

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sellers_touch
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
```

#### 2.2.1 RLS 정책 (본인만 SELECT/UPDATE)

```sql
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 행만
CREATE POLICY "sellers_select_self"
  ON public.sellers FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- INSERT: 클라이언트 직접 INSERT 금지 — 트리거(§3.1)로만 생성.
-- 정책 부재 = anon/authenticated 차단. service_role 만 INSERT 가능 (트리거가 SECURITY DEFINER 로 우회).

-- UPDATE: 본인 행만, id / signup_provider / created_at 변경 금지
CREATE POLICY "sellers_update_self"
  ON public.sellers FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- signup_provider, created_at 변조는 트리거에서 차단 (§2.2.2)
  );

-- DELETE: 클라이언트 직접 DELETE 금지. 탈퇴는 auth.users DELETE → CASCADE.
-- 정책 부재 = 모든 role 차단.
```

#### 2.2.2 변조 방지 트리거

```sql
CREATE OR REPLACE FUNCTION public.sellers_protect_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'sellers.id is immutable';
  END IF;
  IF NEW.signup_provider IS DISTINCT FROM OLD.signup_provider THEN
    RAISE EXCEPTION 'sellers.signup_provider is immutable';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'sellers.created_at is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sellers_protect_immutable
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.sellers_protect_immutable();
```

### 2.3 `auth.users` → `public.sellers` 자동 동기화 트리거

회원가입 직후 `public.sellers` row 가 누락되면 모든 후속 도메인 RLS (`products`, `market_accounts`) 가 외래키 무결성 위반 또는 빈 화면을 발생시킨다. Auth signup 이벤트에서 즉시 행을 생성한다.

```sql
-- supabase/migrations/<ts>_seller_signup_trigger.sql

CREATE OR REPLACE FUNCTION public.handle_new_seller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name    text;
  v_signup_provider text;
  v_marketing       boolean;
BEGIN
  -- raw_user_meta_data 는 클라이언트가 signUp 시 options.data 로 전달한 값.
  -- 신뢰할 수 없는 입력이므로 길이·타입 제한.
  v_display_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    split_part(NEW.email, '@', 1)
  );
  v_display_name := left(v_display_name, 60);

  v_signup_provider := COALESCE(NEW.raw_app_meta_data ->> 'provider', 'email');
  IF v_signup_provider NOT IN ('email','google','kakao','naver') THEN
    v_signup_provider := 'email';
  END IF;

  v_marketing := COALESCE((NEW.raw_user_meta_data ->> 'marketing_consent')::boolean, false);

  INSERT INTO public.sellers (id, display_name, signup_provider, marketing_consent, marketing_consent_at)
  VALUES (
    NEW.id,
    v_display_name,
    v_signup_provider,
    v_marketing,
    CASE WHEN v_marketing THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;  -- 멱등성 보장 (소셜 재로그인 등 중복 트리거 안전)

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_seller();
```

**제약 (필수)**:
- 함수는 `SECURITY DEFINER`. `search_path = public` 명시 (search_path 변조 공격 방어).
- `raw_user_meta_data` 는 **클라이언트 입력** 이므로 길이·enum 검증 후만 채택.
- `ON CONFLICT (id) DO NOTHING` — 동일 user 가 두 번 트리거되는 경우(소셜 재로그인 등) 행 덮어쓰기 금지.

### 2.4 감사 로그 (`audit_log` Auth 카테고리)

`security.md` §12 의 `audit_log` 테이블을 그대로 사용. 본 도메인이 적재하는 이벤트 명세:

| event | 트리거 위치 | meta 필수 키 | 보존 기간 (security.md §12.3) |
|---|---|---|---|
| `auth.login_success` | Edge Function `auth-event-log` (클라이언트가 로그인 성공 시 호출) 또는 Postgres `auth.audit_log_entries` mirror | `{ provider: 'email'|'google'|'kakao'|'naver' }` | 2년 |
| `auth.login_failure` | 동일 | `{ reason: 'invalid_credentials'|'email_not_confirmed'|'rate_limited'|'unknown' }` | 2년 |
| `auth.logout` | 클라이언트 signOut 직후 | `{ scope: 'global'|'local' }` | 2년 |
| `auth.password_reset_requested` | resetPasswordForEmail 직후 | `{}` (email 은 hash 만 — §4.3) | 2년 |
| `auth.password_reset_completed` | updateUser({password}) 성공 후 | `{}` | 2년 |
| `auth.password_change` | 로그인 상태에서 비밀번호 변경 (v2 화면) | `{}` | 2년 |
| `auth.email_change_requested` | (v2) | `{}` | 2년 |
| `auth.session_revoked_global` | signOut({scope:'global'}) 직후 | `{ reason: 'user'|'password_change'|'security' }` | 2년 |
| `auth.seller_signup` | `handle_new_seller` 트리거 내부 | `{ provider }` | 2년 |
| `auth.seller_deleted` | auth.users DELETE 트리거 | `{}` (id 만 보존, 메타 비식별화) | 2년 |
| `auth.oauth_state_mismatch` | (해당 없음 — 본 도메인은 Supabase Auth 가 state 관리. 마켓 OAuth 는 markets 도메인.) | — | — |

> **금지**: `meta` 에 평문 email / IP / user_agent / token 적재. IP / UA 는 §4.3 의 hash 로만.

### 2.5 ER 다이어그램 (ASCII)

```
┌────────────────────┐         1:1          ┌──────────────────────┐
│  auth.users        │ ───────────────────→ │  public.sellers      │
│  (Supabase 관리)   │  trigger              │  id (= auth.uid)     │
│  - id (uuid)       │                       │  display_name        │
│  - email           │                       │  business_type       │
│  - encrypted_pw    │                       │  marketing_consent   │
│  - email_confirmed │                       │  last_active_at      │
│  - raw_user_meta   │                       │  signup_provider     │
│  - raw_app_meta    │                       │  created_at / upd_at │
└─────────┬──────────┘                       └──────────┬───────────┘
          │                                             │
          │                                             │
          │ ON DELETE CASCADE                           │ ON DELETE CASCADE
          │                                             │
          ▼                                             ▼
┌────────────────────────────────────────────────────────────────────┐
│  public.audit_log (security.md §12)                                │
│  - category = 'auth'                                               │
│  - event ∈ {login_success, login_failure, logout, ...}             │
│  - seller_id (FK auth.users.id ON DELETE SET NULL)                 │
│  - ip_hash / ua_hash / meta jsonb                                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. 인증 흐름

### 3.1 이메일 회원가입 흐름

```
┌─ 화면 /signup ──────────────────────────────────┐
│  display_name / email / password / confirm     │
│  + 마케팅 수신 동의 (선택)                       │
│  + 이용약관 동의 (필수, v1 한 묶음)               │
│                                                │
│  ▼ submit (RHF + zod resolver)                 │
└───────────────────┬────────────────────────────┘
                    │
                    ▼
        supabase.auth.signUp({
          email, password,
          options: {
            data: { display_name, marketing_consent },
            emailRedirectTo: `${origin}/auth/callback?type=signup`
          }
        })
                    │
                    ▼
        Supabase Auth:
        - email 형식·중복 검증
        - password 정책 검증 (security.md §2.3: 10자+, 3종 혼합, HIBP)
        - email_confirm 메일 발송 (TTL 24h)
        - auth.users INSERT → trigger handle_new_seller → sellers INSERT
                    │
                    ▼
        화면 전환: "이메일 인증 안내" (인박스 확인 요청)
        + audit_log: auth.seller_signup
                    │
                    ▼ (사용자 메일에서 링크 클릭)
        브라우저 → `${origin}/auth/callback?type=signup&token_hash=...`
                    │
                    ▼
        supabase.auth.verifyOtp({ type: 'signup', token_hash })
                    │
                    ▼
        성공 → 세션 발급 + /dashboard 리다이렉트
        실패 (만료/오용) → /login + ErrorMessage "인증 링크가 만료되었습니다"
```

**필수 통제**:
- `emailRedirectTo` 는 §4.2 의 화이트리스트 origin 만. 와일드카드 금지.
- 비밀번호 정책 위반은 Supabase 가 400 + `weak_password` 코드 반환. UI 에서는 §7 매핑표로 한국어화.
- 이메일 인증 미완료 사용자의 로그인 시도는 401 + `email_not_confirmed`. `/login` 에서 "인증 메일 재전송" 버튼 노출.

### 3.2 이메일/비밀번호 로그인 흐름

```
/login → signInWithPassword({ email, password })
  ├─ 200 success:
  │    - 세션 발급 (JWT 1h, refresh 30d, rotation ON)
  │    - audit_log: auth.login_success { provider: 'email' }
  │    - sellers.last_active_at = now() (frontend mutation 또는 RPC)
  │    - /dashboard 리다이렉트 (또는 ?redirectTo 값 — §4.2 화이트리스트)
  ├─ 400 invalid_credentials:
  │    - audit_log: auth.login_failure { reason: 'invalid_credentials' }
  │    - ErrorMessage "이메일 또는 비밀번호가 올바르지 않습니다"
  ├─ 400 email_not_confirmed:
  │    - audit_log: auth.login_failure { reason: 'email_not_confirmed' }
  │    - ErrorMessage + "인증 메일 재전송" 버튼
  └─ 429 too_many_requests:
       - audit_log: auth.login_failure { reason: 'rate_limited' }
       - ErrorMessage "잠시 후 다시 시도해주세요" + Retry-After 카운트다운
```

### 3.3 소셜 로그인 흐름 (Google / Kakao / Naver)

```
/login 탭 "소셜 로그인" → provider 버튼 클릭
  → supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback?type=oauth`,
        skipBrowserRedirect: false,
        queryParams: { access_type: 'offline', prompt: 'consent' } // provider 별 옵션
      }
    })
  → 브라우저가 provider authorize URL 로 이동 (PKCE flow)
  → 사용자가 provider 에서 동의
  → provider → `${origin}/auth/callback?type=oauth&code=...&state=...`
  → 콜백 페이지에서 supabase.auth.exchangeCodeForSession(code)
     ├─ 성공:
     │    - 신규 사용자: auth.users INSERT → handle_new_seller 트리거 → sellers 행 생성 (signup_provider=provider)
     │    - 기존 사용자: 세션만 갱신
     │    - audit_log: auth.login_success { provider }
     │    - /dashboard 또는 ?redirectTo
     ├─ 실패 (사용자 거부):
     │    - audit_log: auth.login_failure { reason: 'oauth_denied' }
     │    - /login + ErrorMessage "소셜 로그인이 취소되었습니다"
     └─ 실패 (provider email unverified):
          - audit_log: auth.login_failure { reason: 'oauth_email_unverified' }
          - /login + ErrorMessage "이메일 인증이 완료된 소셜 계정만 사용 가능합니다"
```

**필수 통제 (security.md §2.4)**:
- Provider 화이트리스트: `google` / `kakao` / `naver` 만. 그 외 provider 활성화 PR 차단.
- `redirectTo` 는 debug / real 별 화이트리스트 origin 만. 와일드카드 금지.
- Provider 응답의 `email_verified === true` 인지 확인. 미인증이면 가입 차단.
- Supabase Auth flow 는 **PKCE** 고정 (`auth.flowType = 'pkce'`). implicit 금지.

### 3.4 비밀번호 재설정 흐름

```
[1] /forgot-password
    → 이메일 입력 → supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`
      })
    → 200 항상 (이메일 존재 여부 노출 금지 — §4.4)
    → audit_log: auth.password_reset_requested
    → 화면: "재설정 메일을 발송했습니다 (수신함을 확인하세요)"

[2] (사용자 메일에서 링크 클릭)
    → `${origin}/reset-password#access_token=...&type=recovery&...`
    (Supabase 의 recovery 링크는 URL fragment 로 토큰 전달 — supabase-js 가 자동 감지)
    → /reset-password 화면이 로드되며 supabase-js 가 recovery 세션 자동 수립
    → 단, 이 세션은 password 변경 외 다른 작업 금지 (UI 가드)

[3] /reset-password
    → 새 비밀번호 / 확인 입력 (RHF + zod)
    → supabase.auth.updateUser({ password: newPassword })
    → 성공:
        - audit_log: auth.password_reset_completed
        - signOut({ scope: 'global' }) (security.md §10.3: 재설정 후 모든 기존 세션 무효화)
        - audit_log: auth.session_revoked_global { reason: 'password_change' }
        - /login + 성공 토스트 "비밀번호가 변경되었습니다. 다시 로그인해주세요."
    → 실패 (토큰 만료):
        - ErrorMessage "재설정 링크가 만료되었습니다. 다시 요청해주세요"
        - /forgot-password 로 안내
```

**필수 통제**:
- recovery 토큰 TTL = 1시간 (security.md §10.3).
- 재설정 후 **모든** 기존 세션 무효화 (다른 기기 포함).
- `/reset-password` 화면에서는 recovery 세션 외 기능 노출 금지 (대시보드 진입·다른 mutation 차단).

### 3.5 세션 정책

| 항목 | 값 | 출처 |
|---|---|---|
| Auth flow | **PKCE** | security.md §2.1 |
| JWT 만료 | 1시간 | security.md §2.2 |
| Refresh token TTL | 30일 (미사용 시 자동 만료) | security.md §2.2 |
| Refresh token rotation | **ON** (비활성화 금지) | security.md §2.2 |
| `persistSession` | 기본 `true` (LocalStorage) | security.md §2.1 |
| Storage 위치 | Supabase SDK 의 storage 인터페이스 (LocalStorage) | security.md §2.1 |
| 로그아웃 scope | `global` (모든 세션 일괄 무효) | security.md §2.2 |
| 비밀번호 변경 후 세션 처리 | 모든 기존 세션 강제 무효 | security.md §2.2 |
| 자동 로그아웃 (Idle) | **v1 미구현** — refresh token 미사용 30일 만료에 위임 | 본 문서 결정 |
| "기기 기억하지 않기" 토글 | v1 화면 미노출 — 코드는 supabase client 옵션으로 지원 가능하나 UI 보류 | 본 문서 결정 |

#### Supabase client 초기화 (단일 ground truth)

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});
const env = envSchema.parse(import.meta.env);

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',                 // implicit 금지
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,         // OAuth/recovery 콜백 자동 처리
    storageKey: 'mc.auth',            // 토큰 storage 키 명시
  },
});
```

---

## 4. 보안 통제 (security.md / credential-vault.md 인용)

### 4.1 비밀번호 정책 (security.md §2.3 / §10.1)

- 최소 길이 **10자**.
- 영문 대소문자 / 숫자 / 특수문자 **3종 이상** 혼합.
- HaveIBeenPwned k-anonymity 검사 — Supabase Auth dashboard 옵션 ON.
- 비밀번호 평문은 RHF state 에 mount 동안만. submit 직후 `reset()` 강제.
- ESLint 검토: `password` 변수의 console.log / Sentry capture 차단 (custom rule 또는 `no-console`).

### 4.2 redirect URL 화이트리스트

`supabase.auth.signUp({ emailRedirectTo })`, `signInWithOAuth({ redirectTo })`, `resetPasswordForEmail(_, { redirectTo })` 의 redirect URL 은 다음 화이트리스트만 허용. 코드 상수.

```ts
// src/features/auth/lib/redirect-allowlist.ts
import { APP_MODE } from '@/lib/mode';

const ALLOWED_ORIGINS: Record<'debug' | 'real', readonly string[]> = {
  debug: ['https://<debug-domain>'],
  real:  ['https://<real-domain>'],
};

const ALLOWED_INTERNAL_PATHS = ['/dashboard', '/markets', '/register', '/history'] as const;

export function buildAuthRedirect(path: '/auth/callback' | '/reset-password'): string {
  const origin = ALLOWED_ORIGINS[APP_MODE][0];
  if (!origin) throw new Error('No allowed origin configured');
  return `${origin}${path}`;
}

export function safeRedirectTo(input: string | null | undefined): string {
  if (!input) return '/dashboard';
  // 외부 URL 차단 — open redirect 방지
  if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('//')) {
    return '/dashboard';
  }
  const ok = ALLOWED_INTERNAL_PATHS.some((p) => input === p || input.startsWith(`${p}/`));
  return ok ? input : '/dashboard';
}
```

### 4.3 감사 로그 IP / UA 처리

- IP 원본 / User-Agent 원본 **DB 저장 금지**.
- `ip_hash = sha256(ip + daily_salt)` / `ua_hash = sha256(ua + daily_salt)`.
- `daily_salt` 는 Edge Function 환경변수에서 1일마다 회전 — 동일 IP 도 다음 날 다른 hash. 추적성·익명성 균형.
- 적재 Edge Function: `supabase/functions/auth-event-log/index.ts` (요청 body 의 event + meta 만 받고, IP/UA 는 `req.headers` 에서 추출 후 즉시 hash 후 적재).

### 4.4 enumeration 방지

- `/forgot-password` 에서 이메일 존재 여부를 응답으로 노출 금지. 항상 "메일을 발송했습니다" 화면.
- 회원가입 시 "이미 가입된 이메일" 케이스도 Supabase 가 동일 응답 메시지를 반환할 수 있으나, 본 화면에서는 **이미 가입 이메일**이 즉시 화면 노출되어 enumeration 위협이 됨. v1 결정 — Supabase 의 "이미 가입된 이메일" 응답은 다음과 같이 처리:
  - 화면에는 "입력하신 이메일로 안내 메일을 발송했습니다 (이미 가입된 경우 로그인 안내 메일이 전송됩니다)" 단일 문구로 노출.
  - 서버 응답에는 `audit_log: auth.signup_attempted_existing_email` 로 별도 적재 (악용 패턴 감시).

### 4.5 mock / debug 보안 동등성 (security.md §2.5 / §9)

- debug 모드도 (1) PKCE flow, (2) RLS, (3) Supabase Auth JWT 발급, (4) Sentry beforeSend, (5) 이메일 인증 강제 — **5경로 모두 우회 금지**.
- debug 프로젝트의 mock 셀러는 실제 Supabase Auth 에 등록된 계정. 코드에 하드코딩된 `MOCK_USER` 분기 금지.
- 단, debug 프로젝트는 Supabase Auth dashboard 에서 "이메일 인증 자동 confirm" 옵션을 켤 수 있다 (실제 SMTP 미연동 시). 이는 **데이터 소스 차이**이지 코드 분기가 아니므로 허용.

### 4.6 토큰 / 세션 마스킹 (security.md §6.1)

- Sentry breadcrumb / 로그에서 `access_token`, `refresh_token`, `password`, `email`, `phone` 키 마스킹은 `src/lib/security/redact.ts` (security.md §6.2) 가 일괄 처리.
- 본 도메인에서 추가로 마스킹 필요한 키: `display_name` 은 PII 등급 (security.md §8.1) 으로는 **공개 가까운 준식별** — 로그 허용. 단 외부 분석 SDK 송출은 금지.

---

## 5. 클라이언트 zod 스키마 (`src/lib/schemas/auth.ts`)

### 5.1 공통 헬퍼

```ts
// src/lib/schemas/auth.ts
import { z } from 'zod';

// security.md §2.3 비밀번호 정책
const passwordPolicy = z
  .string()
  .min(10, '비밀번호는 10자 이상이어야 합니다')
  .max(72, '비밀번호는 72자 이하여야 합니다') // bcrypt 한계
  .refine(
    (v) => {
      const kinds = [
        /[a-z]/.test(v),
        /[A-Z]/.test(v),
        /[0-9]/.test(v),
        /[^A-Za-z0-9]/.test(v),
      ].filter(Boolean).length;
      return kinds >= 3;
    },
    { message: '영문 대소문자 / 숫자 / 특수문자 중 3종 이상을 혼합해주세요' },
  );

const emailField = z
  .string()
  .min(1, '이메일을 입력해주세요')
  .email('올바른 이메일 형식이 아닙니다')
  .max(255);

const displayNameField = z
  .string()
  .trim()
  .min(1, '표시 이름을 입력해주세요')
  .max(60, '표시 이름은 60자 이하여야 합니다');
```

### 5.2 폼 스키마

```ts
// 회원가입
export const SignUpFormSchema = z
  .object({
    email: emailField,
    password: passwordPolicy,
    passwordConfirm: z.string(),
    displayName: displayNameField,
    marketingConsent: z.boolean().default(false),
    termsAgreed: z.literal(true, {
      errorMap: () => ({ message: '이용약관 동의가 필요합니다' }),
    }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다',
  });
export type SignUpForm = z.infer<typeof SignUpFormSchema>;

// 로그인
export const SignInFormSchema = z.object({
  email: emailField,
  password: z.string().min(1, '비밀번호를 입력해주세요'),
  // 비밀번호 정책은 신규 가입 시점만 강제. 로그인 시 강제하면 정책 강화 전 가입자가 로그인 불가.
});
export type SignInForm = z.infer<typeof SignInFormSchema>;

// 비밀번호 재설정 요청
export const ForgotPasswordFormSchema = z.object({
  email: emailField,
});
export type ForgotPasswordForm = z.infer<typeof ForgotPasswordFormSchema>;

// 비밀번호 재설정 완료
export const ResetPasswordFormSchema = z
  .object({
    password: passwordPolicy,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다',
  });
export type ResetPasswordForm = z.infer<typeof ResetPasswordFormSchema>;
```

### 5.3 도메인 객체 스키마 (서버 응답 검증)

```ts
// public.sellers 행
export const SellerSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1).max(60),
  businessType: z.enum(['individual', 'sole_proprietor', 'corporation', 'undecided']),
  marketingConsent: z.boolean(),
  marketingConsentAt: z.string().datetime().nullable(),
  lastActiveAt: z.string().datetime(),
  signupProvider: z.enum(['email', 'google', 'kakao', 'naver']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Seller = z.infer<typeof SellerSchema>;

// Supabase Auth 세션 (supabase-js 가 제공하는 타입의 부분집합을 우리가 신뢰하는 형태로 재정의)
export const SessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(), // unix seconds
  tokenType: z.literal('bearer'),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
    emailConfirmedAt: z.string().datetime().nullable(),
    appMetadata: z.object({
      provider: z.string().optional(),
      providers: z.array(z.string()).optional(),
    }),
  }),
});
export type Session = z.infer<typeof SessionSchema>;
```

### 5.4 URL search params 검증

```ts
// /reset-password 진입 시 URL 검증 (Supabase 가 fragment 로 토큰 전달)
export const ResetPasswordUrlSchema = z.object({
  type: z.literal('recovery'),
  access_token: z.string().min(1).optional(), // supabase-js 가 자동 처리하므로 우리는 type 만 확인
});

// /auth/callback?type=signup&token_hash=...
export const AuthCallbackQuerySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('signup'), token_hash: z.string().min(1) }),
  z.object({ type: z.literal('oauth'), code: z.string().min(1) }),
  z.object({ type: z.literal('recovery') }),
]);
```

### 5.5 Edge Function 시그니처

본 도메인은 **Supabase Auth SDK 직접 호출이 1순위**다. Edge Function 은 다음 1개만 신설:

#### `auth-event-log` (POST)

```ts
// supabase/functions/auth-event-log/index.ts (시그니처만)

// request (zod)
const AuthEventRequestSchema = z.object({
  event: z.enum([
    'auth.login_success',
    'auth.login_failure',
    'auth.logout',
    'auth.password_reset_requested',
    'auth.password_reset_completed',
    'auth.session_revoked_global',
    'auth.signup_attempted_existing_email',
  ]),
  meta: z.record(z.unknown()).default({}),
  correlationId: z.string().uuid(),
});

// response 200
const AuthEventResponseSchema = z.object({
  logged: z.literal(true),
});

// response 4xx/5xx
// { code: 'invalid_request'|'rate_limited'|'internal', message: string }
```

- **인증**: 호출 시 `Authorization: Bearer <user_jwt>` 가 있으면 `seller_id = auth.uid()`. 없으면 (예: signup 직전 failure) `seller_id = null` + email_hash 만 meta 로 기록 (email 자체 금지).
- **rate limit**: 동일 `seller_id` (또는 IP hash) 당 분당 60건. 초과 시 429.
- **service_role** 로 `audit_log` INSERT (anon/authenticated 정책 부재 — security.md §12.2).

---

## 6. UI 흐름 — 화면별

### 6.1 부트스트랩 (`/`)

```
세션 확인 (supabase.auth.getSession())
├─ session 존재 + email_confirmed: → /dashboard
├─ session 존재 + email_confirmed 미완료: → /login + 토스트 "이메일 인증을 완료해주세요"
├─ session 없음: → /login
└─ 네트워크 오류: → ErrorBoundary (frontend.md §11.2)
```

라우터: React Router v6 `loader` 에서 처리. `frontend.md` §2 / §11 참조.

### 6.2 `/login` — 로그인 화면

#### shadcn 매핑

| 영역 | 컴포넌트 |
|---|---|
| 카드 컨테이너 | `<Card>` |
| 탭 (이메일 / 소셜) | `<Tabs>` |
| 입력 | `<Input>` (label 동반 `<Label>`) |
| 제출 버튼 | `<Button variant="default">` (실행류) |
| 보조 링크 (비밀번호 찾기 / 회원가입) | `<Button variant="link">` |
| 에러 표시 | `<ErrorMessage>` (ui-system.md §8) |
| 로딩 | `<Button disabled>` + `<Spinner>` |
| 토스트 | `<Toaster>` (shadcn sonner) |

#### 데스크탑 와이어 (1200px+)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                                                                          │
│                  ┌──────────────────────────────────────────┐            │
│                  │            [ MarketCast 로고 ]            │            │
│                  │                                          │            │
│                  │   다중 마켓 상품 자동 등록 SaaS           │            │
│                  │                                          │            │
│                  │  ┌────────────────┬───────────────────┐  │            │
│                  │  │  이메일 로그인  │   소셜 로그인       │  │            │
│                  │  └────────────────┴───────────────────┘  │            │
│                  │                                          │            │
│                  │   이메일                                  │            │
│                  │   ┌──────────────────────────────────┐   │            │
│                  │   │ you@example.com                  │   │            │
│                  │   └──────────────────────────────────┘   │            │
│                  │                                          │            │
│                  │   비밀번호                                │            │
│                  │   ┌──────────────────────────────────┐   │            │
│                  │   │ ••••••••••                       │👁│   │            │
│                  │   └──────────────────────────────────┘   │            │
│                  │                                          │            │
│                  │   [ ! 이메일 또는 비밀번호가 ... ]         │            │
│                  │                                          │            │
│                  │   ┌──────────────────────────────────┐   │            │
│                  │   │           로그인                   │   │            │
│                  │   └──────────────────────────────────┘   │            │
│                  │                                          │            │
│                  │     비밀번호를 잊으셨나요?  |  회원가입    │            │
│                  └──────────────────────────────────────────┘            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

소셜 로그인 탭:

```
                  ┌──────────────────────────────────────────┐
                  │   ┌──────────────────────────────────┐   │
                  │   │  [G]  Google 로 계속하기           │   │
                  │   └──────────────────────────────────┘   │
                  │   ┌──────────────────────────────────┐   │
                  │   │  [K]  Kakao 로 계속하기            │   │
                  │   └──────────────────────────────────┘   │
                  │   ┌──────────────────────────────────┐   │
                  │   │  [N]  Naver 로 계속하기            │   │
                  │   └──────────────────────────────────┘   │
                  │                                          │
                  │  소셜 계정으로 가입 시 이용약관 / 개인정보  │
                  │  처리방침에 동의한 것으로 간주됩니다.       │
                  └──────────────────────────────────────────┘
```

#### 모바일 와이어 (~767px)

```
┌────────────────────────────┐
│                            │
│      [ MarketCast 로고 ]    │
│                            │
│  ┌──────────────────────┐  │
│  │ 이메일 │ 소셜 로그인  │  │
│  └──────────────────────┘  │
│                            │
│  이메일                     │
│  ┌──────────────────────┐  │
│  │ you@example.com      │  │
│  └──────────────────────┘  │
│                            │
│  비밀번호                   │
│  ┌──────────────────────┐  │
│  │ ••••••••••         👁│  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │       로그인          │  │
│  └──────────────────────┘  │
│                            │
│  비밀번호 찾기 | 회원가입   │
│                            │
└────────────────────────────┘
```

- 입력 폭 = 100% - 16px padding. 터치 타겟 ≥ 44×44px (`ui-system.md` §6.2).
- "비밀번호 표시" 토글은 `aria-pressed` + `aria-label="비밀번호 표시"` / `"비밀번호 숨김"` 전환.

### 6.3 `/signup` — 회원가입 화면

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  ┌──────────────────────────────────────────┐            │
│                  │            [ MarketCast 로고 ]            │            │
│                  │                                          │            │
│                  │           회원가입                         │            │
│                  │                                          │            │
│                  │   표시 이름                                │            │
│                  │   ┌──────────────────────────────────┐   │            │
│                  │   │                                  │   │            │
│                  │   └──────────────────────────────────┘   │            │
│                  │                                          │            │
│                  │   이메일                                  │            │
│                  │   ┌──────────────────────────────────┐   │            │
│                  │   │                                  │   │            │
│                  │   └──────────────────────────────────┘   │            │
│                  │                                          │            │
│                  │   비밀번호                                │            │
│                  │   ┌──────────────────────────────────┐   │            │
│                  │   │ ••••••••••                     👁│   │            │
│                  │   └──────────────────────────────────┘   │            │
│                  │   [ ▮▮▮▯▯ ] 보통                          │            │
│                  │   - 10자 이상 / 영문 대/소·숫자·특수문자 3종 │            │
│                  │                                          │            │
│                  │   비밀번호 확인                            │            │
│                  │   ┌──────────────────────────────────┐   │            │
│                  │   │                                  │   │            │
│                  │   └──────────────────────────────────┘   │            │
│                  │                                          │            │
│                  │   [✓] 이용약관 및 개인정보처리방침 동의 (필수) │           │
│                  │   [ ] 마케팅 정보 수신 동의 (선택)          │            │
│                  │                                          │            │
│                  │   ┌──────────────────────────────────┐   │            │
│                  │   │          가입하기                  │   │            │
│                  │   └──────────────────────────────────┘   │            │
│                  │                                          │            │
│                  │      이미 계정이 있으신가요?  로그인        │            │
│                  └──────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────────────┘
```

- 비밀번호 강도 인디케이터: zod refine 결과를 5단계 (`매우 약함 / 약함 / 보통 / 강함 / 매우 강함`) 로 표시. 실패 사유는 인디케이터 아래 bullet list 로.
- "가입하기" 버튼 `disabled` 시 `blockingReasons` tooltip — 예: ["비밀번호 정책 불충족", "이용약관 동의 필요"] (frontend.md §10.6).

가입 직후 화면:

```
┌────────────────────────────────────────┐
│   ✉  이메일 인증을 완료해주세요         │
│                                        │
│   you@example.com 으로 인증 메일을      │
│   발송했습니다. 메일함을 확인하고       │
│   링크를 클릭해주세요.                   │
│                                        │
│   [ 인증 메일 재전송 ]  [ 로그인으로 ]    │
└────────────────────────────────────────┘
```

### 6.4 `/forgot-password` — 비밀번호 찾기

```
┌────────────────────────────────────────┐
│                                        │
│   비밀번호 재설정                       │
│                                        │
│   가입 시 사용한 이메일을 입력하시면     │
│   재설정 링크를 보내드립니다.           │
│                                        │
│   이메일                                │
│   ┌──────────────────────────────────┐ │
│   │ you@example.com                  │ │
│   └──────────────────────────────────┘ │
│                                        │
│   ┌──────────────────────────────────┐ │
│   │         재설정 메일 보내기         │ │
│   └──────────────────────────────────┘ │
│                                        │
│       로그인으로 돌아가기                │
└────────────────────────────────────────┘
```

성공 후 (enumeration 방지 § 4.4):

```
   ✓  메일을 발송했습니다
   입력하신 이메일로 안내 메일을 보냈습니다.
   메일이 도착하지 않으면 스팸함을 확인해주세요.
   (이미 가입된 경우 로그인 안내가 함께 전송됩니다)
```

### 6.5 `/reset-password` — 비밀번호 재설정

```
┌────────────────────────────────────────┐
│   새 비밀번호 설정                       │
│                                        │
│   새 비밀번호                            │
│   ┌──────────────────────────────────┐ │
│   │ ••••••••••                     👁│ │
│   └──────────────────────────────────┘ │
│   [ ▮▮▮▮▯ ] 강함                        │
│                                        │
│   새 비밀번호 확인                       │
│   ┌──────────────────────────────────┐ │
│   │                                  │ │
│   └──────────────────────────────────┘ │
│                                        │
│   ⓘ 변경 후 모든 기기에서 자동 로그아웃됩니다 │
│                                        │
│   ┌──────────────────────────────────┐ │
│   │         비밀번호 변경              │ │
│   └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

토큰 만료 시:

```
   ⚠  링크가 만료되었습니다
   재설정 링크는 1시간 동안만 유효합니다.
   다시 요청해주세요.
   [ 비밀번호 재설정 요청 ]
```

---

## 7. 상태 처리 (4상태) + 에러 매핑

### 7.1 4상태 표 (frontend.md §9)

| 화면 | loading | data | error | empty |
|---|---|---|---|---|
| `/login` | submit 진행 중 — 버튼 spinner + disabled | (해당 없음 — 단발 mutation) | `<ErrorMessage>` (§7.2 매핑) | 초기 상태 = empty 로 간주, 폼 노출 |
| `/signup` | submit 진행 중 | 가입 성공 후 "이메일 인증 안내" | `<ErrorMessage>` | 초기 폼 |
| `/forgot-password` | submit 진행 중 | "메일 발송 안내" 화면 | `<ErrorMessage>` (네트워크 / 5xx) | 초기 폼 |
| `/reset-password` | recovery 세션 수립 중 → submit 중 | 성공 → /login 토스트 | 토큰 만료 / 비밀번호 정책 위반 | (해당 없음) |
| `/auth/callback` | exchange 진행 중 — full-screen spinner | 성공 시 즉시 리다이렉트 (data 화면 없음) | `<ErrorMessage>` + "로그인으로" 버튼 | (해당 없음) |

### 7.2 Supabase Auth 에러 → 한국어 메시지 매핑

| Supabase 에러 (code / message 키) | 사용자 노출 메시지 | UI 부가 |
|---|---|---|
| `invalid_credentials` | 이메일 또는 비밀번호가 올바르지 않습니다 | ErrorMessage. 시도 N회 누적 시 안내 (v2) |
| `email_not_confirmed` | 이메일 인증이 완료되지 않았습니다 | "인증 메일 재전송" 버튼 |
| `email_address_invalid` / zod `email` 실패 | 올바른 이메일 형식이 아닙니다 | 입력 필드 인라인 |
| `weak_password` | 비밀번호 정책을 충족하지 않습니다 | bullet list (10자+, 3종 혼합) |
| `same_password` (재설정 시) | 기존 비밀번호와 동일합니다 | ErrorMessage |
| `user_already_exists` (회원가입) | (enumeration 방지 — §4.4) "메일을 발송했습니다" 동일 화면 노출 | ErrorMessage 노출 안 함 |
| `over_email_send_rate_limit` / `over_request_rate_limit` | 잠시 후 다시 시도해주세요 | Retry-After 카운트다운 |
| `provider_email_needs_verification` (소셜) | 이메일 인증이 완료된 소셜 계정만 사용 가능합니다 | ErrorMessage |
| `oauth_provider_not_supported` | 지원하지 않는 로그인 방식입니다 | (운영자 알림 — Sentry capture) |
| `otp_expired` (recovery) | 재설정 링크가 만료되었습니다. 다시 요청해주세요 | /forgot-password 안내 |
| `session_not_found` | 다시 로그인해주세요 | /login 리다이렉트 |
| 네트워크 오류 (fetch fail) | 네트워크 연결을 확인해주세요 | "다시 시도" 버튼 |
| 5xx (Supabase 장애) | 일시적인 오류입니다. 잠시 후 다시 시도해주세요 | Sentry capture + ErrorMessage |
| 그 외 / 알 수 없음 | 알 수 없는 오류가 발생했습니다 | ErrorMessage 의 raw response 접힘 (`<details>`) |

> ErrorMessage 컴포넌트는 `ui-system.md` §8 의 명세 (긴 stack/raw response 접힘 기본) 를 따른다.

### 7.3 Sentry 처리 분기

| 에러 | Sentry 송출 | 비고 |
|---|---|---|
| `invalid_credentials` | **금지** (사용자 입력 실패) | audit_log 만 |
| `email_not_confirmed` | **금지** | audit_log 만 |
| `weak_password` | **금지** (사용자 입력 실패) | — |
| `user_already_exists` | **금지** (enumeration 정보) | audit_log: `signup_attempted_existing_email` |
| 네트워크 오류 | **허용** (마스킹 후) | breadcrumb 만, event capture 는 N회 누적 시 |
| 5xx | **필수 송출** | 운영 알림 |
| 알 수 없는 에러 | **필수 송출** | 메시지 + redact 거친 context |

---

## 8. 자동화 검증 (frontend / backend / qa)

### 8.1 lint / static

- ESLint `no-explicit-any` error.
- `password` / `accessToken` 등 §6.1 키 이름이 `console.log` 인자에 등장 시 차단 (custom rule).
- `dist/` 빌드 후 grep `service_role` / `SUPABASE_SERVICE_ROLE` → 0건 (security.md §14.1).

### 8.2 단위 (Vitest)

- §5 zod 스키마 각각 pass / fail 케이스 — testing.md §6.1.
- `safeRedirectTo` 외부 URL 차단 케이스 (`http://evil`, `//evil`, `javascript:`, 정상 `/dashboard`).
- `passwordPolicy` 경계값 (9자 / 10자 / 2종 / 3종 / 72자 / 73자).

### 8.3 통합 (RTL + MSW)

- `/login` 4상태 렌더 (loading / data 없음 / error / empty).
- `/signup` 비밀번호 강도 인디케이터 단계 전이.
- `/reset-password` recovery 세션 미수립 시 폼 disabled.

### 8.4 RLS SQL 테스트 (testing.md §7.2)

```sql
-- 셀러 B 가 셀러 A 의 sellers row SELECT 시도 → 0건
set local role authenticated;
set local request.jwt.claims to '{"sub":"<B-uuid>"}';
select count(*) from public.sellers where id = '<A-uuid>';
-- 기대: 0

-- 셀러 B 가 셀러 A 의 sellers row UPDATE 시도 → 0행
update public.sellers set display_name = 'hacked' where id = '<A-uuid>';
-- 기대: 0 rows affected (RLS 차단)

-- sellers.id / signup_provider / created_at 변조 차단
update public.sellers set signup_provider = 'naver' where id = auth.uid();
-- 기대: ERROR — sellers.signup_provider is immutable
```

### 8.5 E2E (Playwright)

- 골든 패스 G1 단계 (testing.md §3.2) — 본 도메인 검증 분량은 G1.
- 추가 E2E: 비밀번호 재설정 flow 1개 (full path — 메일 토큰은 MSW 로 가짜 fragment 주입).

---

## 9. 테스트 매트릭스 (수락 기준)

> 양식: testing.md §4.1. 8종 강제 시나리오 (testing.md §5) 매핑은 행 끝 `[5xx][4xx][429][401][partial][network][concurrent][rls]` 태그로 표기.

| ID | Given | When | Then | 자동화 | Priority |
|----|-------|------|------|--------|----------|
| QA-AUTH-001 | 미가입 이메일 + 정책 충족 비밀번호 + 표시명 입력 (`/signup` 폼 유효) | "가입하기" 클릭 | (1) Supabase Auth `signUp` 200, (2) `auth.users` 1행, (3) `sellers` 1행 (`signup_provider='email'`, `display_name=입력값`), (4) 인증 메일 발송 화면 노출, (5) `audit_log: auth.seller_signup` 1행 | Playwright + RLS-SQL + Vitest | P0 |
| QA-AUTH-002 | `/signup` 폼 비밀번호 9자 입력 | "가입하기" 클릭 | (1) 클라이언트 zod 차단 (서버 호출 0), (2) "10자 이상이어야 합니다" 에러 인라인 노출, (3) "가입하기" disabled | Vitest (스키마) + RTL | P0 |
| QA-AUTH-003 | `/signup` 비밀번호가 영문 1종 + 숫자 1종 (2종) | "가입하기" 클릭 | (1) zod refine 실패, (2) "3종 이상 혼합" 메시지, (3) Sentry 송출 0 | Vitest + RTL | P1 |
| QA-AUTH-004 | 이미 가입된 이메일 (`a@x.com`) 로 `/signup` 재시도 | "가입하기" 클릭 | (1) 사용자 화면은 "메일을 발송했습니다" 동일 문구 (enumeration 차단), (2) `audit_log: auth.signup_attempted_existing_email` 1행 | Playwright | P0 `[security]` |
| QA-AUTH-005 | 정상 가입 + 이메일 미인증 상태 | `/login` 에서 정상 이메일·비밀번호 입력 후 "로그인" | (1) 401 `email_not_confirmed`, (2) "이메일 인증이 완료되지 않았습니다" 에러, (3) "인증 메일 재전송" 버튼 노출, (4) `audit_log: auth.login_failure { reason: 'email_not_confirmed' }` | Playwright | P0 |
| QA-AUTH-006 | 정상 가입 + 이메일 인증 완료 | `/login` 정상 입력 후 "로그인" | (1) 200 + JWT 세션, (2) `/dashboard` 리다이렉트, (3) 헤더에 `display_name` 노출, (4) `sellers.last_active_at` 갱신, (5) `audit_log: auth.login_success { provider: 'email' }` | Playwright (골든 패스 G1) | P0 |
| QA-AUTH-007 | 정상 가입자 + 잘못된 비밀번호 5회 연속 | `/login` 동일 이메일·잘못된 비밀번호 5회 입력 | (1) 처음 1~4회는 `invalid_credentials` 메시지, (2) Supabase rate limit 도달 시 429 + "잠시 후 다시 시도" + Retry-After 카운트다운, (3) `audit_log: auth.login_failure` 5행 | Playwright + MSW | P0 `[429]` |
| QA-AUTH-008 | 가입자 / 로그인 상태 | "로그아웃" 클릭 | (1) `signOut({ scope: 'global' })`, (2) 다른 탭 (동일 셀러)도 세션 무효 (LocalStorage 이벤트 또는 다음 요청 401), (3) `/login` 리다이렉트, (4) `audit_log: auth.logout { scope: 'global' }` + `auth.session_revoked_global` | Playwright (2탭) | P1 |
| QA-AUTH-009 | 미가입 이메일로 `/forgot-password` 제출 | "재설정 메일 보내기" 클릭 | (1) 응답은 항상 200 / 동일 화면, (2) 메일 실제 발송은 0, (3) `audit_log: auth.password_reset_requested` 1행 (enumeration 방어 — 실재 여부 화면 노출 0) | Playwright | P0 `[security]` |
| QA-AUTH-010 | 가입자가 `/forgot-password` 정상 제출 → 메일 링크 수신 | 링크 클릭 → `/reset-password` 진입 → 새 비밀번호 정책 충족 입력 → "비밀번호 변경" | (1) `updateUser({ password })` 200, (2) `signOut({ scope: 'global' })` 자동 실행, (3) `/login` 토스트, (4) `audit_log: auth.password_reset_completed` + `auth.session_revoked_global { reason: 'password_change' }` | Playwright + MSW (recovery fragment 주입) | P0 |
| QA-AUTH-011 | recovery 토큰 만료 (1시간 경과) | 만료 링크 클릭 후 `/reset-password` 진입 | (1) supabase-js 가 세션 수립 실패, (2) "링크가 만료되었습니다" ErrorMessage, (3) `/forgot-password` 안내 버튼, (4) 폼 disabled | Playwright | P1 |
| QA-AUTH-012 | `/login` 소셜 탭 → Google 버튼 클릭 → provider 동의 화면에서 거부 | provider 콜백이 `error=access_denied` 로 복귀 | (1) `/login` 으로 복귀, (2) "소셜 로그인이 취소되었습니다" ErrorMessage, (3) `audit_log: auth.login_failure { reason: 'oauth_denied' }` | Playwright + MSW provider mock | P1 |
| QA-AUTH-013 | 소셜 provider 가 `email_verified=false` 응답 | 콜백 처리 | (1) Supabase Auth 가 가입 차단 또는 우리 측이 차단, (2) ErrorMessage "이메일 인증이 완료된 소셜 계정만 사용 가능합니다", (3) `audit_log: auth.login_failure { reason: 'oauth_email_unverified' }` | Playwright + MSW | P1 `[401]` |
| QA-AUTH-014 | 셀러 A 로그인 / 셀러 B 의 `sellers.id` 직접 PostgREST GET | `GET /rest/v1/sellers?id=eq.<B-uuid>` (A 의 JWT) | (1) 결과 0건 (RLS), (2) 에러 응답 자체에 PII 노출 0, (3) Sentry / audit_log 에 평문 이메일 0 | RLS-SQL + Playwright + Vitest (redact) | P0 `[rls]` |
| QA-AUTH-015 | 셀러 A 의 JWT 로 셀러 B 의 `sellers` UPDATE 시도 | `UPDATE public.sellers SET display_name='x' WHERE id='<B-uuid>'` | (1) 0 rows affected, (2) 에러 없이 빈 결과 (PostgREST 동작), (3) 클라이언트는 "변경된 행 없음" 처리 | RLS-SQL | P0 `[rls]` |
| QA-AUTH-016 | 셀러 A 의 JWT 로 본인 `sellers.signup_provider` UPDATE 시도 | `UPDATE public.sellers SET signup_provider='naver' WHERE id=auth.uid()` | (1) 트리거 `sellers_protect_immutable` raise → 에러, (2) 행 변경 0, (3) Sentry capture (의심 행위) | RLS-SQL + Vitest | P1 `[security]` |
| QA-AUTH-017 | 로그인 후 24시간 경과 (JWT 만료, refresh 유효) | `/dashboard` 진입 시 supabase-js 가 자동 refresh | (1) refresh 200 + 신 access token 발급, (2) 화면 정상 노출, (3) 사용자 의식 없음 | RTL + MSW | P1 |
| QA-AUTH-018 | 로그인 후 31일 경과 (refresh 도 만료) | `/dashboard` 진입 | (1) refresh 401, (2) 자동 signOut, (3) `/login` 리다이렉트 + 토스트 "다시 로그인해주세요", (4) `audit_log: auth.session_revoked_global { reason: 'expired' }` 1행 | RTL + MSW (시간 조작) | P1 `[401]` |
| QA-AUTH-019 | `/auth/callback?type=oauth&code=...` 진입 도중 네트워크 단절 | exchangeCodeForSession fetch fail | (1) ErrorMessage "네트워크 연결을 확인해주세요", (2) "다시 시도" 버튼 노출, (3) Sentry breadcrumb 만 (event capture 첫 회는 보류) | Playwright + MSW (offline) | P2 `[network]` |
| QA-AUTH-020 | 동일 셀러 동시 2 탭 로그인 + 한 탭에서 비밀번호 변경 | 다른 탭에서 임의 mutation 시도 | (1) 다른 탭 mutation 401 (session_revoked), (2) supabase-js onAuthStateChange 가 SIGNED_OUT 이벤트 발행, (3) 모든 탭이 `/login` 리다이렉트 | Playwright (2 context) | P2 `[concurrent]` |
| QA-AUTH-021 | `?redirectTo=https://evil.example/steal` 가 붙은 `/login` 진입 후 정상 로그인 | "로그인" 클릭 | (1) `safeRedirectTo` 가 외부 URL 차단, (2) 최종 리다이렉트는 `/dashboard`, (3) Sentry / audit_log 에 의심 redirect 시도 기록 | Vitest + Playwright | P0 `[security]` |
| QA-AUTH-022 | `/reset-password?type=recovery` 가 아닌 일반 진입 (recovery 세션 미수립) | 새 비밀번호 입력 시도 | (1) 폼 disabled + ErrorMessage "재설정 링크로 진입해주세요", (2) updateUser 호출 0 | RTL | P1 |
| QA-AUTH-023 | (a11y) `/login` / `/signup` / `/forgot-password` / `/reset-password` 4개 라우트 | Playwright + axe 스캔 | `violations.length === 0` 모든 라우트 통과 (axe-core/playwright) | axe | P0 |
| QA-AUTH-024 | (a11y 키보드) `/login` 진입 | Tab 만으로 이메일 → 비밀번호 → "로그인" → 보조 링크 순환 | (1) 포커스 가시 (focus ring 토큰), (2) Enter 키로 submit, (3) Esc 키로 비밀번호 표시 토글 영향 없음 | Playwright (키보드만) | P0 |
| QA-AUTH-025 | (debug 모드 보안 동등성) debug 빌드 부팅 | 인증 우회 검사 | (1) `MOCK_USER` 같은 하드코딩 분기 0건 (grep), (2) PKCE flow 유지, (3) Sentry beforeSend 동작 (debug DSN 또는 off — security.md §9) | CI grep + Vitest | P0 `[security]` |
| QA-AUTH-026 | (마스킹) `/signup` 도중 fetch 5xx → Sentry 송출 | Sentry SDK `beforeSend` 통과 결과 검사 | (1) request body 의 `password` / `email` 키 `[REDACT:*]` 치환, (2) JWT 형식 문자열 `[REDACT:jwt:len=...]`, (3) 원본 평문 0건 | Vitest (redact) + Sentry mock | P0 `[security]` |
| QA-AUTH-027 | (감사 로그 무결성) audit_log row 직접 UPDATE 시도 | `UPDATE public.audit_log SET event='auth.login_success' WHERE id=...` (authenticated 또는 anon) | (1) 정책 부재로 거부, (2) 0 rows affected | RLS-SQL | P0 `[security]` |
| QA-AUTH-028 | (CASCADE) `auth.users` DELETE (탈퇴) | 셀러 A 행 삭제 | (1) `sellers` 행 자동 삭제 (CASCADE), (2) `audit_log` 의 `seller_id` 가 NULL 로 SET (ON DELETE SET NULL), (3) `audit_log: auth.seller_deleted` 1행 | RLS-SQL + Vitest | P1 |
| QA-AUTH-029 | (8종 강제 — 부분 실패) | 본 도메인은 단일 마켓·단일 등록이 아니므로 partial 시나리오 미적용 | **carry-over** (testing.md §5 의 partial 은 registration 도메인에서 만족) — | — | — `[partial]` |
| QA-AUTH-030 | (i18n) `t('auth.signin.title')` 사전 부재 | 빌드 | `pnpm i18n:check` (ko.ts key 일치) 0 missing — 누락 시 CI fail | CI script | P1 |

### 9.1 8종 강제 시나리오 매핑 검증

| testing.md §5 | 본 매트릭스 행 |
|---|---|
| 마켓 API 5xx | (해당 없음 — 본 도메인은 마켓 API 미호출) → registration 도메인 위임 |
| 마켓 API 4xx | QA-AUTH-002, 003, 005 (Supabase Auth 4xx 동등 처리) |
| 429 rate limit | QA-AUTH-007 |
| 401 토큰 만료 | QA-AUTH-013, QA-AUTH-018 |
| 부분 실패 | (해당 없음 — 본 도메인 carry-over) QA-AUTH-029 |
| 네트워크 끊김 | QA-AUTH-019 |
| 동시 입력 충돌 | QA-AUTH-020 |
| 권한 누수 (RLS) | QA-AUTH-014, 015, 016, 027 |

---

## 10. 수락 기준 체크리스트 (PR 게이트)

본 도메인 PR 머지 전 다음 항목 통과 필수. security.md §14 의 12개 항목에 더해 본 도메인 고유 9개.

```
## docs/architecture/v1/features/auth-checklist.md
### security.md §14 인용
- [ ] Supabase Auth 세션이 PKCE flow 로 발급 (implicit 미사용)
- [ ] sellers / audit_log 테이블 RLS 정책 동봉 + service_role 전용 경로 사유 명시
- [ ] Sentry beforeSend / beforeBreadcrumb 가 프론트 + Edge Function 양쪽 적용
- [ ] OAuth redirect URI 가 debug / real 별 화이트리스트
- [ ] login / logout / password_reset 모두 audit_log 적재
- [ ] CORS origin 명시 (* 금지)
- [ ] pnpm audit high 0건
- [ ] debug / real Supabase 프로젝트 시크릿 격리
- [ ] PII 컬럼 추가 시 §6.1 마스킹 키 목록 갱신
- [ ] debug 모드에서 인증 우회 분기 0건

### auth 도메인 고유
- [ ] zod 스키마 (SignUpForm / SignInForm / ForgotPasswordForm / ResetPasswordForm) pass / fail 단위 테스트 동봉
- [ ] handle_new_seller 트리거 SECURITY DEFINER + search_path 고정 확인
- [ ] sellers_protect_immutable 트리거 단위 테스트 (id / signup_provider / created_at 3개 모두 변조 차단)
- [ ] safeRedirectTo 외부 URL 차단 테스트 (open redirect 방지)
- [ ] 비밀번호 강도 인디케이터 정책 일치 (zod refine 결과와 UI 5단계 일치)
- [ ] enumeration 방어 (`/forgot-password`, `/signup` 의 user_already_exists) 화면 문구 동일
- [ ] 비밀번호 재설정 후 signOut({scope:'global'}) 호출 검증
- [ ] /reset-password 진입 시 recovery 세션 미수립 가드
- [ ] axe 0 violation (4개 라우트)
```

---

## 11. 3개 산출물 동기화 대상

CLAUDE.md "Rules / 3개 산출물 동기화" 의무. 본 도메인 작업 시:

| 산출물 | 경로 | 동기화 필요 시점 |
|---|---|---|
| 설계문서 (본 문서) | `docs/architecture/v1/features/auth.md` | 모든 변경 |
| HTML 프로토타입 | `docs/frontend_html_design/v1/auth/` (신설 예정 — 첫 화면 작업 시) | UI 와이어 / 문구 변경 |
| 실제 구현 | `src/features/auth/` (pages: login / signup / forgot-password / reset-password / auth-callback) | 코드 변경 |
| SQL 마이그레이션 | `supabase/migrations/<ts>_create_sellers.sql`, `<ts>_seller_signup_trigger.sql` | 데이터 모델 변경 |
| Edge Function | `supabase/functions/auth-event-log/` | API 변경 |
| zod 스키마 | `src/lib/schemas/auth.ts` | API / 폼 변경 |
| i18n 사전 | `src/locales/ko.ts` (`auth.*` 키) | 문구 변경 |

---

## 12. 미해결 사안

| # | 항목 | 결정 시점 | 후보 옵션 | 비고 |
|---|---|---|---|---|
| 1 | 비밀번호 강도 인디케이터 5단계 산정 알고리즘 | Phase 1 (designer + frontend) | zxcvbn 도입 vs 자체 규칙 (3종/4종 + 길이) | zxcvbn 은 100KB+ — 번들 영향 측정 후 결정 |
| 2 | 로그인 실패 N회 누적 시 captcha | v2 | hCaptcha / Cloudflare Turnstile | v1 은 Supabase rate limit 만 |
| 3 | "이 기기 기억하지 않기" UI 노출 | v2 | 토글 노출 / `persistSession=false` 분기 | v1 미노출 결정 |
| 4 | 소셜 로그인 provider 별 scope 최소화 | Phase 1 (security + backend) | profile + email 만 / 추가 scope 거부 | Naver 의 경우 phone scope 요청 검토 거부 |
| 5 | `display_name` 중복 허용 정책 | Phase 1 (product) | unique 강제 / 자유 허용 | 현재 자유 허용 (식별자 아님) |
| 6 | 이메일 변경 화면 | v2 | 별도 화면 / 설정 페이지 통합 | v1 없음 |
| 7 | 마케팅 동의 변경 화면 | v2 | 설정 페이지 통합 | v1 없음 |
| 8 | Naver / Kakao 의 PKCE 지원 여부 사실 확인 | Phase 1 (backend) | 미지원 시 Supabase 가 어떻게 우회하는지 검증 | 공식 문서 확인 필요 — "확인 안 됨" 상태로 명시 |
| 9 | Edge Function `auth-event-log` rate limit 한도 | Phase 1 (backend) | 분당 60 / IP 별 / seller 별 | 1차 안: seller 별 60/min, IP hash 별 120/min |
| 10 | OAuth callback 의 `redirectTo` 보존 방식 | Phase 1 (frontend) | URL search param / sessionStorage / state cookie | 외부 URL 차단 + 내부 path 화이트리스트만 통과 |

---

## 13. 개정 이력

| 일자 | 버전 | 변경 | 작성 |
|---|---|---|---|
| 2026-05-18 | v1.0 | 최초 작성. PRD §2.1 / CLAUDE.md MVP s1 / security.md §2·§10·§12 / testing.md §3·§4·§5 인용 반영. user_flow s1 (n1~n8) 매핑·sellers DDL + RLS + 트리거·zod 스키마·UI 와이어 (데스크탑+모바일)·30행 수락 매트릭스 포함. | ing-backend |
