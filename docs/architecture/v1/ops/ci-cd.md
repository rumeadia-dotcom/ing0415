# CI/CD 설계문서 (v1)

> 인용: `platform.md`, `frontend.md`, `security.md`, `testing.md`, `cross-cutting/credential-vault.md`
> 범위: 본 문서는 **빌드·테스트·배포·릴리즈·롤백 자동화** 한 축만 다룬다. Supabase 스키마/RLS 정책 자체는 `cross-cutting/`, 마켓 어댑터 구현 자체는 `features/markets.md` 를 참조.

---

## 1. 목적·범위

### 1.1 목적
- **회귀 차단**: PR 머지 전 타입·린트·단위·통합·E2E 골든패스를 자동 실행해, 실수로 main 이 깨지지 않게 한다.
- **재현 가능한 배포**: real 모드 운영 빌드를 사람 손이 아니라 GitHub Actions 가 100% 동일한 절차로 생성·배포.
- **모드 격리 강제**: `dev` / `real` 두 빌드가 코드·시크릿·Supabase 프로젝트 모두 분리되어 운영 트래픽과 개발 트래픽이 교차하지 않음을 빌드 시점에 검증.
- **롤백 경로 명문화**: 운영 사고 발생 시 "어떤 명령으로 몇 분 안에 되돌리는지"가 문서·워크플로우 양쪽에 박혀 있어야 함.

### 1.2 범위 (v1)

| 포함 | 제외 (v2+) |
|---|---|
| GitHub Actions 워크플로우 (`ci.yml`, `deploy.yml`) | 멀티 리전 배포 / 카나리 / 블루그린 |
| GitHub Pages 정적 호스팅 배포 | CDN 직접 invalidation, 자체 호스팅 전환 |
| Supabase Edge Functions deploy | 별도 백엔드(Node/Go 서버) 배포 |
| Supabase CLI 기반 DB 마이그레이션 | schema-versioned API gateway |
| Sentry release + 소스맵 업로드 | APM(Datadog 등) 통합 |
| GitHub Pages 이전 커밋 재배포 롤백 | 자동 회귀 감지 후 자동 롤백 |

### 1.3 비목표
- **빌드 시간 최적화 광적 추구**: v1 기준 PR CI 6분 / deploy 10분 이내면 충분. 5분 미만 압박은 v2.
- **셀프 호스트 러너**: 비용·보안 검토 전까지 GitHub-hosted `ubuntu-latest` 만 사용.

---

## 2. 브랜치 전략 & 워크플로우 매트릭스

### 2.1 브랜치 모델 (Git Flow 요약)

```
main         ─────●──────────────●──────────────●─────  (운영 = real 배포 트리거)
                  │              ▲              ▲
                  │              │ merge        │ merge
                  │           release/1.1     hotfix/x
                  │              ▲              ▲
develop      ──●──●──●──●──●──●──●──●──●──●──  (통합)
               ▲     ▲     ▲
               │     │     │ feature/* 머지
            feature/a feature/b
```

- `feature/*` → `develop` (PR, squash merge)
- `release/<x.y>` ← `develop` 컷, 추가 E2E·수동 QA 후 → `main` 머지 + 태그 `vX.Y.0`
- `hotfix/*` ← `main` 컷, 수정 후 → `main` 머지 + `develop` 백머지 + 태그 `vX.Y.Z`

### 2.2 트리거 ↔ 워크플로우 매트릭스

| 이벤트 | 대상 브랜치/태그 | 워크플로우 | 작업 요약 | 모드 | 배포 |
|---|---|---|---|---|---|
| `push` | `feature/**` | `ci.yml` | **빠른 레인** — Lint & Typecheck / Unit (Vitest) 만. 무거운 잡 skip | dev | X |
| `pull_request` | `develop` / `main` / `release/**` | `ci.yml` | **풀 게이트** — 빠른 레인 + Build(dev+real) + E2E(골든+a11y) + pgTAP RLS. 단 경로 필터로 무관 잡 skip | dev | X |
| `push` | `develop` / `release/**` / `hotfix/**` | `ci.yml` | 풀 게이트 (통합·릴리즈 브랜치 재실행) | dev | X |
| `push` | `main` | `deploy.yml` | real 빌드 → 404 fallback 복제 → vault drift 검증 → Pages 배포 → Edge Functions deploy → (옵션) Supabase migrate → Sentry release | real | O |
| `push` (tag) | `v*.*.*` | `deploy.yml` | 동일 + Sentry release 에 git tag 기록 | real | O |
| `workflow_dispatch` | (수동) | `deploy.yml` | 동일 + `ref` 지정 가능 (롤백용) | real | O |
| `schedule` (cron) | nightly | `ci-nightly.yml` (v2 백로그) | 전체 Playwright suite | dev | X |

> **빠른 레인 / 풀 게이트 분리 (2026-05-30, `feature/ci-fast-lane`)**: WIP 커밋마다 풀 7잡을 돌리던 비용을 제거. `feature/**` push 는 Lint/Unit 만, 무거운 잡(Build·E2E·pgTAP)은 PR + 통합/릴리즈 브랜치 push 에서만 실행한다. 실행 자격은 `setup` 잡의 `run_heavy` output 으로, 잡 단위 skip 은 경로 필터(`app` / `sql`)로 판정 (§3).
>
> v1 에 `ci-nightly.yml` 은 만들지 않는다. 골든패스 1개만 PR/CI 에서 돌리고, 전체 E2E suite 는 release/* 컷 시 수동 트리거로 운영. v2 에서 nightly 도입 결정.

### 2.3 PR 머지 정책

- **squash merge only** (Git Flow 결정문 매핑). merge commit 금지.
- PR 제목 형식: `[<도메인>] <요약>` (예: `[registration] 5단계 위저드 도입`).
- main 직접 push 금지 (branch protection).

---

## 3. PR CI 워크플로우

### 3.1 파일: `.github/workflows/ci.yml`

> **단일 진실의 원천은 실제 워크플로우 파일** (`.github/workflows/ci.yml`). 본 절은 잡 구조·실행 조건을 요약하며, 전체 YAML 을 여기 복제하지 않는다 (과거 embedded YAML 이 실제와 drift 한 사례 방지).

**잡 구조 (2026-05-30, `feature/ci-fast-lane`):**

| 잡 (`name:`) | 의존 | 실행 조건 | 역할 |
|---|---|---|---|
| `Setup (scope detection)` | — | 항상 | `run_heavy`(이벤트 기반) + `app`/`sql`/`functions`(경로 필터, `dorny/paths-filter`) output 산출 |
| `Lint & Typecheck` | — | **항상 (빠른 레인)** | `pnpm typecheck` + `pnpm lint`. Edge Functions lint 는 non-blocking |
| `Unit & Integration (Vitest)` | Lint & Typecheck | **항상 (빠른 레인)** | `pnpm test` + zod 미러 검증 흡수 (구 `Zod Mirror Check` 잡 통합) |
| `Build (dev)` / `Build (real)` (matrix) | setup, Lint & Typecheck | `run_heavy && app` | dev/real 빌드 sanity + real 번들 누출 검사 + 404 fallback |
| `E2E (golden + a11y, Chromium)` | build | build 성공 시 | 골든패스(`@golden`) + a11y axe (구 2개 잡 통합 — checkout/install/playwright 중복 제거) |
| `pgTAP RLS (Supabase local)` | setup | `run_heavy && sql` | 마이그/RLS 변경 시에만 docker Supabase 스택 부팅 |
| `Deno Typecheck (Edge Functions)` | setup | `run_heavy && functions` | Edge 코드 `deno check` (entrypoint `*/index.ts` 의존 그래프). `pnpm typecheck`(tsc)는 apps/web 만 보므로 Edge 타입 사각 보강 — 2026-05-31 OAuth refresh 런타임 버그 사고 후 도입(#294) |
| `CI Gate` | 위 전부 (`if: always()`) | 항상 | needs 잡 result 집계 — failure/cancelled 만 차단, skipped 허용. **branch protection 의 단일 required check** |

**실행 조건 로직:**
- `run_heavy = false` ⇔ `feature/**` 브랜치 push (빠른 레인). 그 외(PR / develop·release·hotfix push)는 `true`.
- 경로 필터: `app`(apps/web·tests·빌드설정·ci.yml) → build/e2e, `sql`(마이그·*.sql·ci.yml) → pgTAP, `functions`(apps/api/supabase/functions·ci.yml) → deno-check.
- 무거운 잡이 skip 돼도 `CI Gate` 는 항상 실행되어 required check 가 영구 pending 되지 않는다 (§11).

### 3.2 설계 결정

| 항목 | 선택 | 근거 |
|---|---|---|
| Node 버전 | 20 LTS | Vite 5 / TanStack Query 5 가 18+ 요구, 20 이 가장 안정 |
| pnpm 버전 | 9.12.3 | lockfile v9 — `--frozen-lockfile` 필수 |
| 캐시 | `actions/setup-node` 의 `cache: pnpm` | 별도 `actions/cache` 불필요. lockfile 해시 기반 |
| concurrency | 동일 ref 의 이전 실행 cancel | 빠른 피드백 + Action 사용량 절감 |
| **빠른 레인 분리** | **feature push = Lint/Unit 만** | WIP 커밋마다 풀 7잡(E2E·pgTAP·real 빌드)을 돌리던 비용 제거. 머지 게이트는 PR 시점에 온전히 동작하므로 안전성 유지 |
| **경로 필터** | **build/e2e=app, pgTAP=sql** | docs·SQL 만 만진 변경에서 무관 잡 skip. pgTAP 의 docker 부팅(최장 잡) 회피가 큼 |
| **잡 통합** | **zod 미러 → unit-test, golden+a11y → 단일 e2e** | 전용 러너의 중복 checkout/install/playwright 설치 제거 |
| **CI Gate 어그리게이터** | **조건부 잡 대신 단일 required check** | strict 정책에서 skipped 잡이 required 면 영구 pending. Gate 가 result 집계로 우회 |
| Playwright | chromium 만 + `@golden` 태그 | PR turnaround 단축. Safari/Firefox 는 release 단계 수동 |
| coverage upload | 실패 시에만 artifact 7일 | Codecov 등 외부 도구는 v2 |

### 3.3 거부된 옵션
- **matrix(Node 18 + 20)**: Node 18 EOL 가까움. v1 에 매트릭스 비용 들일 가치 없음.
- **Turborepo/Nx 캐시**: 모노레포지만 단일 패키지 빌드 그래프. affected-only 도입은 v2.
- **Chromatic 등 비주얼 회귀**: v2 백로그. 디자인 토큰 시스템 안정화 후.
- **feature push 에서도 풀 게이트**: WIP 피드백 지연 + Action 사용량 낭비. 머지 게이트는 PR 에서만 필요.
- **`size-limit` 게이트**: 현 `ci.yml` 에 미구현 (과거 설계안의 잔재). 번들 누출 검사는 real build 잡의 leak scan 으로 대체. 번들 사이즈 budget 게이트는 별도 도입 시 재논의.

---

## 4. main 배포 워크플로우

### 4.1 파일: `.github/workflows/deploy.yml`

```yaml
name: Deploy (real)

on:
  push:
    branches: [main]
    tags: ['v*.*.*']
  workflow_dispatch:
    inputs:
      ref:
        description: '배포할 ref (롤백 시 이전 커밋 SHA 또는 태그)'
        required: false
        type: string

concurrency:
  group: deploy-real
  cancel-in-progress: false  # 배포는 큐잉. 절대 취소하지 않는다.

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    name: Build (real mode)
    runs-on: ubuntu-latest
    timeout-minutes: 20

    env:
      VITE_APP_MODE: real
      VITE_USE_MOCK: 'false'
      VITE_SUPABASE_URL: ${{ secrets.REAL_SUPABASE_URL }}
      VITE_SUPABASE_ANON_KEY: ${{ secrets.REAL_SUPABASE_ANON_KEY }}
      VITE_SENTRY_DSN: ${{ secrets.REAL_SENTRY_DSN }}
      SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
      SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}

    outputs:
      release-version: ${{ steps.release.outputs.version }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.ref || github.sha }}
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Compute release version
        id: release
        run: |
          if [[ "${GITHUB_REF}" == refs/tags/* ]]; then
            echo "version=${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"
          else
            echo "version=main-$(git rev-parse --short HEAD)" >> "$GITHUB_OUTPUT"
          fi

      - name: Build (real mode)
        run: pnpm build
        env:
          VITE_RELEASE_VERSION: ${{ steps.release.outputs.version }}

      - name: SPA fallback (404.html = index.html)
        run: cp dist/index.html dist/404.html

      - name: Verify real bundle does not leak dev/mock code
        run: |
          # mock 모듈이 real 번들에 포함되었는지 휴리스틱 검사.
          # tree-shaking 실패 회귀 차단.
          if grep -rE "window\.AppData|__MOCK_FIXTURES__|MockMarketAdapter" dist/assets/ ; then
            echo "::error::Debug-only artifacts leaked into real bundle"
            exit 1
          fi
          if grep -rE "VITE_APP_MODE['\"]?\s*[:=]\s*['\"]dev" dist/assets/ ; then
            echo "::error::dev mode literal embedded in real bundle"
            exit 1
          fi

      - name: Upload Sentry source maps
        run: |
          pnpm dlx @sentry/cli releases new "${{ steps.release.outputs.version }}"
          pnpm dlx @sentry/cli releases files "${{ steps.release.outputs.version }}" \
            upload-sourcemaps dist/assets \
            --url-prefix '~/assets' \
            --validate
          pnpm dlx @sentry/cli releases finalize "${{ steps.release.outputs.version }}"

      - name: Strip source maps from public bundle
        run: find dist -name "*.map" -delete

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy-pages:
    name: Deploy to GitHub Pages
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4

  deploy-edge-functions:
    name: Deploy Supabase Edge Functions
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_PROJECT_REF: ${{ secrets.REAL_SUPABASE_PROJECT_REF }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Link project
        run: supabase link --project-ref "$SUPABASE_PROJECT_REF"

      - name: Apply DB migrations (real)
        run: supabase db push --linked

      - name: Deploy Edge Functions
        run: supabase functions deploy --project-ref "$SUPABASE_PROJECT_REF"

  notify-sentry:
    name: Finalize Sentry release
    needs: [deploy-pages, deploy-edge-functions]
    runs-on: ubuntu-latest
    env:
      SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
      SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    steps:
      - name: Notify deployment
        run: |
          pnpm dlx @sentry/cli releases deploys "${{ needs.build.outputs.release-version }}" \
            new -e production
```

### 4.2 설계 결정

| 항목 | 선택 | 근거 |
|---|---|---|
| `concurrency.cancel-in-progress: false` | 배포 큐잉 | 동시 배포로 인한 race / 중간 상태 노출 회피 |
| Pages 배포 = `actions/deploy-pages@v4` | OIDC + 공식 액션 | `gh-pages` 브랜치 푸시 방식보다 권한 좁힘 |
| Edge Function 별 job 분리 | 실패 격리 | Pages 만 성공·Edge 실패 같은 부분 실패가 알람으로 드러남 |
| Source map 업로드 후 dist 에서 삭제 | 공개 노출 회피 | platform.md "real 모드 소스맵 비공개" 인용 |
| `dlx @sentry/cli` | 별도 라이브러리 설치 회피 | 빌드 캐시 무관 |
| migrate 가 functions deploy 보다 먼저 | 스키마 우선 | 새 컬럼 의존 함수가 먼저 배포돼 500 나는 회귀 차단 |
| **`verify-vault-secrets` 잡** | **Pages·Edge Functions 배포 전 vault drift 검증** | PR #140 에서 마이그 #20260521000010 의 vault 가드를 `raise notice` 로 약화 → cron 잡 runtime silent fail 위험. Management API SQL endpoint 로 `supabase_functions_url` / `service_role_key` 존재만 boolean 으로 SELECT (값 노출 0). 누락 시 deploy 차단. service_role 키는 여전히 CI secret 미저장 (§5 룰 유지) |

### 4.3 거부된 옵션
- **Functions 배포를 Pages 배포 후로**: 새 프론트가 옛 함수 호출하는 시간 창이 더 길어짐. 함수가 먼저(혹은 동시) 가 안전.
- **Pages 와 Edge Functions 같은 job**: 실패 격리 안 됨. 분리 유지.
- **별도 `migrate.yml`**: v1 규모에서 워크플로우 분리 이득 없음. deploy.yml 안 job 으로 충분.

---

## 5. 환경변수 / 시크릿 매트릭스

### 5.1 시크릿 저장소 매핑

| 시크릿 | 저장소 | 워크플로우 노출 | 비고 |
|---|---|---|---|
| `REAL_SUPABASE_URL` | GitHub Secrets | deploy.yml | public 노출 가능값이지만 환경 분리 위해 secret |
| `REAL_SUPABASE_ANON_KEY` | GitHub Secrets | deploy.yml | public 가능 |
| `REAL_SUPABASE_PROJECT_REF` | GitHub Secrets | deploy.yml | Supabase CLI link 용 |
| `DEBUG_SUPABASE_ANON_KEY` | GitHub Secrets | ci.yml | dev 프로젝트 |
| `DEBUG_SENTRY_DSN` | GitHub Secrets | ci.yml | |
| `REAL_SENTRY_DSN` | GitHub Secrets | deploy.yml | |
| `SENTRY_AUTH_TOKEN` | GitHub Secrets | deploy.yml | 소스맵 업로드 권한만. release-only token |
| `SENTRY_ORG`, `SENTRY_PROJECT` | GitHub Secrets (또는 vars) | deploy.yml | 비밀 아니지만 일관성 위해 secret |
| `SUPABASE_ACCESS_TOKEN` | GitHub Secrets | deploy.yml | CLI 호출용 PAT |
| **Supabase service_role key** | **GitHub Secrets 에 저장 금지** | — | credential-vault.md §3 인용. Edge Function 내부에서만 사용 |
| 마켓 OAuth client secret (naver/coupang) | **Supabase 대시보드 → Edge Function env vars** | — | GitHub Secrets 미저장. credential-vault.md §4 |
| 셀러별 마켓 토큰 | **Postgres + pgcrypto** | — | credential-vault.md §5 |

### 5.2 Vite 빌드 시점 주입 변수

| 변수 | dev 값 | real 값 | 노출 영역 |
|---|---|---|---|
| `VITE_APP_MODE` | `dev` | `real` | 번들 상수 |
| `VITE_USE_MOCK` | `true` (또는 `false` for dev:db) | `false` | 번들 상수 |
| `VITE_SUPABASE_URL` | dev 프로젝트 URL | real 프로젝트 URL | 번들 상수 |
| `VITE_SUPABASE_ANON_KEY` | dev anon key | real anon key | 번들 상수 (public) |
| `VITE_SENTRY_DSN` | dev DSN | real DSN | 번들 상수 (public) |
| `VITE_RELEASE_VERSION` | (미설정) | `vX.Y.Z` 또는 `main-<sha>` | Sentry release 매칭 |

> `VITE_*` prefix 가 아닌 변수는 Vite 가 번들에 주입하지 않는다 (platform.md §빌드 결정 인용). 실수로 `SENTRY_AUTH_TOKEN` 이 `VITE_` 가 붙어 번들에 들어가는 사고를 차단하려면 ESLint 의 `no-restricted-globals` 또는 build 후 grep 단계가 안전장치.

### 5.3 GitHub Environment 분리
- `github-pages` environment 에 deploy.yml 의 deploy-pages job 만 매핑.
- 환경 보호 규칙: `main` 브랜치만 배포 가능 (Required reviewers 는 v2 백로그 — v1 은 1인 운영 가정).

---

## 6. dev / real 빌드 매트릭스

| 워크플로우 | 모드 | Supabase 프로젝트 | 시크릿 출처 | 산출물 사용처 |
|---|---|---|---|---|
| `ci.yml` (PR) | dev | dev | GitHub Secrets (`DEBUG_*`*) | 폐기 (artifact 만) |
| `deploy.yml` (main push) | real | real | GitHub Secrets (`REAL_*`) | GitHub Pages 배포 |
| (수동) 로컬 dev | dev | dev | `.env.development.local` (gitignore) | localhost dev |
| (수동) preview build | dev | dev | `.env.development.local` | `pnpm preview` |

### 6.1 real 번들 누출 검증 단계 (deploy.yml 에 포함, §4.1)

```bash
# 1. mock 데이터·어댑터가 들어갔는지
grep -rE "window\.AppData|__MOCK_FIXTURES__|MockMarketAdapter" dist/assets/

# 2. dev 모드 리터럴이 박혔는지
grep -rE "VITE_APP_MODE['\"]?\s*[:=]\s*['\"]dev" dist/assets/

# 3. (선택) sentry auth token / service role key 가 번들에 들어갔는지 (이중 안전망)
grep -rE "sntrys_|sbp_|service_role" dist/assets/ && exit 1 || true
```

> 이 단계는 "권장"이 아니라 **deploy.yml 의 필수 step**. 실패 시 배포 중단.

### 6.2 거부된 옵션
- **런타임 `__DEV__` 토글**: 모드 전환을 런타임에 허용하면 번들에 mock 코드가 항상 포함됨. tree-shaking 가능한 빌드타임 상수만 사용.
- **`.env.production` 파일 커밋**: 실수 시 시크릿 노출. GitHub Secrets 만이 진실의 원천.

---

## 7. Supabase 마이그레이션

### 7.1 단일 소스
- 마이그레이션 SQL: `apps/api/supabase/migrations/<timestamp>_<slug>.sql` — Supabase CLI 규약.
- **dev / real 두 프로젝트 모두 동일한 마이그레이션을 적용**. drift 금지.

### 7.2 적용 시점

| 환경 | 적용 시점 | 명령 |
|---|---|---|
| 로컬 dev | 개발자가 `feature/*` 작업 시 수동 | `pnpm db:push:dev` (dev project) |
| dev 프로젝트 | `develop` 머지 후 수동 1회 또는 별도 `migrate-dev.yml` (v1 은 수동) | 동일 |
| real 프로젝트 | `deploy.yml` 의 `deploy-edge-functions` job 자동 | 동일 |

### 7.3 drift 검출
- 매 배포 전 `supabase db diff --linked` 로 로컬 마이그레이션과 실제 스키마 차이 검출. CI 단계에 포함 (v2 자동화, v1 은 release 컷 시 수동).
- v1 운영 절차: release/* 컷 직후 `supabase db diff --linked --schema public` 실행 → 비어 있어야 함. 비어 있지 않으면 마이그레이션 누락 → 추가 후 다시 컷.

### 7.4 거부된 옵션
- **Prisma migrate / Drizzle migrate**: Supabase CLI 가 RLS 포함 마이그레이션을 처리. 별도 ORM 도입은 YAGNI.
- **수동 SQL 콘솔 적용**: drift 의 주범. 절대 금지.

---

## 8. 릴리즈 절차

### 8.1 정규 릴리즈 (release/*)

1. **컷**: `develop` 의 머지가 안정화되면 `release/<x.y>` 브랜치 생성. 버전 번호 결정.
2. **사전 검증**:
   - `release/*` 에 대한 PR CI 실행 (자동).
   - 수동: `pnpm playwright test`(전체 suite) 로컬 또는 `workflow_dispatch` 트리거.
   - 수동: Supabase dev 프로젝트로 staging smoke test (`pnpm preview` + dev DB).
   - 수동 QA 체크리스트 (qa 에이전트 산출물 — `docs/architecture/v1/qa/release-checklist.md`, 별도 문서).
3. **버전 태그**: `release/*` 머지 PR 생성, main 으로 squash merge. 머지 후 main 에 `vX.Y.0` 태그.
4. **자동 배포**: 태그 push → `deploy.yml` 자동 실행.
5. **백머지**: `main` → `develop` 백머지 PR. CI 통과 후 squash merge.
6. **공지**: Sentry release notes + (v2) 인앱 changelog.

### 8.2 hotfix

1. `main` 에서 `hotfix/<slug>` 분기.
2. 수정 + 단위 테스트 추가.
3. `hotfix/*` → `main` PR. CI 통과 후 squash merge. 태그 `vX.Y.(Z+1)`.
4. 자동 배포.
5. `main` → `develop` 백머지 필수.

### 8.3 버전 규약
- SemVer 준수: `MAJOR.MINOR.PATCH`.
- v1 출시는 `v1.0.0`. 마켓 어댑터 추가는 MINOR, 버그 수정은 PATCH, 데이터 모델 breaking change 는 MAJOR (실무상 v1 기간 발생 시 별도 회의).

---

## 9. 롤백 절차

### 9.1 시나리오 매트릭스

| 사고 유형 | 영향 범위 | 롤백 방법 | 소요 시간 |
|---|---|---|---|
| 프론트 회귀 (빈 화면, 라우팅 깨짐) | Pages | `workflow_dispatch` 로 직전 태그 재배포 | ~10분 |
| Edge Function 회귀 | Supabase | `supabase functions deploy --project-ref ... <fn>` 로 이전 ref 의 함수 재배포 | ~5분 |
| DB 마이그레이션 사고 (잘못된 schema) | Postgres | **down 마이그레이션은 작성·검토된 경우만**. 그렇지 않으면 새 마이그레이션으로 forward fix | 사안별 |
| 시크릿 유출 | 전체 | (1) 노출 키 즉시 회전 (Supabase 대시보드 / Sentry / GitHub Secrets), (2) 새 키로 deploy.yml 재실행 | ~30분 |

### 9.2 프론트 롤백 상세

```bash
# GitHub Actions UI → Deploy (real) → Run workflow
#   ref: v1.2.3   (직전 안정 태그)
# 또는 CLI:
gh workflow run deploy.yml -f ref=v1.2.3
```

- GitHub Pages 의 이전 배포는 `deployments` API 에 남아 있지만, **재배포가 가장 안전한 방법**. UI 의 "Re-run" 으로는 main 의 최신 코드가 다시 빌드되어 의도와 다를 수 있음 → 항상 `workflow_dispatch` + ref 명시.

### 9.3 DB 롤백 원칙
- **forward-only 가 기본**. down 마이그레이션은 작성 가능하지만 신뢰하지 않음.
- 사고 발생 시 절차:
  1. Postgres 의 PITR (Point-In-Time Recovery, Supabase Pro 플랜) 가용성 확인.
  2. 가용하면 사고 직전 시점으로 복구 (RPO ~수분).
  3. 아니면 새 마이그레이션으로 forward fix.
- v1 운영 계정 플랜이 PITR 가능 플랜인지 확인 필요 — credential-vault.md 또는 별도 `ops/backup.md` 에서 다룸 (v1 미작성 시 본 문서가 임시 참조).

### 9.4 거부된 옵션
- **자동 회귀 감지 후 자동 롤백**: 감지 신뢰도 v1 에 검증 안 됨. 오작동 시 더 큰 피해. 수동 트리거 유지.

---

## 10. 모니터링 통합

### 10.1 Sentry release 파이프라인

1. `deploy.yml` 의 `build` job 에서 `sentry-cli releases new <version>` 호출.
2. 소스맵 업로드 (`sentry-cli releases files ... upload-sourcemaps`).
3. `sentry-cli releases finalize <version>`.
4. Pages + Edge Functions 배포 완료 후 `notify-sentry` job 이 `sentry-cli releases deploys <version> new -e production` 호출.
5. 이후 Sentry 가 발생 에러를 해당 release 와 git commit 에 자동 연결.

### 10.2 알림
- Sentry 알림 채널: 이메일 (v1). Slack/Discord 는 v2.
- 임계치: P1 = 5분 내 동일 에러 50건 → 즉시 알림 / P2 = 1시간 내 10건 → 다이제스트.

### 10.3 GitHub Actions 실패 알림
- `deploy.yml` 의 어떤 job 이라도 실패 시 GitHub 의 기본 이메일 알림 사용 (v1).
- v2: Slack incoming webhook job 추가.

### 10.4 거부된 옵션
- **PagerDuty / Opsgenie**: 1인 운영 단계에서 과잉. Sentry 메일 충분.

---

## 11. PR 머지 게이트

`main` 과 `develop` 의 GitHub branch protection rules:

### 11.1 `develop` 머지 필수 조건

required status checks (`.github/rulesets/develop.json`, strict policy) — **항상 실행되는 잡 3개만**:

- [ ] `CI Gate` 통과 — 전체 잡(build/e2e/pgTAP 포함) result 를 집계. 무거운 잡이 실패하면 Gate 가 차단, skip(경로필터·feature push)되면 허용
- [ ] `Lint & Typecheck` 통과
- [ ] `Unit & Integration (Vitest)` 통과
- [ ] Linear history 유지 (squash merge only) + review thread resolution
- [ ] PR 제목이 `[<도메인>] <요약>` 형식
- [ ] PRD/user_flow 정합성 — 새 화면/엔드포인트 추가 시 `docs/architecture/v1/` 산출물 동기화 (CLAUDE.md "2개 산출물 동기화" 룰)

> **왜 build/e2e/pgTAP 을 직접 required 로 두지 않는가**: 이 잡들은 경로 필터·feature push 로 skip 될 수 있다. strict 정책에서 skipped 잡을 required 로 두면 status 가 영구 pending → 머지 영구 차단. 그래서 `CI Gate`(`if: always()`) 가 이들의 result 를 집계해 단일 required check 로 대리한다.
>
> **잡 이름 변경 시 `.github/rulesets/develop.json` + live branch protection 동시 갱신 필수** — 어긋나면 PR 영구 BLOCKED (release-deploy 스킬 "branch protection 컨텍스트 정합" 참조).

### 11.2 `main` 머지 필수 조건 (release/* 또는 hotfix/* 에서만)

- [ ] `develop` 필수 조건 전부 통과
- [ ] 골든패스 Playwright 통과
- [ ] a11y 검사 통과 (Playwright + `@axe-core/playwright`, qa 에이전트 룰)
- [ ] Supabase 마이그레이션 변경 시 — dev 프로젝트 적용 + 검증 완료 코멘트 PR 에 첨부
- [ ] security 영향 코드 (auth, 토큰, 자격증명) 변경 시 — security 에이전트 리뷰 승인

### 11.3 CODEOWNERS (예시)

```
# .github/CODEOWNERS
/src/features/markets/        @backend-lead @security-lead
/src/features/registration/   @backend-lead
/src/components/ui/           @frontend-lead @designer-lead
/supabase/migrations/         @backend-lead
/.github/workflows/           @tech-lead
/docs/architecture/v1/        @tech-lead
```

(실 GitHub handle 매핑은 운영 시점에 결정)

---

## 12. 404.html fallback 검증

### 12.1 빌드 시점

- `ci.yml` 과 `deploy.yml` 양쪽에서 `cp dist/index.html dist/404.html` 단계 강제. 누락 시 빌드 실패.

### 12.2 배포 후 검증 (수동 / v2 자동화)

```bash
# 라우터 직접 진입 (예: /dashboard, /register) 시 200 응답인지 확인.
# GitHub Pages 는 404.html 을 200 으로 서빙하지는 않지만 SPA 부트가 가능해야 함.
curl -sI https://<owner>.github.io/<repo>/dashboard | head -1
# → HTTP/2 200 또는 404 + body 가 index.html 과 동일하면 OK
curl -s  https://<owner>.github.io/<repo>/dashboard | grep -q '<div id="root">' && echo OK
```

- 배포 직후 골든패스 Playwright 를 production URL 대상으로 1회 실행 (v2 백로그). v1 은 수동 smoke test.

### 12.3 라우터 설정 연동
- `BrowserRouter basename` 은 GitHub Pages 의 repo path 와 일치해야 함 (`frontend.md` 인용). real 빌드 시 `VITE_BASE_PATH` 환경변수로 주입.

---

## 13. 수락 기준 체크리스트

### 13.1 CI 시스템

- [ ] `feature/**` push 는 Lint & Typecheck / Unit 만 실행한다 (빠른 레인).
- [ ] PR(develop/main/release) 은 풀 게이트(Build dev+real / E2E / pgTAP)를 경로 필터에 맞춰 실행한다.
- [ ] CI Gate 실패 시 머지 버튼이 비활성화된다 (branch protection — CI Gate / Lint & Typecheck / Unit 3개 required).
- [ ] 무거운 잡이 경로 필터로 skip 돼도 CI Gate 가 보고되어 PR 이 영구 pending 되지 않는다.
- [ ] 골든패스 Playwright 가 CI 에서 통과해야 머지 가능.
- [ ] real 번들 누출 검사(leak scan)가 real 빌드 잡에서 통과한다.

### 13.2 배포 시스템

- [ ] `main` push 시 `deploy.yml` 이 트리거되고 사람 개입 없이 GitHub Pages + Edge Functions 까지 배포된다.
- [ ] real 빌드 산출물에 dev 모드 코드/리터럴이 들어가지 않는다 (자동 검증 step 통과).
- [ ] 배포 완료 후 Sentry 에 release 가 등록되고 소스맵이 연결된다.
- [ ] 소스맵은 공개 dist 에서 제거된다.
- [ ] DB 마이그레이션이 Edge Function 배포 전에 적용된다.

### 13.3 환경 분리

- [ ] dev / real Supabase 프로젝트가 분리되어 있고, 각 워크플로우가 자기 모드의 시크릿만 사용한다.
- [ ] Supabase service_role key 가 GitHub Secrets 에 저장되어 있지 않다.
- [ ] 마켓 OAuth client secret 이 Edge Function 환경변수에만 존재한다.

### 13.4 롤백

- [ ] `workflow_dispatch` 로 임의 ref 재배포가 가능하다.
- [ ] 직전 안정 태그로 10분 안에 프론트 롤백 가능함을 모의 훈련에서 확인한다 (release 컷 시 1회).
- [ ] DB 사고 대응 절차(PITR 또는 forward fix)가 문서화되어 있다.

### 13.5 SPA fallback

- [ ] `dist/404.html` 이 `dist/index.html` 과 동일하게 생성된다.
- [ ] 라우터 직접 진입 URL (`/dashboard`, `/register`, `/history`) 이 새로고침 시에도 동작한다.

### 13.6 가시성

- [ ] Sentry 에서 release 별 에러율을 비교할 수 있다.
- [ ] GitHub Actions 실행 이력이 최소 90일 보존된다 (기본값 확인).
- [ ] PR 코드 리뷰어가 변경된 워크플로우의 영향 범위를 PR 본문 또는 변경 파일 트리에서 즉시 파악할 수 있다.

---

## 부록 A — 거부된 상위 옵션 요약

| 옵션 | 거부 사유 |
|---|---|
| Vercel / Netlify | 호스팅 = GitHub Pages 결정 확정 (platform.md). 마이그레이션 가치 없음 |
| Cloudflare Pages | 동일 |
| GitLab CI | GitHub 중심 운영. 도구 분산 비용 |
| 자체 호스팅 러너 | 보안·운영 부담. GitHub-hosted 로 충분 |
| 멀티 리전 / 카나리 / 블루그린 | 1인 셀러 규모에 과잉. v2 |
| 자동 회귀 감지 후 자동 롤백 | 신뢰도 부족. 오작동 위험 > 이득 |
| Renovate / Dependabot 자동 머지 (major 포함) | major 는 break 위험. **patch/minor 만 자동 머지 도입** (2026-05-28, `.github/workflows/dependabot-auto-merge.yml`) — develop branch protection 의 required check(2026-05-30 부터 CI Gate / Lint & Typecheck / Unit 3개) 통과 요건은 그대로 유지. major / ignored 패키지(React 등) 는 사용자 명시 머지 |

---

## 부록 B — 후속 결정 트리거

다음 사건이 발생하면 본 문서 갱신:

1. 셀러 수 / MAU 가 v1 베타 한도 (대략 100명) 를 넘어가면 → 카나리 / staging 환경 도입 검토.
2. Edge Function timeout 한도 사고 발생 → 큐 시스템(예: Supabase Queues, 또는 외부 큐) 도입 결정문 추가.
3. Sentry 에러량이 메일 알림으로 감당 불가 → Slack/PagerDuty 연동.
4. 마켓 API 정책 변경으로 Edge Function 핫픽스 빈도가 주 1회를 초과 → 어댑터별 독립 배포 워크플로우 분리.
5. 디자인 시스템 안정화 → Chromatic 등 비주얼 회귀 도입.
6. 결제·정산 모델 도입 (v2) → PCI-DSS 적용 범위 재검토, 시크릿 매트릭스 갱신.

---

## 부록 C — 인용 매핑

| 본 문서 절 | 인용 문서 / 결정 |
|---|---|
| §2 브랜치 전략 | CLAUDE.md "브랜치 전략" (Git Flow), platform.md |
| §3 CI 워크플로우 | testing.md (Vitest/RTL/Playwright 골든패스), frontend.md (size budget, ESLint) |
| §4 배포 워크플로우 | platform.md (Pages + Edge Functions), frontend.md (404.html SPA fallback) |
| §5 시크릿 매트릭스 | security.md (service_role 비저장), cross-cutting/credential-vault.md §3/§4/§5 |
| §6 모드 매트릭스 | CLAUDE.md "빌드 모드: dev / real + useMock 플래그" |
| §7 Supabase 마이그레이션 | platform.md (Supabase CLI 단일 소스) |
| §10 Sentry | frontend.md (Sentry beforeSend 마스킹), security.md |
| §11 PR 게이트 | CLAUDE.md "3개 산출물 동기화", qa 룰 (a11y) |
| §12 404 fallback | frontend.md (GitHub Pages SPA fallback) |
