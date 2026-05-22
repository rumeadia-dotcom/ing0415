# dev Supabase 프로젝트 부트스트랩 가이드

작성: 2026-05-22 (env 플래그 분리 시점)
대상: dev project ref `eqoywqoalwkwbrdsulfl`

## 배경

`VITE_APP_MODE` + `VITE_USE_MOCK` 플래그 분리에 따라 다음 3가지 모드가 가능해졌다:

- `dev + useMock=true` — dev-supabase + mock 마켓 어댑터
- `dev + useMock=false` — dev-supabase + real 마켓 어댑터
- `real + useMock=false` — real-supabase + real 어댑터 (운영)

플래그 분리 시점에 **dev Supabase 프로젝트는 비어있음** (마이그레이션 0건, Edge Functions 0개, 시크릿 미설정). 본 가이드는 dev project 를 real 의 미러로 셋업하는 절차다.

## 사전 준비

- Supabase CLI 설치 (`brew install supabase/tap/supabase`)
- `supabase login` 완료 (`SUPABASE_ACCESS_TOKEN` env 설정 또는 brew 인증)
- 두 프로젝트의 Service Role Key 와 anon key 를 Supabase 대시보드에서 미리 확보

## Step 1 — Supabase CLI 를 dev 프로젝트로 link

```bash
pnpm supabase:link:dev
# 내부적으로 cd apps/api && supabase link --project-ref eqoywqoalwkwbrdsulfl
```

성공 시 `apps/api/supabase/.temp/linked-project.json` 의 `project_ref` 가 `eqoywqoalwkwbrdsulfl` 로 바뀐다.

## Step 2 — 마이그레이션 27개 전부 적용

```bash
pnpm db:push:dev
# 내부적으로 link:dev 후 cd apps/api && supabase db push
```

확인:
- Supabase Studio (dev 프로젝트) → Database → Migrations 메뉴에 27개 항목 노출
- 또는 `apps/api/supabase` 에서 `supabase migration list` (Local | Remote 양쪽 동일해야 함)

## Step 3 — Edge Functions 23개 배포

```bash
pnpm functions:deploy:dev
# 내부적으로 link:dev 후 cd apps/api && supabase functions deploy
```

확인: Supabase Studio (dev) → Edge Functions 메뉴에 23개 함수 노출.

## Step 4 — Auth 설정 (대시보드 수동)

Supabase Studio (dev) → Authentication → Providers:

- **Email** 활성화. "Confirm email" 토글은 dev 환경에선 OFF 권장 (테스트 가속).
- 소셜 provider (Google/Kakao 등) v1 범위 외 — skip.

Authentication → URL Configuration:
- **Site URL**: `http://localhost:5173` (Vite dev 서버)
- **Redirect URLs**: `http://localhost:5173/**` 추가

## Step 5 — Storage bucket 생성

Supabase Studio (dev) → Storage → New bucket:

- **Name**: `product-images`
- **Public**: ON (이미지 변환 결과는 마켓에 공개 URL 로 노출)
- **File size limit**: 10MB
- **MIME types**: `image/jpeg,image/png,image/webp`

RLS 정책은 마이그레이션이 자동 생성 (Step 2 완료 후).

## Step 6 — Edge Function secrets 설정

```bash
# Supabase Studio (dev) → Project Settings → Edge Functions → Secrets
# 또는 CLI:
cd apps/api && supabase secrets set \
  --project-ref eqoywqoalwkwbrdsulfl \
  NAVER_OAUTH_CLIENT_ID="..." \
  NAVER_OAUTH_CLIENT_SECRET="..." \
  COUPANG_VENDOR_ID="..." \
  COUPANG_ACCESS_KEY="..." \
  COUPANG_SECRET_KEY="..." \
  GMARKET_ESM_MASTER_ID="..." \
  GMARKET_ESM_PASSWORD="..." \
  AUCTION_ESM_MASTER_ID="..." \
  AUCTION_ESM_PASSWORD="..." \
  PGCRYPTO_KEY="$(openssl rand -base64 32)" \
  SENTRY_DSN="..."
```

**시크릿 값 확보 경로**:
- 마켓 OAuth client / API 키 → 각 마켓 developer console (sandbox 계정 권장)
- `PGCRYPTO_KEY` → 32바이트 random base64. real 과 **다른 값** 사용해야 함 (credential 격리)
- `SENTRY_DSN` → Sentry 프로젝트의 dev 환경 DSN

⚠️ **real 시크릿을 dev 에 넣지 말 것**. 마켓 API sandbox 키 또는 별도 발급분 사용.

## Step 7 — 로컬에서 dev 모드 동작 확인

`.env.development.local` 의 `VITE_SUPABASE_ANON_KEY` 가 dev 프로젝트 anon key 인지 확인:

```bash
# Supabase Studio (dev) → Project Settings → API → Project API keys
# → anon public 키를 복사
```

실행:

```bash
pnpm dev      # MODE=dev USE_MOCK=true   → mock 어댑터로 빠른 UI 작업
pnpm dev:db   # MODE=dev USE_MOCK=false  → real 마켓 API 호출 + dev DB
```

dev DB 사용 모드 (`pnpm dev:db`) 에서 `pnpm dev` 가 mock 모드와 동일하게 회원가입 → 로그인 → 상품 등록 골든패스가 동작하면 부트스트랩 성공.

## Step 8 — GitHub Secrets 정리 (CI 보강)

CI 워크플로우는 현재 `DEBUG_SUPABASE_ANON_KEY` / `DEBUG_SENTRY_DSN` 시크릿명을 그대로 사용 중. 부트스트랩 완료 후:

1. GitHub repo → Settings → Secrets and variables → Actions
2. `DEV_SUPABASE_ANON_KEY` / `DEV_SENTRY_DSN` 시크릿을 dev 프로젝트 값으로 추가
3. `.github/workflows/ci.yml` 에서 `DEBUG_*` → `DEV_*` 시크릿 이름 교체 (후속 PR)

(작업 분리 사유: 시크릿 이름 변경 PR 머지 전에 secret 이름이 GitHub Actions 에 등록되어 있어야 CI 가 깨지지 않음.)

## Step 9 — 부트스트랩 완료 후 정합 점검

- [ ] `pnpm dev:db` 로 회원가입 → dev Supabase Auth 에 사용자 생성 확인
- [ ] 상품 등록 → mock 어댑터 시나리오 통과
- [ ] Sentry dev 프로젝트에 이벤트 도달 확인 (테스트 에러 throw)
- [ ] 마켓 OAuth callback 한 번 통과 (네이버 sandbox)

## Rollback

만약 dev 프로젝트 셋업이 망가지면:

```bash
# 마이그레이션만 롤백 (Supabase Studio → Database → Migrations 에서 수동)
# Edge Functions 는 재배포로 덮어쓰기 가능
pnpm functions:deploy:dev
```

비상시 `apps/api/supabase/.temp/linked-project.json` 삭제 후 `pnpm supabase:link:dev` 재실행으로 link 리셋 가능.
