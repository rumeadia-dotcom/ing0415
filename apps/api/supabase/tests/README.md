# apps/api/supabase/tests — pgTAP RLS 회귀 테스트

D-B 산출물 (WIP §D Phase 4 "보안 감사 — RLS 격리 cross-tenant (pgTAP)").

본 디렉토리는 Postgres RLS 정책이 cross-tenant (셀러 A ↔ 셀러 B) 격리를 깨지 않는지
회귀하는 pgTAP 스위트다. 데이터 모델 변경 / RLS 정책 수정 PR 마다 자동 실행해 유출
회귀를 잡는다.

## 파일

| 파일 | 목적 |
|---|---|
| `rls-cross-tenant.sql` | 17 엔티티 × 6 시나리오 = 102 케이스. 셀러 A 가 셀러 B 데이터를 어떤 채널로도 보거나 변조할 수 없음을 단언. |

## 시나리오 (각 엔티티 공통)

1. `authenticated A` 가 본인 row 만 SELECT 가능 (B row 0건).
2. `authenticated A` 가 B row 명시 SELECT → 0건 (RLS using 절 차단).
3. `authenticated A` 가 B row UPDATE → 0 rows affected.
4. `authenticated A` 가 B row DELETE → 0 rows affected.
5. `anon` 권한으로 SELECT → 0건 (anon 자체 차단).
6. `service_role` 권한으로 SELECT → 양 셀러 row 가시 (관리자 우회).

## 대상 엔티티 (17개)

마이그레이션에 정의된 RLS-ENABLED 테이블 전수:

- `public.sellers` (auth.md §2.2.1)
- `public.audit_log` (security.md §12)
- `public.market_credentials` (credential-vault.md §3.2, **service_role only**)
- `public.oauth_state` (markets.md §2.5, **service_role only**)
- `public.market_credentials_audit` (credential-vault.md §10.1, **service_role only**)
- `public.market_accounts` (markets.md §2.2)
- `public.market_account_audit` (markets.md §2.4, **service_role only**)
- `public.shipping_policies` (registration.md §3.2)
- `public.products` (registration.md §3.3)
- `public.product_images` (image-pipeline.md §6)
- `public.product_image_transforms` (image-pipeline.md §6, SELECT only via image join)
- `public.product_market_mappings` (registration.md §3.5)
- `public.registration_jobs` (registration-job-state.md §3.4)
- `public.registration_job_market_results` (registration-job-state.md §3.4)
- `public.events` (kpi.md §2)
- `public.sessions` (kpi.md §3)
- `public.nps_responses` (kpi.md §4)

`templates` 는 v2 백로그 (현재 마이그레이션 부재) 라 본 PR 의 범위 밖.

`storage.objects` 의 버킷 prefix RLS (image-pipeline.md §3.3) 는 별도 스위트 권장 —
파일 객체 fixture 필요 → 본 SQL-only 스위트와 의존성 충돌. 후속 PR (D-B 확장) 에서 처리.

## 실행 방법

### 1) Supabase CLI (권장)

`supabase test db` 는 격리된 임시 DB 에서 `tests/*.sql` 를 자동 실행한다.

```bash
# 로컬 Supabase 가 떠 있는 상태 (linked 프로젝트 = debug 추천)
cd apps/api
supabase start                    # 1회
supabase test db                  # 모든 tests/*.sql 실행
```

또는 직접 한 파일만:

```bash
supabase test db tests/rls-cross-tenant.sql
```

### 2) 로컬 psql (CI / 디버그)

`supabase db reset` 후 DB 가 마이그레이션을 모두 적용한 상태에서 직접 실행:

```bash
psql "$DATABASE_URL" -f apps/api/supabase/tests/rls-cross-tenant.sql
```

테스트 파일 자체가 `begin; ... rollback;` 으로 격리되어 있어 운영/스테이지 DB 에
잔여 row 가 남지 않는다. 단, 운영 DB 에 직접 실행하는 것은 권장하지 않는다 —
`auth.users` 에 임시 픽스처가 잠시 INSERT 되었다가 ROLLBACK 되더라도 트리거 부수
효과 (예: `handle_new_seller` 가 `public.sellers` 에 INSERT, append-only audit 트리거 등)
가 사후에 추적되면 운영 시그널과 섞일 수 있다.

**원칙: 본 스위트는 debug Supabase 프로젝트에서만 실행.** real 프로젝트 적용은
스키마 drift 검증 (`supabase db diff`) 만 수행.

### 3) CI 통합

본 PR 의 범위는 SQL 파일 추가만이며, CI 통합 (예: `.github/workflows/db-tests.yml`)
은 별도 후속 PR 로 분리한다. 이유:

- pgTAP CI 잡은 Supabase 컨테이너 + Postgres 17 부팅이 필요해 기존 PR 게이트
  (lint / typecheck / vitest / build / e2e) 와 의존성·실행 시간 모두 다르다.
- WIP §D Phase 4 에 묶이는 보안 감사·KPI view 정확도·부하 테스트와 함께 별도 워크플로우
  (`security-audit.yml`) 로 묶는 것이 운영 관리 비용이 낮다.

후속 PR 에서 `db-tests` job 을 추가할 때는 다음 패턴을 사용:

```yaml
- uses: supabase/setup-cli@v1
- run: supabase start
- run: supabase test db
```

## 새 RLS-ENABLED 테이블 추가 시

신규 마이그레이션이 RLS 를 활성화하는 테이블을 추가하면, **본 스위트에 해당 엔티티의
6 시나리오 블록을 반드시 추가**한다. 회귀 누락이 보안 사고로 직결되므로 PR 머지 차단
대상.

추가 절차:

1. `rls-cross-tenant.sql` 의 `plan(N)` 을 갱신 (현재 102 → +6 per 신규 엔티티).
2. 픽스처 INSERT 1쌍 (A, B) 추가.
3. 6 시나리오 블록 복붙 + 테이블/필드명만 교체.
4. README 의 "대상 엔티티" 섹션 갱신.

## 발견된 정책 누락 (D-B)

현 시점 마이그레이션 11개를 점검한 결과 cross-tenant 격리 측면의 정책 누락은 없음.

- 모든 `public.*` 테이블에 `enable row level security` 확인.
- service_role only 테이블 (`market_credentials` / `oauth_state` / `market_credentials_audit`
  / `market_account_audit`) 은 정책 0개로 의도적 차단 — 본 스위트가 회귀 보증.
- 클라이언트 SELECT 가능한 테이블은 모두 `seller_id = auth.uid()` 또는 자식 테이블의
  경우 부모 join 으로 격리.

향후 마이그레이션 PR 에서 누락이 발견되면 동일 PR 또는 hotfix 마이그레이션으로 보강하고
본 스위트에 회귀 케이스를 추가한다.

## 참고

- `docs/architecture/v1/security.md` §3 RLS 마스터.
- `docs/architecture/v1/cross-cutting/credential-vault.md` §3.2 (CV-T1 ~ CV-T7).
- `docs/architecture/v1/cross-cutting/registration-job-state.md` §3.4.
- `docs/handoff/WIP-5markets-mvp.md` §D Phase 4.
