# MCP hosting — DB 제한 role / 뷰 SQL (수동 적용)

설계 ground truth: [`docs/architecture/v1/cross-cutting/mcp-hosting.md §4 / §5`](../../../docs/architecture/v1/cross-cutting/mcp-hosting.md).

**Phase 2 산출물.** MCP 전용 read-only Postgres role + (real) deny-by-default 뷰 스키마 `mcp_ro`.

## ⚠ 적용 정책 (중요)

- **제품 마이그레이션 시퀀스와 분리**. 이 SQL 은 `apps/api/supabase/migrations/` 에 넣지 않는다. CI/CD `apply_db_migrations` 게이트와 무관하게 **운영자가 수동 1회 적용** (개발 인프라 — `ci-cd.md §7` drift 정책과 분리, `mcp-hosting.md §5` 머리말).
- **real 과 dev 는 별도 Supabase 프로젝트**. 교차 적용 금지.
  - real = `lfrnythcujxdhehvkmtg` → `real/` 만 적용
  - dev  = `eqoywqoalwkwbrdsulfl` → `dev/` 만 적용

## 파일

| 파일 | 대상 | 내용 |
|---|---|---|
| `real/01_role_and_deny.sql` | real | `mcp_ro_real` role + `revoke usage on schema public` deny-by-default + read-only 강제 (§5.1) |
| `real/02_mcp_ro_views.sql` | real | `mcp_ro` 스키마 + PII-redacted 행 뷰 + 전역 집계(KPI) 뷰 + select grant (§5.2/§5.3) |
| `dev/01_role_readonly.sql` | dev | `mcp_ro_dev` role — public 전체 read, 단 자격증명 테이블/decrypt 함수 차단 (§5.4) |

## 적용 순서

### real (lfrny...) — 순서 중요 (01 → 02)

```bash
# Supabase 대시보드 SQL Editor 또는 psql (postgres/service 권한)
# 1) role + deny + read-only
\i real/01_role_and_deny.sql
# 2) mcp_ro 스키마 + 뷰 + grant
\i real/02_mcp_ro_views.sql
```

### dev (eqoyw...)

```bash
\i dev/01_role_readonly.sql
```

### 패스워드 설정 (양 프로젝트 공통)

SQL 의 `'<<<REPLACE_WITH_32B_RANDOM>>>'` 플레이스홀더 대신, 적용 후 강한 패스워드를 별도로 설정하고 그 값을 인스턴스 `/etc/mcp-hosting/env` 의 `DATABASE_URI_*` 에 넣는다 (git 미관리):

```sql
alter role mcp_ro_real password '<32B-random>';   -- real
alter role mcp_ro_dev  password '<32B-random>';    -- dev
```

```bash
# 32B random 생성
openssl rand -base64 32
```

## 적용 검증 (Phase 5)

```sql
-- real: 봉쇄 확인
set role mcp_ro_real;
select count(*) from mcp_ro.orders_redacted;       -- OK (receiver_* = '<redacted>')
select * from public.orders limit 1;               -- ERROR: permission denied for schema public
select * from public.market_credentials limit 1;   -- ERROR: permission denied for schema public
insert into mcp_ro.jobs default values;            -- ERROR: read-only transaction / permission denied
reset role;

-- dev: sandbox read + 자격증명 차단
set role mcp_ro_dev;
select count(*) from public.products;              -- OK
select * from public.market_credentials limit 1;   -- ERROR: permission denied for table
reset role;
```

## 새 조회 니즈 발생 시 (real)

real 은 사전 정의된 `mcp_ro` 뷰만 노출한다 (임의 쿼리 불가 — 안전성과의 교환, `mcp-hosting.md §13`). 새 컬럼/테이블을 노출하려면:

1. `02_mcp_ro_views.sql` 에 PII-redacted 뷰를 추가 (PII 컬럼은 `'<redacted>'` 리터럴).
2. real 프로젝트에 수동 재적용 (`create or replace view ...` + `grant select`).
3. 신규 base table 직접 GRANT 는 절대 금지 — 반드시 뷰 경유.
