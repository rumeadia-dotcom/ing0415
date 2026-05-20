# MarketCast

다중 마켓 상품 자동 등록 SaaS. 개인 판매자가 상품 정보를 한 번 입력하면 네이버 스마트스토어, 쿠팡, 11번가, G마켓, 옥션 같은 복수 온라인 마켓에 동시에 등록할 수 있도록 자동화합니다.

## 설명

각 마켓별로 상이한 상품 등록 양식·이미지 규격·카테고리 체계 때문에 반복 입력에 소비되는 시간을 제거하는 것이 목표입니다. 셀러는 한 번의 입력으로:

- 최소 3개 이상의 마켓에 동시 등록 (장기 목표)
- 마켓별 요구사항(상품명 길이·가격 정책·카테고리 코드·이미지 규격)에 맞춰 **자동 변환**
- 등록 결과(성공/부분 실패/실패) 를 실시간 대시보드로 확인
- 실패 마켓만 재시도 또는 제외 후 재등록

타겟은 2개 이상의 마켓을 운영하는 1인 기업가·소규모 셀러입니다. 자세한 제품 요구사항과 사용자 시나리오는 [`docs/spec/PRD.md`](docs/spec/PRD.md) 및 [`docs/spec/user_flow.md`](docs/spec/user_flow.md) 참고.

### 마켓 라인업

**v1 정식 = 네이버 / 쿠팡 / G마켓 / 옥션 (real 어댑터까지 동작). v2 예정 = 11번가.**

- 어댑터 인터페이스: AuthInput 4-way discriminated union (`oauth_code` | `hmac_key` | `esm_jwt` | `api_key`). credential 저장은 `credential_payload jsonb` 단일 컬럼 + pgcrypto 암호화.
- 네이버 = OAuth 2.0 (type=SELF), 쿠팡 = HMAC-SHA256, G마켓·옥션 = ESM JWT (site='G'|'A'), 11번가 = API Key + IP 화이트리스트.
- 11번가는 Supabase Edge Function 의 outbound IP 동적 문제로 v2 이관 — Pro 고정 IP / 외부 프록시 / 11번가 측 해제 신청 중 결정 후 진입 (2026-05-19 결정, OQ-10).

## 기술 스택

| 영역 | 선택 |
|------|------|
| 언어 | TypeScript (strict + `noUncheckedIndexedAccess`) |
| 프론트엔드 | React 18 + Vite |
| 라우팅 | React Router v6 (GitHub Pages 404.html fallback) |
| UI | shadcn/ui + Tailwind CSS (라이트/다크) |
| 데이터 페칭 | TanStack Query + Supabase JS |
| 폼 | React Hook Form + zod resolver |
| 패키지 매니저 | pnpm |
| 테스트 | Vitest + React Testing Library + Playwright |
| Lint/Format | ESLint + Prettier |
| 에러 추적 | Sentry (PII 자동 마스킹) |
| 백엔드 / DB / Auth / Storage | Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions) |
| 호스팅 | 프론트: GitHub Pages · 백엔드: Supabase Edge Functions |
| CI/CD | GitHub Actions (PR CI + `main` 푸시 자동 배포) |
| 접근성 | WCAG 2.1 AA (`eslint-plugin-jsx-a11y` + `@axe-core/playwright`) |

## 실행 방법

### 사전 준비

- Node.js 20+
- pnpm 9+
- Supabase 프로젝트 2개 (debug / real 분리)
- `.env.local` 작성 — 아래 `환경 변수` 참고

### 개발 환경 (debug 모드)

mock 픽스처 + 마켓 mock 어댑터 + 소스맵 + verbose 로깅.

```bash
pnpm install
pnpm dev              # VITE_APP_MODE=debug 로 기동
```

기본 포트: `http://localhost:5173`

### 운영 빌드 (real 모드)

실제 Supabase + 마켓 운영 API. `main` 브랜치 푸시 시 GitHub Actions 가 자동 수행하지만, 로컬에서 검증할 수도 있습니다.

```bash
pnpm build            # VITE_APP_MODE=real 로 정적 자산 빌드 (dist/)
pnpm preview          # dist/ 를 로컬에서 미리보기
```

GitHub Pages 배포는 `dist/index.html` 을 `dist/404.html` 로도 복제해야 SPA 라우팅이 동작합니다 (워크플로우가 처리).

### 자주 쓰는 명령

| 명령 | 설명 |
|------|------|
| `pnpm dev` | debug 모드 개발 서버 |
| `pnpm build` | real 모드 프로덕션 빌드 |
| `pnpm preview` | 빌드 결과 로컬 미리보기 |
| `pnpm test` | Vitest 단위·통합 |
| `pnpm test:e2e` | Playwright E2E (골든 패스) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm format` | Prettier write |

### 환경 변수

`.env.local` (런타임 시크릿 보관 불가 — public 노출 가능한 값만):

```env
VITE_APP_MODE=debug                # debug | real
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SENTRY_DSN=...                # 선택
```

Edge Function 의 서비스 키·마켓 API 시크릿은 Supabase 대시보드에서 별도 설정합니다 (GitHub Secrets 미저장).

### 빌드 모드

| 항목 | debug | real |
|------|-------|------|
| 데이터 소스 | mock 픽스처 | Supabase 운영 프로젝트 |
| 마켓 API | mock 어댑터 (5xx / 401 / 429 / 부분 실패 재현) | 운영 API |
| 소스맵 | 활성화 | 비활성화 (또는 Sentry 전용) |
| 로깅 | verbose | warn 이상 + 구조화 |

## 프로젝트 구조

모노레포 스타일 — FE (`apps/web/`) 와 BE (`apps/api/`) 분리. 2026-05-19 정리.

```
ing0415/
├─ apps/
│  ├─ web/                  # 프론트엔드 (Vite root)
│  │  ├─ index.html
│  │  └─ src/
│  │     ├─ features/       # 도메인별 묶음 (user_flow s1~s6 매핑)
│  │     │  ├─ auth/        # s1 인증
│  │     │  ├─ dashboard/   # s2 대시보드
│  │     │  ├─ registration/# s3 상품 등록 5단계
│  │     │  ├─ templates/   # s4 템플릿 관리 (v2)
│  │     │  ├─ markets/     # s5 마켓 계정 관리
│  │     │  └─ history/     # s6 등록 이력
│  │     ├─ components/ui/  # shadcn/ui 컴포넌트
│  │     ├─ lib/            # 공용 hook · 유틸 · zod 스키마
│  │     └─ locales/        # i18n 사전 (ko.ts)
│  └─ api/
│     └─ supabase/          # 백엔드 (Supabase CLI workdir)
│        ├─ migrations/     # SQL 마이그레이션 (debug·real 양쪽 적용)
│        └─ functions/      # Edge Functions (마켓 어댑터)
├─ docs/
│  ├─ spec/                 # PRD.md · user_flow.md (제품 요구사항 마스터)
│  ├─ architecture/v1/      # 영구 설계문서
│  ├─ frontend_html_design/v1/  # 정식 HTML 프로토타입
│  ├─ handoff/              # 세션 간 WIP 메모 (일회성)
│  └─ legacy/prototype-v0/  # v0 시각 레퍼런스 (읽기 전용)
├─ tests/                   # cross-cutting (Vitest unit + Playwright e2e + fixtures)
├─ scripts/                 # 빌드 헬퍼 (postbuild-spa.mjs)
├─ vite.config.ts           # root=apps/web, outDir=루트 dist/
├─ tsconfig.*.json          # @/* → apps/web/src/*
└─ CLAUDE.md                # AI 어시스턴트 작업 가이드
```

상세 디렉토리 규약·도메인 매핑은 [`CLAUDE.md`](CLAUDE.md) 참고.

## 문서

| 문서 | 설명 |
|------|------|
| [docs/spec/PRD.md](docs/spec/PRD.md) | 제품 요구사항 (5개 대기능 / 약 70개 세부 기능) |
| [docs/spec/user_flow.md](docs/spec/user_flow.md) | 사용자 플로우 (6 섹션 · 46 노드 · 48 엣지) |
| [CLAUDE.md](CLAUDE.md) | 아키텍처 결정 · 도메인 모델 · Rules · 디렉토리 구조 |
| [설계 문서](docs/architecture/v1/) | 플랫폼/프론트엔드/UI 스타일 설계 |
| [기능별 설계](docs/architecture/v1/features/) | 기능 단위 데이터 모델·API 스키마·UI 흐름 |
| [HTML 프로토타입 (v1)](docs/frontend_html_design/v1/) | 정식 화면별 프로토타입 |
| [HTML 프로토타입 (v0)](docs/legacy/prototype-v0/index.html) | 초기 시각 레퍼런스 — MarketCast 5탭 데모 (읽기 전용) |
| [세션 핸드오프 메모](docs/handoff/) | WIP 작업 상태 (일회성) |

## 라이선스

내부 프로젝트 — 라이선스 미정.
