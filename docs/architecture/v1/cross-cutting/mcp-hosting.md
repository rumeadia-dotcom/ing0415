# mcp-hosting.md — 원격 MCP 서버 호스팅 설계 (개발 인프라)

> 마스터 문서. v1 도입 (2026-05-27). 본 문서가 ground truth.
>
> **분류**: 개발 인프라 (chore). 제품 기능 아님 — release 흐름(`develop → release/* → main`)과 섞지 않는다. 작업 브랜치 `chore/mcp-hosting`.
>
> **목적**: 기존 AWS Lightsail **Market Gateway** 인스턴스(서울 `ap-northeast-2`, 고정 IP `3.36.239.243`)에 개발용 **원격 MCP 서버 묶음**을 추가 호스팅한다. 단일 개발자(멀티 디바이스)가 회사/집/모바일(LTE)에서 Claude Code 로 접속해 dev/real Supabase 데이터·브라우저 자동화·Sentry·GitHub 를 MCP 로 조회한다.
>
> **절대 제약 (먼저 읽을 것)**:
> 1. 기존 gateway systemd Deno 서비스(`market-gateway.service`)와 그 비밀(`/etc/market-gateway/env`, `MARKET_GATEWAY_SECRET`, 마켓 자격증명)은 **절대 건드리지 않는다**. MCP 가 침해돼도 gateway 비밀은 안전해야 한다.
> 2. 고정 IP `3.36.239.243` 은 **절대 변경/release 금지** (5개 마켓 셀러 콘솔 화이트리스트 — `market-gateway.md §2`). MCP 추가가 IP/네트워크 구성을 건드리지 않는다.
> 3. **real DB 변조 0**. real 접근은 read-only 강제 + PII·자격증명 절대 미노출.

---

## 0. 확정 결정 요약

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| D-1 | 인스턴스 | 기존 gateway Lightsail **재사용** | IP 화이트리스트 자산 재활용. 신규 인스턴스 = 신규 IP = 화이트리스트 재등록 부담 |
| D-2 | 프로세스 격리 | MCP 는 **docker-compose** 단일 스택, gateway 와 파일·프로세스·uid 분리 | gateway 비밀 격리 (§7) |
| D-3 | 인증 | **강한 Bearer(256-bit) + HTTPS(Caddy 자동 TLS)** 단일화. 엔드포인트별 별도 토큰 + 즉시 rotation | 멀티 디바이스(가변 IP) → IP allowlist 불가 (§6) |
| D-4 | 도메인 | **sslip.io 서브도메인** `mcp.3-36-239-243.sslip.io` | 기존 gateway 와 동일 방식. 도메인 구매·DNS 0. IP 영구 고정이라 sslip.io 단점 무의미 (§3) |
| D-5 | real DB 접근 | **전용 뷰 스키마 `mcp_ro` deny-by-default** + MCP 전용 제한 Postgres role | base table·PII·자격증명 원천 차단. drift 시에도 PII 유출 0 (§4, §5) |
| D-6 | transport | **Streamable HTTP**. stdio-only MCP 는 supergateway 로 HTTP 래핑 | MCP 현행 표준 |
| D-7 | 보안그룹 inbound | **변경 없음** (443 이미 개방 · 22 기존 유지 · 80 ACME 유지). 신규 포트 0 | MCP 는 기존 443 vhost 위에 올라탐 (§6.1) |
| D-8 | 인스턴스 사양 | **2GB plan($10/월) — 적용 완료** (3.36.239.243, headless chromium + docker 오버헤드 흡수) | 2026-05-28 사고 후 마이그레이션 완료 (§14). 1GB 이하 다운사이즈 시 gateway OOM 위험 (§9.2) |

---

## 1. 아키텍처

```
                                    ┌──────────────────────────── AWS Lightsail (Seoul, 고정 IP 3.36.239.243) ────────────────────────────┐
                                    │                                                                                                       │
  멀티 디바이스                      │   :443 (이미 개방)                                                                                    │
  (회사/집/모바일 LTE)               │   ┌──────────────────────── Caddy v2 (호스트 systemd, 자동 TLS) ───────────────────────┐               │
  ─ Claude Code ─┐                  │   │                                                                                     │               │
                 │   HTTPS          │   │  vhost A: 3-36-239-243.sslip.io  ──▶ 127.0.0.1:8787  (기존 gateway Deno — 무수정)    │               │
   Bearer 토큰   ├──────────────────┼──▶│                                                                                     │               │
   (엔드포인트별) │                  │   │  vhost B: mcp.3-36-239-243.sslip.io ──▶ 127.0.0.1:9000 (MCP auth-proxy)              │               │
                 │                  │   └─────────────────────────────────────────────────┬───────────────────────────────┘               │
                 │                  │                                                       │ (호스트 loopback)                              │
                 │                  │   ┌──────────────────── docker-compose 스택 (uid 10001, /opt/mcp-hosting) ──────────────┼─────────┐    │
                 │                  │   │  ┌───────────────┐  Bearer 검증(상수시간) + path 라우팅 + real audit                  │         │    │
                 │                  │   │  │  auth-proxy   │◀───────────────────────────── :9000 (127.0.0.1 published) ────────┘         │    │
                 │                  │   │  └──┬─────┬───┬──┴───┬──────────┬────────────┐  (그 외 컨테이너는 host 미노출, 내부망만)          │    │
                 │                  │   │     │     │   │      │          │            │                                                   │    │
                 │                  │   │  /supabase-dev  /supabase-real  /playwright  /sentry   /github(선택)                            │    │
                 │                  │   │     ▼     ▼   │      ▼          ▼            ▼                                                   │    │
                 │                  │   │  ┌────────┐┌────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────┐                            │    │
                 │                  │   │  │pg-mcp  ││pg-mcp  │ │playwright   │ │sentry    │ │github-mcp    │  (Streamable HTTP)         │    │
                 │                  │   │  │ dev    ││ real   │ │ headless    │ │ mcp      │ │ (read PAT)   │                            │    │
                 │                  │   │  │read-only│read-only│ │ chromium   │ │ (read)   │ │              │                            │    │
                 │                  │   │  └───┬────┘└───┬────┘ └──────┬──────┘ └────┬─────┘ └──────┬───────┘                            │    │
                 │                  │   └──────┼─────────┼─────────────┼─────────────┼──────────────┼────────────────────────────────────┘    │
                 │                  │          │         │             │             │              │                                          │
                 │                  └──────────┼─────────┼─────────────┼─────────────┼──────────────┼──────────────────────────────────────────┘
                 │                             │         │             │             │              │
                 │                  dev Postgres│ real Postgres        │ (egress)    │ Sentry API   │ GitHub API
                 │                  (eqoyw...)  │ (lfrny...)           ▼ web pages    ▼ (read)       ▼ (read)
                 │                  role:       │ role:
                 │                  mcp_ro_dev  │ mcp_ro_real (mcp_ro 뷰 스키마만)
                 │
                 └─ .mcp.json: 게이트웨이 Bearer 토큰만 보관. DB/Sentry/GitHub 토큰은 컨테이너 env 에만.

  ※ gateway 경로(vhost A → :8787 → market-gateway.service)는 1바이트도 바뀌지 않는다. MCP 는 vhost B 만 추가.
```

### 1.1 흐름 요약

1. Claude Code → `https://mcp.3-36-239-243.sslip.io/<endpoint>` (엔드포인트별 Bearer).
2. Caddy(호스트, 443) 가 TLS 종단 후 `mcp.` Host 만 `127.0.0.1:9000`(auth-proxy)로 reverse-proxy. gateway vhost 는 별도 site 블록 — 무수정.
3. auth-proxy(컨테이너) 가 (a) path → 엔드포인트 식별 (b) Bearer 상수시간 검증 (c) `/supabase-real` 은 audit 로그 1줄 적재 (d) 내부망의 해당 MCP 컨테이너로 스트리밍 프록시.
4. MCP 컨테이너는 **호스트에 포트를 열지 않는다** (auth-proxy 만 `127.0.0.1:9000` 노출). 외부 진입점은 Caddy 443 단 하나.

### 1.2 왜 호스트 Caddy 공유인가 (격리 영향 없음)

- 443 은 하나뿐 — 호스트 Caddy 가 이미 점유(gateway TLS 종단). 두 번째 Caddy 를 443 에 띄울 수 없다.
- Caddy 는 **라우팅만** 한다. `MARKET_GATEWAY_SECRET`·마켓 자격증명을 보유하지 않는다. 따라서 "MCP 침해 → gateway 비밀 유출" 위협모델과 무관.
- gateway site 블록 보존을 위해 MCP 설정은 **별도 파일**(`/etc/caddy/mcp.caddy`)로 분리하고 메인 `Caddyfile` 끝에 `import mcp.caddy` 1줄만 추가. gateway 블록은 손대지 않는다.
- 적용은 `systemctl reload caddy` (graceful) — `market-gateway.service`(별도 systemd 유닛) 재시작 없음.

---

## 2. 호스팅 대상 MCP

| 엔드포인트 | MCP | 이미지/패키지 | transport | 인증/접속 | 비고 |
|---|---|---|---|---|---|
| `/supabase-dev` | Postgres MCP (dev) | `crystaldba/postgres-mcp` (`--access-mode=restricted`) | Streamable HTTP (native) | role `mcp_ro_dev` connection string | dev sandbox. 자격증명 테이블만 차단, 그 외 read-only 전체 |
| `/supabase-real` | Postgres MCP (real) | 〃 | 〃 | role `mcp_ro_real` connection string | **`mcp_ro` 뷰 스키마만** 접근. PII·자격증명 원천 차단 (§4/§5). 접근 audit |
| `/playwright` | Playwright MCP | `mcr.microsoft.com/playwright` + `@playwright/mcp --headless` | Streamable HTTP (native) | (옵션) Playwright 자체 토큰 불필요 | headless chromium. 메모리 多 (§9.2) |
| `/sentry` | Sentry MCP | `@sentry/mcp-server` (+ supergateway 래핑) | stdio → Streamable HTTP | `SENTRY_AUTH_TOKEN` (read scope) | 읽기 전용 조회 |
| `/github` (선택) | GitHub MCP | `ghcr.io/github/github-mcp-server` | Streamable HTTP / stdio 래핑 | fine-grained PAT (read scope) | 옵트인. 미사용 시 compose 에서 주석 |

### 2.1 "Supabase MCP" 가 아닌 "Postgres MCP" 인 이유 (중요)

요청서엔 "Supabase MCP" 로 적혀 있으나, **real 접근은 공식 Supabase MCP(`@supabase/mcp-server-supabase`)를 쓰지 않는다.** 공식 서버는 Supabase **Personal Access Token(PAT)** 으로 Management API 를 호출하며, PAT 는 프로젝트 전역 권한(서비스 수준 SQL 포함)을 가져 **RLS·GRANT 모델을 우회**한다 — 사용자가 명시한 "service_role / PAT 금지" 가드레일 위반.

따라서 dev/real 모두 **범용 Postgres MCP** 에 **MCP 전용 제한 role 의 connection string** 만 물린다. 이렇게 하면:
- 접근 가능 객체가 Postgres GRANT 로 강제됨 (real = `mcp_ro` 뷰만).
- read-only 가 (a) role `default_transaction_read_only=on` (b) MCP `--access-mode=restricted` 로 **이중** 강제.
- PAT/service_role 키가 인스턴스에 존재하지 않음 → 유출 표면 제거.

> dev 는 PII 가 없는 sandbox 라 공식 Supabase MCP + 저권한 PAT 도 허용 가능하지만, **dev/real 운영 일관성**을 위해 동일하게 Postgres MCP 로 통일한다.

### 2.2 transport / stdio 래핑

- MCP 현행 표준은 **Streamable HTTP** (구 HTTP+SSE 대체).
- `crystaldba/postgres-mcp`·`@playwright/mcp` 는 HTTP 네이티브.
- stdio-only(예: 일부 빌드의 Sentry/GitHub MCP)는 `supergateway` 로 래핑:
  ```
  npx -y supergateway --stdio "<stdio MCP 실행 커맨드>" \
      --outputTransport streamableHttp --port <port> --host 0.0.0.0
  ```

---

## 3. 도메인 결정 — sslip.io 서브도메인 (확정)

**채택: `mcp.3-36-239-243.sslip.io`**

| 후보 | 내용 | trade-off | 판정 |
|---|---|---|---|
| **sslip.io 서브도메인 (채택)** | `mcp.3-36-239-243.sslip.io` → 3.36.239.243 자동 매핑 | + 도메인 구매·DNS 패널 0 + 기존 gateway(`3-36-239-243.sslip.io`)와 동일 방식 + Caddy Let's Encrypt 자동 발급. − 서드파티 DNS 의존 / "전문" 도메인 아님 | ✅ |
| 신규 실 서브도메인 A레코드 | 보유 도메인 `mcp.<domain>` A → 3.36.239.243 | + 안정·자기 통제. − 도메인 보유 + DNS 관리 필요. **IP 영구 고정이라 안정성 이점 사실상 0** | 보류 |

**근거**:
- 기존 gateway 가 이미 sslip.io 로 운영 중(`market-gateway.md §2 / §10`) → 동일 패턴 재사용이 운영 단순.
- sslip.io 의 통상 단점("IP 바뀌면 도메인도 바뀜")은 **본 IP 가 5개 마켓 화이트리스트로 영구 고정**(절대 변경 금지)이라 해당 없음.
- gateway 와 **다른 Host**(`mcp.` 접두) 라서 Caddy site 블록이 깔끔히 분리 → gateway 블록 무수정 보장.
- Let's Encrypt: sslip.io 는 Public Suffix List 등재 → `mcp.3-36-239-243.sslip.io` 가 독립 rate-limit 버킷. gateway 의 `3-36-239-243.sslip.io` 와 별개 인증서로 충돌 없음.

> 운영 도메인을 추후 보유하게 되면 A레코드 추가 + Caddyfile Host 교체만으로 무중단 전환 가능 (설계 변경 없음).

---

## 4. real 스키마 PII·자격증명 인벤토리

`apps/api/supabase/migrations/` 전수 점검 결과. **real(lfrny...) MCP 에 절대 노출 금지** 대상:

### 4.1 자격증명 테이블 (완전 차단 — 뷰조차 만들지 않음)

| 테이블 | 민감 컬럼 | 비고 |
|---|---|---|
| `auth.users` | `email`, `phone`, `encrypted_password`, 토큰류 | PII 본체. `auth` 스키마 자체 미부여 |
| `public.market_credentials` | `encrypted_access_token`, `encrypted_refresh_token` (bytea 암호문) | service_role only. pgcrypto 암호문도 노출 금지 |
| `public.oauth_state` | `pkce_verifier`, `state` | 1회성 인증 토큰 |
| `public.market_credentials_audit` | (감사) | service_role only |
| `public.logen_credentials` | `user_id_enc`, `cust_cd_enc` (암호문) + `sender_name`/`sender_address`/`sender_phone` (**평문 PII**) | 자격증명 + 발송인 PII 동시 |

### 4.2 PII 보유 — 행 노출 시 redacted 뷰로만

| 테이블 | PII 컬럼 (redact) | 유지 가능 컬럼 |
|---|---|---|
| `public.sellers` | `display_name` (실명 가능) | `id`(=seller_id), `business_type`, `signup_provider`, timestamps |
| `public.orders` | `buyer_name`, `receiver_name`, `receiver_address`, `receiver_phone` | `id`, `seller_id`, `market_id`, `status`, `product_name`, `quantity`, `order_amount`, `waybill_number` 등 |
| `public.market_accounts` | `account_label`, `external_account_id` (보수적 제외) | `id`, `seller_id`, `market_id`, `status`, `last_error_code`, timestamps |
| `public.market_account_audit` | `ip` (raw inet) | (운영상 불필요 → 뷰 미제공) |

### 4.3 기존 public 뷰 — 노출 가부

| 뷰 | PII | MCP 노출 |
|---|---|---|
| `seller_dashboard_summary`, `kpi_monthly_registrations`, `kpi_mau`, `kpi_registration_duration`, `kpi_nps_summary`, `v2_kpi_daily_orders`, `v2_kpi_daily_dispatch` | 없음(집계) | ⚠️ 단, 모두 `security_invoker=on` → `mcp_ro_real`(비-authenticated, `auth.uid()` null)로는 **행 0 또는 권한오류**. 그러므로 **`mcp_ro` 스키마에 `security_invoker=off` 전역 집계 뷰로 미러**해서 노출 (§5.3) |
| `orders_with_dispatch_summary` | **있음** (`receiver_*`, `buyer_name`) | ❌ 노출 금지 |
| `logen_credentials_meta` | **있음** (`sender_*`) | ❌ 노출 금지 |

---

## 5. MCP 전용 제한 Postgres role — GRANT/REVOKE (확정안)

> **방식**: 전용 뷰 스키마 `mcp_ro` **deny-by-default**. base table 에 GRANT 0. 신규 테이블/컬럼은 명시적으로 뷰에 넣기 전까지 자동 비노출 → 스키마 drift 시에도 PII 유출 0.
>
> 아래 SQL 은 **real 프로젝트(lfrny...) 전용 마이그레이션**으로 적용. dev(eqoyw...)는 §5.4 별도(완화) 적용. **CI/CD `apply_db_migrations` 게이트와 무관하게 운영자가 수동 1회 적용** (개발 인프라 — 제품 마이그레이션 시퀀스에 넣지 않음, ci-cd.md §7 drift 정책과 분리).

### 5.1 role 생성 + 전역 deny + read-only 강제 (real)

```sql
-- ── MCP 전용 제한 role (real) ─────────────────────────────────────────────
-- 강한 패스워드는 컨테이너 env 에만 보관 (git 미관리). 아래는 플레이스홀더.
create role mcp_ro_real with
  login
  password '<<<32B-RANDOM>>>'
  nosuperuser nocreatedb nocreaterole noinherit nobypassrls
  connection limit 4;

-- read-only 강제 (이중 안전망: MCP --access-mode=restricted 와 별개)
alter role mcp_ro_real set default_transaction_read_only = on;
alter role mcp_ro_real set statement_timeout = '15s';                 -- 폭주 쿼리 차단
alter role mcp_ro_real set idle_in_transaction_session_timeout = '30s';
alter role mcp_ro_real set lock_timeout = '3s';
alter role mcp_ro_real set search_path = mcp_ro;                       -- 기본 경로를 뷰 스키마로

-- ── public 스키마 전면 차단 (base table·자격증명·함수 호출 원천 봉쇄) ──────
-- public 스키마 USAGE 자체를 회수 → 그 안의 어떤 테이블/함수도 도달 불가.
revoke all on schema public from mcp_ro_real;
revoke all on all tables    in schema public from mcp_ro_real;        -- 멱등 방어
revoke all on all functions in schema public from mcp_ro_real;        -- decrypt RPC 등 호출 봉쇄
revoke all on all sequences in schema public from mcp_ro_real;

-- auth/storage/vault 등 타 스키마도 명시적 미부여 = 접근 불가 (기본값 유지).
-- (Postgres 기본: 신규 role 은 소유하지 않은 스키마 객체에 권한 없음)
```

> 핵심: `revoke all on schema public` 가 결정적이다. 스키마 USAGE 가 없으면 `mcp_ro_real` 은 public 의 어떤 테이블/뷰/함수에도 도달할 수 없다 — `fn_decrypt_credential` 같은 SECURITY DEFINER RPC 도 호출 불가(이미 `from public` revoke 되어 있어 이중). `nobypassrls` 로 혹시 모를 RLS 우회도 차단.

### 5.2 전용 뷰 스키마 + 마이그레이션 상태 GRANT

```sql
-- ── 전용 노출 스키마 ──────────────────────────────────────────────────────
create schema if not exists mcp_ro;
comment on schema mcp_ro is
  'MCP read-only 노출 전용. PII-redacted 행 뷰 + 전역 집계 뷰만. base table 직접 노출 금지.';

grant usage on schema mcp_ro to mcp_ro_real;
-- (뷰 생성은 §5.3, 생성 후 select grant)

-- ── 마이그레이션 상태 (스키마 drift 확인용) ───────────────────────────────
grant usage  on schema supabase_migrations to mcp_ro_real;
grant select on supabase_migrations.schema_migrations to mcp_ro_real;
```

> **스키마/구조 조회**는 별도 GRANT 불요 — `pg_catalog`(테이블·컬럼·제약·인덱스 메타) 와 `information_schema` 는 모든 role 에 기본 읽기 허용. 단 `information_schema` 는 **권한 있는 객체만** 필터링하므로, 전체 구조는 `pg_catalog.pg_tables / pg_attribute / pg_constraint` 로 조회한다(데이터가 아닌 구조만 — PII 유출 아님).

### 5.3 PII-redacted 행 뷰 + 전역 집계 뷰 (mcp_ro, `security_invoker=off`)

> 마이그레이션 실행 role(postgres)이 뷰 owner → `security_invoker=off`(기본) 면 뷰는 **owner 권한으로 base table 을 읽고** redacted 결과만 반환. `mcp_ro_real` 은 base table 직접 권한 0 인 채로 뷰로만 조회.

```sql
-- ── 행 뷰: seller_id(UUID) 유지, PII 컬럼은 리터럴 '<redacted>' ────────────
create or replace view mcp_ro.sellers_redacted with (security_invoker = off) as
select id as seller_id,
       '<redacted>'::text as display_name,
       business_type, signup_provider, marketing_consent,
       last_active_at, created_at, updated_at
from public.sellers;

create or replace view mcp_ro.orders_redacted with (security_invoker = off) as
select id, seller_id, market_id, external_order_id,
       '<redacted>'::text as buyer_name,
       '<redacted>'::text as receiver_name,
       '<redacted>'::text as receiver_address,
       '<redacted>'::text as receiver_phone,
       product_name, quantity, order_amount, status,
       logen_order_id, waybill_number, carrier_code,
       error_code,                                   -- error_message 는 raw 응답 잔여 우려 → 제외
       attempt_count,
       collected_at, logen_registered_at, waybill_printed_at, dispatched_at,
       created_at, updated_at
from public.orders;

create or replace view mcp_ro.market_accounts_redacted with (security_invoker = off) as
select id, seller_id, market_id, status,
       connected_at, last_verified_at, last_error_code, last_error_at,
       disconnected_at, created_at, updated_at
from public.market_accounts;          -- account_label / external_account_id / credential_id 제외

-- ── PII 없는 테이블: 전역(cross-seller) 그대로 노출 ────────────────────────
create or replace view mcp_ro.jobs with (security_invoker = off) as
select id, seller_id, product_id, status, retry_count, error_summary,
       parent_job_id, correlation_id,
       created_at, started_at, completed_at, cancelled_at
from public.registration_jobs;

create or replace view mcp_ro.market_results with (security_invoker = off) as
select id, job_id, market_id, market_account_id, market_status,
       external_product_id, product_url, error_code, attempt_count,
       excluded, last_attempted_at, created_at, updated_at
from public.registration_job_market_results;

-- ── 전역 집계 뷰: 기존 public KPI 뷰를 security_invoker=off 로 미러 ─────────
--    (public 원본은 security_invoker=on → mcp_ro_real 로는 행 0. 그래서 재정의)
create or replace view mcp_ro.kpi_monthly_registrations with (security_invoker = off) as
select date_trunc('month', created_at) as month,
       count(*) as total_jobs,
       count(*) filter (where status = 'succeeded') as succeeded,
       count(*) filter (where status = 'partial')   as partial,
       count(*) filter (where status = 'failed')    as failed,
       count(distinct seller_id) as active_sellers
from public.registration_jobs
where created_at >= now() - interval '24 months'
group by 1 order by 1 desc;

create or replace view mcp_ro.v2_kpi_daily_orders with (security_invoker = off) as
select (collected_at at time zone 'Asia/Seoul')::date as kpi_date,
       count(*)::int as orders_total,
       count(*) filter (where status = 'logen_failed')::int    as orders_logen_failed,
       count(*) filter (where status = 'dispatch_failed')::int as orders_dispatch_failed
from public.orders
group by 1 order by 1 desc;
-- kpi_mau / kpi_registration_duration / v2_kpi_daily_dispatch 도 동일 패턴(security_invoker=off, 전역 집계)으로 미러.

-- ── 뷰 일괄 select grant (스키마 안 테이블/뷰 전부) ────────────────────────
grant select on all tables in schema mcp_ro to mcp_ro_real;
alter default privileges in schema mcp_ro grant select on tables to mcp_ro_real;
```

### 5.4 dev role (완화) — sandbox

```sql
create role mcp_ro_dev with
  login password '<<<32B-RANDOM>>>'
  nosuperuser nocreatedb nocreaterole connection limit 4;
alter role mcp_ro_dev set default_transaction_read_only = on;
alter role mcp_ro_dev set statement_timeout = '15s';

grant usage  on schema public to mcp_ro_dev;
grant select on all tables in schema public to mcp_ro_dev;          -- dev 는 전체 read
alter default privileges in schema public grant select on tables to mcp_ro_dev;

-- dev 라도 자격증명 테이블은 차단 (습관·토큰 유출 시 피해 최소화)
revoke all on public.market_credentials, public.oauth_state,
              public.market_credentials_audit, public.logen_credentials
       from mcp_ro_dev;
revoke all on all functions in schema public from mcp_ro_dev;       -- decrypt RPC 봉쇄
```

### 5.5 접속 문자열 (컨테이너 env)

Lightsail(IPv4) → Supabase 는 **Supavisor 세션 풀러(포트 5432, IPv4)** 권장. 풀러 사용자명은 `<role>.<project_ref>` 형식:

```
# real (컨테이너 env, host 미노출) — 서울 리전 풀러
DATABASE_URI=postgresql://mcp_ro_real.lfrnythcujxdhehvkmtg:<<<PW>>>@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require

# dev — ⚠ dev 프로젝트는 뭄바이(ap-south-1) 리전 풀러 (real 과 다름! 생성 시 region 선택 상이)
DATABASE_URI=postgresql://mcp_ro_dev.eqoywqoalwkwbrdsulfl:<<<PW>>>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
```

> ⚠️ **풀러 호스트는 프로젝트 region 마다 다르다.** dev(eqoyw)=뭄바이 `aws-1-ap-south-1`, real(lfrny)=서울 `aws-1-ap-northeast-2`. 둘을 같은 호스트로 적으면 한쪽이 `tenant/user ... not found` 로 끊긴다 (2026-05-30 사고 — §9.3). 호스트는 각 프로젝트 대시보드 **Connect → Session pooler** 에서 확인할 것.

> `default_transaction_read_only` 등 `ALTER ROLE ... SET` 은 풀러 경유라도 백엔드 세션 시작 시 적용되므로 유효. role 자체에 박혀 있어 MCP 가 우회 불가.

---

## 6. 네트워크·인증 (IP allowlist 불가에 대한 보완)

### 6.1 보안그룹 inbound — 변경 없음

| 포트 | 용도 | 정책 | MCP 영향 |
|---|---|---|---|
| 443 | Caddy TLS (gateway + **MCP vhost**) | 공개 (멀티 디바이스 가변 IP) | MCP 가 기존 443 에 올라탐 — **신규 개방 0** |
| 80 | Let's Encrypt ACME HTTP-01 | 기존 유지 | 인증서 발급/갱신 |
| 22 | SSH | 기존 유지 (운영자 관리) | 변경 없음 |
| 그 외 | — | deny | MCP 컨테이너 포트는 host 미노출(auth-proxy `127.0.0.1:9000` 만, 외부 비공개) |

### 6.2 IP allowlist 못 쓰는 근거 + 토큰 강도 보완

**못 쓰는 이유**: 단일 사용자가 회사/집/모바일(LTE)에서 접속 → source IP 가 수시 변동. 보안그룹/Caddy 단 IP 화이트리스트로 고정 불가.

**보완 (defense-in-depth)** — 네트워크 ACL 1겹을 다음 다층으로 대체:

1. **강한 Bearer**: 엔드포인트별 **256-bit(32B) CSPRNG** 토큰, base64url. 추측·brute force 비현실적. (게이트웨이의 HMAC 과 별개 — MCP 는 Bearer)
2. **TLS 강제**: Caddy 자동 HTTPS + HSTS. 평문 토큰 전송 0.
3. **엔드포인트 분리 토큰**: `/supabase-dev` ≠ `/supabase-real` ≠ `/playwright` … 각기 다른 토큰. real 토큰 유출 시 타 엔드포인트 무영향.
4. **상수시간 비교**: auth-proxy 가 `crypto.timingSafeEqual` — 타이밍 사이드채널 차단.
5. **즉시 rotation**: §8.3 절차로 초 단위 교체. grace 기간(old+new 동시 허용) 지원.
6. **real 접근 audit**: `/supabase-real` 200/401 전건을 `/var/log/mcp-hosting/real-access.log` 적재 (ts, endpoint, client IP(X-Forwarded-For), outcome). 쿼리 본문은 미기록(데이터 참조 가능성).
7. **권한 최소화**: 토큰을 알아도 real 은 `mcp_ro` 뷰(read-only, PII redacted)까지만. 토큰 탈취 ≠ PII 유출 ≠ DB 변조.
8. **노출면 최소화**: MCP 컨테이너는 loopback조차 미노출(내부망만). 외부 진입점은 Caddy 443 하나.

> 결론: IP allowlist 1겹의 부재를 "강한 토큰 + TLS + 엔드포인트 분리 + 상수시간 + 즉시 rotation + audit + read-only 최소권한 + 노출면 축소" 8겹으로 보완. 단일 사용자·개발 인프라 위협모델에 충분.

---

## 7. gateway 비밀 격리 (구체안)

위협: MCP 컨테이너 침해 시에도 gateway 의 `MARKET_GATEWAY_SECRET`·마켓 자격증명이 안전해야 함.

### 7.1 파일·프로세스·uid 분리

| 자산 | 위치 | 소유/권한 | MCP 접근 |
|---|---|---|---|
| gateway 비밀 | `/etc/market-gateway/env` | `root:root` `600`, systemd `EnvironmentFile` | ❌ (컨테이너 미마운트 + uid 불일치) |
| gateway 본체 | `/opt/market-gateway/` | root | ❌ (미마운트) |
| MCP 스택 | `/opt/mcp-hosting/` | `mcp:mcp` (전용 system user, uid 10001) | 컨테이너 작업 루트 |
| MCP 비밀 | `/etc/mcp-hosting/env` | `mcp:mcp` `600` | compose `env_file` 만 |

- MCP 컨테이너는 **gateway 디렉토리를 일절 bind-mount 하지 않는다**. compose 에 `/etc/market-gateway`, `/opt/market-gateway` 가 등장하면 안 됨 (리뷰 체크포인트).
- gateway env 는 `600 root` — 비-root 컨테이너 프로세스가 호스트 침투해도 읽기 불가.

### 7.2 컨테이너 하드닝 (compose 공통)

```yaml
# 모든 MCP 서비스 공통 적용
user: "10001:10001"            # 비-root
read_only: true                # rootfs 읽기전용 (쓰기 필요분만 tmpfs)
cap_drop: [ALL]
security_opt: [no-new-privileges:true]
# docker 소켓 미마운트, 호스트 네트워크 미사용, gateway 경로 미마운트
tmpfs: [/tmp]                   # 스크래치만
```

- **docker.sock 미마운트** (컨테이너 탈출 경로 차단).
- 네트워크: 전용 compose bridge. host 네트워크 미사용. auth-proxy 만 `127.0.0.1:9000` 게시(외부 비공개).
- 침해 시 잔여 위험 = **egress**(인터넷 아웃바운드). 이를 최소화: real DB role read-only/뷰한정, Sentry/GitHub 토큰 read scope. (필요 시 추후 egress 화이트리스트 — §10 비포함.)

---

## 8. docker-compose 구조 + env + rotation

### 8.1 디렉토리

```
/opt/mcp-hosting/                  # 소유 mcp:mcp (uid 10001)
  docker-compose.yml
  auth-proxy/                      # 경량 Bearer 검증 + path 라우팅 + real audit (Deno/Node ~150 LOC)
    Dockerfile
    main.ts
/etc/mcp-hosting/
  env                              # 600 mcp:mcp — 모든 토큰/DB URI/PAT (git 미관리)
/etc/caddy/mcp.caddy               # MCP vhost (메인 Caddyfile 에 import 1줄)
/var/log/mcp-hosting/
  real-access.log                  # /supabase-real audit (logrotate)
```

### 8.2 docker-compose.yml (구조)

```yaml
name: mcp-hosting
services:
  auth-proxy:                       # 유일한 host 노출 (127.0.0.1:9000)
    build: ./auth-proxy
    user: "10001:10001"
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    tmpfs: [/tmp]
    ports: ["127.0.0.1:9000:9000"]
    env_file: [/etc/mcp-hosting/env]   # MCP_TOKEN_* (엔드포인트별), AUDIT_LOG 경로
    volumes:
      - /var/log/mcp-hosting:/var/log/mcp-hosting   # audit 만 쓰기
    environment:
      ROUTES: >-
        /supabase-dev=http://postgres-mcp-dev:8000;
        /supabase-real=http://postgres-mcp-real:8000;
        /playwright=http://playwright-mcp:8931;
        /sentry=http://sentry-mcp:8000;
        /github=http://github-mcp:8000
    depends_on: [postgres-mcp-dev, postgres-mcp-real, playwright-mcp, sentry-mcp]
    restart: unless-stopped
    logging: { driver: journald }      # gateway 와 동일 journald → 통합 journalctl
    mem_limit: 64m

  postgres-mcp-dev:
    image: crystaldba/postgres-mcp:latest
    command: ["--access-mode=restricted", "--transport=streamable-http", "--host=0.0.0.0", "--port=8000"]
    user: "10001:10001"
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    env_file: [/etc/mcp-hosting/env]    # DATABASE_URI_DEV → 컨테이너 내 DATABASE_URI 로 매핑
    environment: { DATABASE_URI: "${DATABASE_URI_DEV}" }
    restart: unless-stopped
    logging: { driver: journald }
    mem_limit: 256m
    # ports 없음 — 내부망만

  postgres-mcp-real:
    image: crystaldba/postgres-mcp:latest
    command: ["--access-mode=restricted", "--transport=streamable-http", "--host=0.0.0.0", "--port=8000"]
    user: "10001:10001"
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    env_file: [/etc/mcp-hosting/env]
    environment: { DATABASE_URI: "${DATABASE_URI_REAL}" }
    restart: unless-stopped
    logging: { driver: journald }
    mem_limit: 256m

  playwright-mcp:
    image: mcr.microsoft.com/playwright:v1.48.0-jammy
    command: ["npx", "-y", "@playwright/mcp@latest", "--headless", "--host", "0.0.0.0", "--port", "8931", "--isolated"]
    user: "10001:10001"
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    init: true
    restart: unless-stopped
    logging: { driver: journald }
    mem_limit: 1536m                    # headless chromium peak (§9.2)

  sentry-mcp:
    image: node:20-alpine
    command: ["npx","-y","supergateway","--stdio","npx -y @sentry/mcp-server","--outputTransport","streamableHttp","--port","8000","--host","0.0.0.0"]
    user: "10001:10001"
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    tmpfs: [/tmp, /home/node/.npm]
    env_file: [/etc/mcp-hosting/env]    # SENTRY_AUTH_TOKEN (read), SENTRY_HOST
    restart: unless-stopped
    logging: { driver: journald }
    mem_limit: 192m

  # github-mcp:   (선택 — 옵트인 시 주석 해제)
  #   image: ghcr.io/github/github-mcp-server:latest
  #   command: ["stdio"]   # 또는 streamable http 지원 빌드
  #   env_file: [/etc/mcp-hosting/env]  # GITHUB_PERSONAL_ACCESS_TOKEN (read scope)
  #   ... (공통 하드닝 동일) ... mem_limit: 128m
```

`/etc/mcp-hosting/env` 예:
```ini
# 엔드포인트별 Bearer (auth-proxy 검증). grace rotation 시 _NEXT 추가
MCP_TOKEN_SUPABASE_DEV=base64url-32B
MCP_TOKEN_SUPABASE_REAL=base64url-32B
MCP_TOKEN_PLAYWRIGHT=base64url-32B
MCP_TOKEN_SENTRY=base64url-32B
# DB (Supavisor 세션 풀러, IPv4)
DATABASE_URI_DEV=postgresql://mcp_ro_dev.eqoyw...:PW@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require       # dev=뭄바이
DATABASE_URI_REAL=postgresql://mcp_ro_real.lfrny...:PW@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require  # real=서울 (호스트 region 상이 주의)
# Sentry (read)
SENTRY_AUTH_TOKEN=...
SENTRY_HOST=sentry.io
```

### 8.3 토큰 rotation 절차

**MCP Bearer (즉시, 무중단 grace)**:
1. 새 토큰 생성: `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`.
2. `/etc/mcp-hosting/env` 에 `MCP_TOKEN_<EP>_NEXT=<새값>` 추가 (auth-proxy 는 현재+NEXT 둘 다 허용하도록 구현).
3. `docker compose up -d auth-proxy` (auth-proxy 만 재기동, 초 단위).
4. 디바이스들의 `.mcp.json` Authorization 을 새 토큰으로 교체.
5. `MCP_TOKEN_<EP>` 를 새값으로 승격, `_NEXT` 삭제 → `up -d auth-proxy`. 구 토큰 폐기.

**DB role 패스워드**: Supabase 대시보드/SQL 에서 `alter role mcp_ro_real password '<new>'` → `/etc/mcp-hosting/env` 의 `DATABASE_URI_REAL` 갱신 → `docker compose up -d postgres-mcp-real`.

**Sentry/GitHub 토큰**: 각 콘솔에서 회전 → env 갱신 → 해당 서비스만 `up -d`.

> rotation 은 gateway 와 완전 독립 — `market-gateway.service` 영향 0.

---

## 9. 운영 + 비용

### 9.1 systemd 로 compose 부팅 supervise (gateway 정합)

gateway 가 systemd 유닛이듯, MCP 스택도 systemd 로 묶어 부팅 자동기동:

```ini
# /etc/systemd/system/mcp-hosting.service
[Unit]
Description=MCP hosting docker-compose stack
Requires=docker.service
After=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/mcp-hosting
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=mcp
[Install]
WantedBy=multi-user.target
```

### 9.2 메모리·디스크 — 인스턴스 사양 (적용 완료)

현 인스턴스: **2GB plan $10/월 (2GB RAM / 60GB SSD / 2GB swap)** — 2026-05-28 사고 후 마이그레이션 완료 (§14).

| 구성요소 | RAM(평시/피크) |
|---|---|
| gateway Deno + Caddy + 시스템 (기존) | ~200MB |
| docker daemon | ~80MB |
| auth-proxy | ~30MB |
| postgres-mcp ×2 | ~150MB |
| sentry-mcp | ~120MB |
| **playwright headless chromium** | **~400–800MB (피크)** |

→ 2GB 인스턴스에서 피크 합산 ≈1.4GB, 평시 ≪1GB — swap 여유. **mem_limit 강제**: 위 compose 의 `mem_limit` 합(≈2.3GB 상한, cgroup 격리)으로 컨테이너가 gateway 메모리를 잠식하지 못하게 한다. OOM 시 **컨테이너만** 죽고 gateway 는 보존.

다운사이즈 시 주의:
- **1GB plan($5)** : playwright 를 평시 `stop`, 필요 시 `docker compose up -d playwright-mcp` 온디맨드.
- **512MB(nano $3.5)** : playwright/sentry `profiles: ["heavy"]` 부활 + `--profile heavy` 로만 활성. 미적용 시 gateway OOM 사고 재발 위험 (§14 사고 기록).

**static IP 보존 resize 절차** (IP 3.36.239.243 절대 보존):
1. 인스턴스 snapshot 생성.
2. snapshot → 2GB plan 신규 인스턴스 생성 (서울).
3. 신규 인스턴스에서 gateway + MCP 헬스 확인.
4. **static IP 를 구 인스턴스에서 detach → 신규 인스턴스에 attach** (동일 IP 객체 재attach = 주소 보존. **release/delete 는 금지**).
5. `curl https://3-36-239-243.sslip.io/healthz` (gateway) + `https://mcp.3-36-239-243.sslip.io/healthz` (MCP) 200 확인 → 구 인스턴스 삭제.
- 컷오버 중 gateway 수 분 다운 → 사전 공지 후 트래픽 한산 시간대. (또는 신규 인스턴스 병행 기동 후 IP 스위치로 다운 최소화.)

### 9.3 로그·헬스체크·재시작

- **로그**: 모든 compose 서비스 `logging.driver=journald` → 기존 gateway 와 동일하게 `journalctl` 로 통합 조회.
  - `journalctl CONTAINER_NAME=mcp-hosting-postgres-mcp-real-1 -f`
  - gateway: `journalctl -u market-gateway -f` (기존 그대로).
- **real audit**: `/var/log/mcp-hosting/real-access.log` (auth-proxy) + logrotate(daily, 30일).
- **헬스체크**:
  - 통합: `GET https://mcp.3-36-239-243.sslip.io/healthz` (auth-proxy, 무인증, 민감정보 없음) → 200.
  - 각 컨테이너 docker `healthcheck`(HTTP ping) + `restart: unless-stopped`.
  - 외부 uptime(선택): 기존 gateway 와 동일 도구로 `/healthz` 폴링.
- **재시작**: `docker compose restart <svc>` 또는 `systemctl restart mcp-hosting`. gateway 와 독립.
- **이미지 갱신**: `docker compose pull && docker compose up -d` (MCP 만). gateway 무관.

### 9.3.1 트러블슈팅 — DB 연결 / 재기동 함정 (2026-05-30 사고)

**증상: 특정 MCP 만 `select 1` 도 30s 타임아웃 (다른 MCP 는 정상)**
1. 컨테이너 생존: `sudo docker ps | grep mcp` (Up 이면 컨테이너는 정상 — 내부 연결 문제).
2. 로그: `sudo docker logs --tail 50 mcp-hosting-postgres-mcp-<dev|real>-1`.
3. 원인 패턴:
   - **`FATAL: (ENOTFOUND) tenant/user <role>.<ref> not found`** = 풀러가 그 프로젝트(tenant)를 못 찾음. **role 문제 아님** — `DATABASE_URI_*` 의 풀러 **호스트 region 이 그 프로젝트 실제 region 과 불일치**. 대시보드 Connect → Session pooler 의 정확한 호스트로 `/etc/mcp-hosting/env` 수정. dev=`aws-1-ap-south-1`(뭄바이), real=`aws-1-ap-northeast-2`(서울) — **둘이 다르니 한 호스트로 통일 금지** (§5.5).
   - **`password authentication failed`** = role PW stale → §5.4/§5.1 로 `alter role <role> password` + env PW 동기.

**⚠ 재기동 함정 — `docker compose up -d <svc>` 단독 금지**
- compose 가 `DATABASE_URI: "${DATABASE_URI_DEV}"` 셸 보간을 쓰는데 `/opt/mcp-hosting` 에 `.env` 가 없다. 정상 보간 경로 = **systemd 유닛의 `EnvironmentFile=/etc/mcp-hosting/env`** (§9.1).
- 수동 `sudo docker compose up -d postgres-mcp-dev` 만 하면 보간 소스가 없어 `DATABASE_URI` 가 빈 값 → `No database URL provided` 로 컨테이너 죽음.
- **올바른 수동 재기동**: `sudo systemctl restart mcp-hosting` (전체) 또는 dev 만 —
  `sudo bash -c 'set -a; . /etc/mcp-hosting/env; set +a; cd /opt/mcp-hosting && docker compose up -d postgres-mcp-dev'`
- 컨테이너 recreate 후엔 Claude Code MCP SSE 세션이 끊겨 `404 Could not find session` → `/mcp` 로 재연결.

> **2026-05-30 사고 요약**: dev 무료 프로젝트의 풀러 호스트가 서울로 오설정(실제 뭄바이) + `mcp_ro_dev` role 유실 동반. env region 정정 + role 재생성(§5.4) + env-source 재기동으로 복구. dev DB·호스팅 인스턴스·real MCP 는 전부 정상이었음(컨테이너 Up, REST 401 즉답).

### 9.4 비용 추정

| 항목 | 마이그레이션 전 (nano) | 현재 (2GB, 2026-05-28~) |
|---|---|---|
| Lightsail 인스턴스 | $3.5/월 (512MB) | **$10/월 (2GB)** — 적용 완료 |
| Static IP | $0 (attach 중 무료) | $0 (동일, `3.36.239.243`) |
| 데이터 전송 | 1TB 포함 | 3TB 포함 (2GB plan) |
| 외부 토큰 | — | Sentry/GitHub 무료 tier |
| **합계** | $3.5/월 | **$10/월 (Δ +$6.5)** |

---

## 10. Claude Code `.mcp.json` 연결 예시

> **클라이언트 범위 (2026-05-28 확정)**: v1 은 **데스크톱(Claude Code CLI / 데스크톱 앱 / IDE)** 전용. `.mcp.json` 은 파일+OS 환경변수 기반이라 데스크톱에서만 동작한다. **모바일 Claude 클라이언트는 보류** — claude.ai 커넥터는 통상 OAuth 핸드셰이크를 기대하나 본 설계는 Bearer 라(§D-3, OAuth 는 §12 v2) 모바일 등록이 막힌다. 모바일이 필수가 되면 (a) auth-proxy 에 OAuth 계층 추가 또는 (b) 별도 인스턴스에서 server-side Claude Code(+SSH) 트랙으로 재논의 (§12).
>
> `.mcp.json` 에는 **MCP 게이트웨이 Bearer 토큰만** 둔다. DB/Sentry/GitHub 토큰은 인스턴스 컨테이너 env 에만 존재(클라이언트로 내려가지 않음).

```jsonc
{
  "mcpServers": {
    "supabase-dev": {
      "type": "http",
      "url": "https://mcp.3-36-239-243.sslip.io/supabase-dev",
      "headers": { "Authorization": "Bearer ${MCP_TOKEN_SUPABASE_DEV}" }
    },
    "supabase-real": {
      "type": "http",
      "url": "https://mcp.3-36-239-243.sslip.io/supabase-real",
      "headers": { "Authorization": "Bearer ${MCP_TOKEN_SUPABASE_REAL}" }
    },
    "playwright": {
      "type": "http",
      "url": "https://mcp.3-36-239-243.sslip.io/playwright",
      "headers": { "Authorization": "Bearer ${MCP_TOKEN_PLAYWRIGHT}" }
    },
    "sentry": {
      "type": "http",
      "url": "https://mcp.3-36-239-243.sslip.io/sentry",
      "headers": { "Authorization": "Bearer ${MCP_TOKEN_SENTRY}" }
    }
    // "github": { "type": "http", "url": ".../github", "headers": { "Authorization": "Bearer ${MCP_TOKEN_GITHUB}" } }  // 선택
  }
}
```

- 토큰은 셸 환경변수(`${MCP_TOKEN_*}`)로 주입 — `.mcp.json` 평문 커밋 금지(`.gitignore` 확인). 디바이스별 로컬 env 에만.
- `type: "http"` = Streamable HTTP. real 은 디바이스별 동일 토큰(엔드포인트 단위), dev 와 다른 토큰.

---

## 11. Phase 분해 (구현 — 설계 승인 후 별도)

| Phase | 작업 | 산출물 | 의존 |
|---|---|---|---|
| **1 (본 문서)** | 설계 확정 | `mcp-hosting.md` | — |
| 2 | real/dev MCP role + `mcp_ro` 뷰 SQL 작성 + **운영자 수동 적용** (real 1회, dev 1회) | `infra/mcp-hosting/sql/` (제품 마이그레이션 시퀀스와 분리) | 1 |
| 3 | `infra/mcp-hosting/` : docker-compose + auth-proxy(Bearer/라우팅/audit) + Caddy mcp.caddy + systemd unit + setup 스크립트 | infra PR (chore/mcp-hosting) | 1 |
| 4 | 인스턴스 2GB resize(static IP 보존) → 스택 기동 → 헬스/토큰 검증 | 운영 액션 | 2,3 |
| 5 | 디바이스 `.mcp.json` 배포 + real PII-redacted 동작·read-only 거부(write 시 에러) 검증 | 검증 | 4 |

> 본 인프라는 release 흐름(`develop→release/*→main`)과 분리. `chore/mcp-hosting` 에서 작업하고, 제품 CI 머지 게이트와 무관(개발 편의 인프라).

---

## 12. 비포함 (현 범위 밖)

- egress 화이트리스트(컨테이너 아웃바운드 도메인 제한) — 필요성 측정 후.
- MCP 서버 다중 인스턴스/HA — 단일 개발자용, SPOF 허용.
- 공식 Supabase MCP(PAT) 채택 — 가드레일상 채택 안 함 (§2.1).
- OAuth/OIDC 기반 MCP 인증(MCP Authorization spec) — 단일 사용자라 Bearer 로 충분. 다중 사용자 도입 시 재논의.
- **모바일 Claude 클라이언트 — v1 보류** (2026-05-28). 데스크톱 `.mcp.json`(Bearer) 전용. 모바일은 claude.ai 커넥터(OAuth 의존)거나 server-side Claude Code(+SSH, 별도 인스턴스 권장 — MCP 는 화이트리스트 IP 불요) 트랙이 필요 → 필수 시 별도 설계.
- Terraform/IaC — 인스턴스 1대 + compose 1스택, 수동 운영.

---

## 13. 트레이드오프 (의식)

| 항목 | 영향 |
|---|---|
| Caddy 공유 | gateway 와 Caddy 1프로세스 공유. import 분리·블록 무수정으로 결합 최소화하나 Caddy 장애 시 양쪽 영향. (Caddy 는 안정적·재기동 빠름) |
| 동일 인스턴스 공존 | gateway 와 자원 경쟁. mem_limit + 인스턴스 상향으로 gateway OOM 방지. 그래도 물리 1대 SPOF 는 gateway 와 공유 |
| headless chromium 무게 | RAM/디스크 최대 소비처. 2GB 상향 또는 온디맨드 운용 필요 |
| sslip.io 의존 | 서드파티 DNS. 장애 시 도메인 해석 불가(→ 실 도메인 전환 경로 보유, §3) |
| static IP resize 리스크 | 인스턴스 상향 시 IP 재attach 필요 — 절차 오류 시 화이트리스트 깨짐. §9.2 룬북 엄수, release/delete 금지 |
| read-only 뷰 한정 유연성 | real 임의 쿼리 불가(사전 정의 뷰만). 새 조회 니즈 = `mcp_ro` 뷰 추가(코드 변경). 안전성과의 교환 — 의도된 비용 |

---

## 14. 변경 이력

- 2026-05-28 (운영 사고 + IP 마이그레이션) — Phase 2·3 배포 후 512MB nano 에서 docker+chromium OOM-lock 발생 → gateway 다운 (8h+ 외부 영향). 복구 중 §9.2 "static IP" 절차 진입 시 **기존 IP `43.201.83.78` 이 실제로는 정식 Static IP 가 아니라 인스턴스 기본(동적) 공인 IP** 였음이 확인됨 — Stop 시 release 되어 회수 불가. **사후 조치**: (a) 신규 2GB plan 인스턴스(snapshot 기반) + **정식 Lightsail Static IP `3.36.239.243`** 할당, 도메인 `mcp.3-36-239-243.sslip.io` 로 갱신; (b) `systemctl disable mcp-hosting` 으로 부팅 자동기동 차단(재활성화 정책 후속 — 2GB 에서도 mem_limit 강제 + playwright on-demand 가 안전); (c) `market-gateway.md §10` 동일 incident 엔트리 + 본 §14 동기 갱신; (d) 5개 마켓 화이트리스트 재등록 진행 중. **재발 방지 룰**: 인스턴스의 "고정 IP" 라 부르는 값이 콘솔 **최상위 Networking → Static IPs** 목록에 실제 객체로 존재하는지 명시 검증 후에만 "Static" 으로 기록할 것.
- 2026-05-28 — Phase 2·3 구현 (`infra/mcp-hosting/`). 클라이언트 = **데스크톱 `.mcp.json`(Bearer) 전용** 확정, 모바일 보류 (§10/§12). 구현 중 설계 정정 2건: (1) compose 비밀 주입을 `env_file` → **`--env-file` 치환**으로 교정 (`${DATABASE_URI_*}` 가 env_file 에서 치환되지 않는 compose 사양 때문 — 그대로면 postgres-mcp 기동 실패). (2) §5.1 의 `revoke ... on schema auth/storage` 제거 — 해당 스키마는 `postgres` 소유가 아니라 명시 revoke 시 에러 → GRANT 미부여(기본 차단)로 동일 효과.
- 2026-05-27 — v1 도입. 기존 Lightsail gateway 에 MCP 스택 추가 호스팅 설계(Phase 1 문서). 도메인 = sslip.io 서브도메인(`mcp.43-201-83-78.sslip.io`) 확정. real DB = 전용 뷰 스키마 `mcp_ro` deny-by-default + MCP 전용 제한 role(`mcp_ro_real`/`mcp_ro_dev`) 확정. 인스턴스 2GB 상향 권고.

---

**관련 문서**: `market-gateway.md` (인스턴스/IP/Caddy/systemd 기반) · `credential-vault.md` (자격증명 테이블 — MCP 차단 대상) · `security.md §6.2` (로그 redact) · `CLAUDE.md §데이터 레이어` (단일 진입점·RLS 룰)
