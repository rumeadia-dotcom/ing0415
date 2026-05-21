# MarketCast — WIP 핸드오프 (2026-05-20)

**HEAD**: `fe6294a` (develop) — 475 passed / 26 todo / 0 failed

## 스택 한눈에

```
프론트:  React 18 + Vite + TS strict + shadcn + Tailwind + TanStack Query + RHF + zod
백엔드:  Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions Deno)
호스팅:  GitHub Pages (정적 SPA + 404.html fallback) + Supabase Cloud
모니터링: Sentry (PII 마스킹 강제)
CI/CD:   GitHub Actions (PR + main 분리, auto-merge 활성)
브랜치:  Git Flow (main / develop / release/* / feature/* / hotfix/*)
빌드모드: debug (mock 어댑터) / real (운영 API), Supabase 프로젝트 분리
```

## 도메인 모델

```
Seller (auth.users) ─┬─ MarketAccount ─── credential_payload jsonb + pgcrypto
                     ├─ Product ─┬─ ProductImage ─ ImageTransform (마켓별 N)
                     │           └─ ProductMarketMapping (카테고리/규격)
                     └─ RegistrationJob ─── JobMarketResult (1:N)
                                            잡 상태 7전이: pending→running→partial|succeeded|failed|retrying|cancelled
                                            결과 상태 5종: pending/in_flight/success/failed/failed_final
```

## 완료된 작업 (전체 요약)

| 단계 | 내용 | 커밋/PR |
|---|---|---|
| Stage A~H | 부트스트랩 (빌드·디자인·라우팅·데이터계층·DB마이그·EdgeFn·테스트·CI) | — |
| B-1~B-5 | 인증·대시보드·상품등록·마켓계정·이력 본구현 + 브랜드 리스킨 | — |
| C-1~C-3 | 네이버 OAuth / 쿠팡 HMAC / G마켓·옥션 ESM real 어댑터 | PR #2 #14 #17 |
| C-4 | 4마켓 fan-out 통합 시나리오 12종 (mock 기반) | PR #12 |
| D-A~D-D | axe E2E / pgTAP RLS / 법적 페이지 / Sentry PII 마스킹 | PR #11 #13 #15 #16 |
| 운영 배포 | GitHub Pages 배포 (`https://rumeadia-dotcom.github.io/ing0415/`) | `5ad98e7` |
| Hotfix #21 | GitHub Pages SPA basename 불일치 수정 (`VITE_BASE_PATH=/ing0415/`) | PR #21 `74f6c66` |
| Hotfix #22 | CI notify-sentry 잡 `pnpm dlx` → `npx` 수정 | PR #22 `991957d` |
| Hotfix #23 | `authenticated` 롤 테이블 GRANT 누락 마이그레이션 추가 | PR #23 `b06bfc7` |

## 운영 현황

- **배포 URL**: `https://rumeadia-dotcom.github.io/ing0415/`
- **real Supabase DB**: PR #23 마이그레이션 적용 필요 → Actions → "Deploy (real)" → `apply_db_migrations: true`
- **auto-merge**: repo 설정 활성화 완료 — PR 생성 후 `enable_pr_auto_merge` 로 CI 통과 시 자동 머지

---

## 남은 작업

### 🔴 외부 차단 (사람이 해야 하는 선행 조건)

| 항목 | 차단 내용 | 해제 시 가능해지는 것 |
|---|---|---|
| 베타 셀러 모집 (1~2명) | 실 사업자 자격증명 없음 (OAuth/HMAC/ESM 키) | C-1/C-2/C-3 실 API E2E |
| 네이버 type=SERVICE 확인 | `apicenter.commerce.naver.com` 외부 SaaS 등록 심사 조건 미확인 | C-1 OAuth 콜백 본 연동 |
| 쿠팡 Wing OpenAPI IP 정책 | Edge Function outbound IP 동적 여부 — 11번가 전례 있음 | C-2 운영 API 연결 |
| G·옥션 ESM+ 키 발급 심사 | 관리자 심사 ~1주 | C-3 운영 API 연결 |

### 🟡 코드 작업 (차단 없음, 즉시 진입 가능)

#### 1. 시드 셀러 `qa@marketcast.test` 생성
- debug Supabase 프로젝트에 테스트 셀러 계정 생성
- Golden Path e2e (G1~G15) fixme 해제 + axe 14 fixme 해제 전제 조건
- MSW oauth handler wiring 병행 필요

#### 2. pg_cron 토큰 갱신 트리거 마이그레이션
- C-1 스켈레톤에서 제외된 항목
- `apps/api/supabase/migrations/` 신규 마이그레이션 파일
- `markets-token-refresh-cron` Edge Function 연동 (함수 자체는 C-1 에서 작성됨)

#### 3. URL query 파라미터 PII 마스킹
- D-D 에서 발견된 한계: `beforeBreadcrumb` 에서 URL query string 내 `code=`, `state=` 미파싱
- `apps/web/src/lib/security/redact.ts` `redactUrl()` 함수 추가

#### 4. 부하 테스트 (동시 잡 10 / 마켓 4 fan-out)
- `tests/load/` 신규 디렉토리
- 실 API 연결 전 mock 기반으로 선행 작성 가능

### 🟢 Phase 4 — 운영 게이트 (시드 셀러 해제 후)

| 항목 | 현황 |
|---|---|
| 골든패스 E2E 100% (G1~G15) | 전체 fixme — 시드 셀러 생성 시 해제 |
| axe 0 violation (18 라우트) | 4 active ✅, 14 fixme — 시드 셀러 생성 시 해제 |
| pgTAP RLS cross-tenant | SQL 완성 (102 케이스), CI `supabase test db` 연동 필요 |
| Sentry 마스킹 운영환경 실검증 | debug 검증 완료, real Sentry 프로젝트 연동 후 재확인 |
| KPI view 정확도 | SQL 완성 (16 케이스), pg_cron 트리거 완료 후 재검증 |
| release/v0.2 컷 → 수동 QA → main 머지 | 위 항목 통과 후 |

### 🔵 Phase 5 — v1 출시 후

- 법적 페이지: 콘텐츠 초안 완성, **법률 전문가 검토 후 최종 확정** 필요
- 베타 셀러 5~10명 온보딩
- 운영 모니터링 24h + 첫 4주 KPI 베이스라인 수집

---

## v2 백로그

- 11번가 통합 (Pro 고정 IP / Cloudflare Worker 프록시 / 화이트리스트 해제 신청 중 결정)
- s4 템플릿 관리 전체
- 소셜 로그인 (Google / Naver provider)
- 2FA, 알림 설정
- CSV/Excel 내보내기
- 등록이력 고급 필터·통계 차트
- 마켓 단건 재시도 (현재 전체 재시도)
- 카테고리 자동 추천 ML
- HTML WYSIWYG 상세 에디터
- WebKit·Firefox E2E 활성

---

## 다음 세션 진입

```bash
git pull origin develop && pnpm install && pnpm test && pnpm dev
```

**475 passed** 확인 후 진입.

즉시 시작 가능한 첫 작업: **시드 셀러 생성** (debug Supabase 콘솔) → Golden Path fixme 14개 해제 → E2E CI 100%.

그 다음: **pg_cron 마이그레이션** + **URL PII 마스킹** → 운영 게이트 항목 순차 처리.

**⚠ real DB**: Actions → "Deploy (real)" → `apply_db_migrations: true` 로 PR #23 마이그레이션 적용 필요.
