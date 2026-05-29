# MCP hosting — AWS Lightsail (gateway 인스턴스 공존)

단일 개발자(멀티 디바이스)가 회사/집/모바일에서 Claude Code 로 dev/real Supabase·Playwright·Sentry(·GitHub)를 MCP 로 조회하기 위한 **원격 MCP 서버 묶음**. 기존 **Market Gateway** Lightsail 인스턴스(서울, 고정 IP `3.36.239.243`)에 추가 호스팅한다.

설계 ground truth: [`docs/architecture/v1/cross-cutting/mcp-hosting.md`](../../docs/architecture/v1/cross-cutting/mcp-hosting.md).

> **분류: 개발 인프라 (chore).** release 흐름(`develop → release/* → main`)과 섞지 않는다. 작업 브랜치 `chore/mcp-hosting`.

## 절대 제약 (먼저 읽을 것)

1. **gateway 무수정.** `market-gateway.service` / `/etc/market-gateway/env`(`MARKET_GATEWAY_SECRET`·마켓 자격증명) / `/opt/market-gateway` 를 일절 건드리지 않는다. MCP 가 침해돼도 gateway 비밀은 안전해야 한다.
2. **고정 IP `3.36.239.243` 변경 금지.** 5개 마켓 셀러 콘솔 화이트리스트 자산. resize 시 IP **재attach** (release/delete 금지 — §9.2 룬북).
3. **real DB 변조 0.** real 은 read-only 강제 + PII·자격증명 절대 미노출 (`mcp_ro` 뷰만).

## 아키텍처 (요약)

```
Claude Code ──HTTPS(Bearer)──▶ Caddy :443 (호스트, 기존)
                                ├─ vhost A 3-36-239-243.sslip.io     → :8787 gateway (무수정)
                                └─ vhost B mcp.3-36-239-243.sslip.io → :9000 auth-proxy
                                                                         │ (Bearer 검증/라우팅/real audit)
                                              docker-compose (uid 10001, 내부망)
                                              ├─ postgres-mcp-dev  (role mcp_ro_dev)
                                              ├─ postgres-mcp-real (role mcp_ro_real, mcp_ro 뷰만)
                                              ├─ playwright-mcp (headless chromium)
                                              ├─ sentry-mcp (supergateway 래핑)
                                              └─ github-mcp (선택)
```

- 외부 진입점은 Caddy 443 **하나**. MCP 컨테이너는 host 포트 미노출 (auth-proxy 만 `127.0.0.1:9000`).
- 신규 inbound 포트 **0** — 기존 443 vhost 위에 올라탐.

## 파일

| 파일 | 위치 (인스턴스) | 역할 |
|---|---|---|
| `docker-compose.yml` | `/opt/mcp-hosting/docker-compose.yml` | MCP 스택 (하드닝: uid 10001 / read_only / cap_drop ALL / docker.sock 미마운트) |
| `auth-proxy/main.ts` | `/opt/mcp-hosting/auth-proxy/main.ts` | Deno. Bearer 상수시간 검증(+grace) + path 라우팅 + real audit + Streamable HTTP 프록시 |
| `auth-proxy/Dockerfile` | (빌드) | Deno alpine, 의존성 0, read_only 호환 |
| `caddy/mcp.caddy` | `/etc/caddy/mcp.caddy` | vhost B. 메인 Caddyfile 에 `import mcp.caddy` 1줄만 추가 (gateway 블록 무수정) |
| `mcp-hosting.service` | `/etc/systemd/system/mcp-hosting.service` | compose 부팅 supervise (gateway 유닛과 독립) |
| `logrotate-mcp-hosting` | `/etc/logrotate.d/mcp-hosting` | real audit + caddy mcp 로그 회전 (daily 30) |
| `setup.sh` | (실행) | docker 설치 + mcp 사용자 + 배포 + Caddy import + systemd. **gateway 무수정** |
| `.env.example` | `/etc/mcp-hosting/env` 템플릿 | 토큰/DATABASE_URI/SENTRY (600 mcp:mcp, git 미관리) |
| `mcp.json.example` | 디바이스 `.mcp.json` | Claude Code 연결 (Bearer 는 셸 env 주입) |
| `sql/` | (Supabase 수동 적용) | Phase 2 — 제한 role + `mcp_ro` 뷰. `sql/README.md` |

## 배포 절차

### Phase 2 — DB 제한 role/뷰 (운영자 수동 1회)

[`sql/README.md`](./sql/README.md) 참조. real(`real/01→02`) + dev(`dev/01`) 각각 적용. role 패스워드 설정.

### Phase 3 — 인스턴스 스택 셋업

```bash
# 1) 본 디렉토리 전송
rsync -avz infra/mcp-hosting/ ubuntu@3.36.239.243:/tmp/mcp-hosting/

# 2) 셋업 (gateway 와 다른 mcp. 접두 도메인. Caddy email 은 gateway Caddyfile 전역 공유)
ssh ubuntu@3.36.239.243
sudo MCP_DOMAIN=mcp.3-36-239-243.sslip.io bash /tmp/mcp-hosting/setup.sh

# 3) /etc/mcp-hosting/env 채우기 (토큰/DATABASE_URI/SENTRY) — .env.example 주석 참고
#    토큰: openssl rand -base64 32 | tr '+/' '-_' | tr -d '='

# 4) 스택 기동
sudo systemctl start mcp-hosting

# 5) 헬스체크 (둘 다 200 — gateway 무영향 확인)
curl -i https://mcp.3-36-239-243.sslip.io/healthz
curl -i https://3-36-239-243.sslip.io/healthz
```

### Phase 4 — 인스턴스 2GB resize (완료, static IP 보존)

현 인스턴스 = **2GB plan / Static IP `3.36.239.243`** (2026-05-28 사고 후 마이그레이션 완료). 1GB 이하 다운사이즈 시 playwright headless chromium 가동 시 OOM 위험 (gateway 프로세스가 OOM killer 대상이 될 수 있음). `mcp-hosting.md §9.2` 룬북 (참고용):

1. 인스턴스 snapshot → 2GB plan 신규 인스턴스 생성 (서울).
2. gateway + MCP 헬스 확인.
3. **static IP detach(구) → attach(신)** — 동일 IP 객체 재attach. **release/delete 금지** (화이트리스트 보존).
4. 양쪽 `/healthz` 200 확인 → 구 인스턴스 삭제.

비용 억제 대안: 1GB($5) + playwright 온디맨드 (`docker compose up -d playwright-mcp` 필요 시).

### Phase 5 — 클라이언트 (디바이스) 연결 + 검증

각 디바이스 (회사 Mac · 집 Windows · 모바일 등) 에서 1회 셋업:

**1) `.mcp.json` 배치** — `infra/mcp-hosting/mcp.json.example` 파일을 그대로 프로젝트 루트 `.mcp.json` 으로 복사. (`.gitignore` 됨 — 머신마다 직접 배치)

```bash
# macOS / Linux
cp infra/mcp-hosting/mcp.json.example .mcp.json
```

```powershell
# Windows PowerShell
Copy-Item infra\mcp-hosting\mcp.json.example .mcp.json
```

**2) 토큰 4개를 셸 env 로 주입** — 값은 `/etc/mcp-hosting/env` (인스턴스 운영자만 보유) 와 동일.

```bash
# macOS / Linux — ~/.zshrc 또는 ~/.bash_profile (cmux 사용 시 ~/.bash_profile 권장)
export MCP_TOKEN_SUPABASE_DEV=...
export MCP_TOKEN_SUPABASE_REAL=...
export MCP_TOKEN_PLAYWRIGHT=...
export MCP_TOKEN_SENTRY=...
```

```powershell
# Windows PowerShell — setx 는 영구 저장 (새 셸 띄워야 반영)
setx MCP_TOKEN_SUPABASE_DEV "..."
setx MCP_TOKEN_SUPABASE_REAL "..."
setx MCP_TOKEN_PLAYWRIGHT "..."
setx MCP_TOKEN_SENTRY "..."
```

**3) Claude Code 재시작 → `/mcp` 에서 4개 모두 `connected` 확인.** supabase-real 로 SELECT (PII redacted) / write 시 거부 동작도 1회 검증.

⚠ env 가 `이미 실행 중인 Claude Code` 에는 반영되지 않는다 — 자식 프로세스는 부모 env 를 시작 시점에만 상속. 셸 env 갱신 후 Claude Code 자체를 종료/재실행.

## 운영

### 로그 (gateway 와 통합 journalctl)

```bash
sudo journalctl CONTAINER_NAME=mcp-hosting-postgres-mcp-real-1 -f   # MCP 컨테이너
sudo journalctl -u market-gateway -f                               # gateway (기존)
sudo tail -f /var/log/mcp-hosting/real-access.log                  # real 접근 audit
```

### 재시작 / 갱신 (gateway 와 독립)

```bash
sudo systemctl restart mcp-hosting
cd /opt/mcp-hosting && sudo docker compose --env-file /etc/mcp-hosting/env pull \
  && sudo docker compose --env-file /etc/mcp-hosting/env up -d
```

### 토큰 rotation (무중단 grace — §8.3)

```bash
# 1) 신토큰 생성 후 /etc/mcp-hosting/env 에 MCP_TOKEN_<EP>_NEXT 추가
# 2) auth-proxy 재기동 (현재+NEXT 둘 다 허용)
cd /opt/mcp-hosting && sudo docker compose --env-file /etc/mcp-hosting/env up -d auth-proxy
# 3) 디바이스 .mcp.json 토큰 교체
# 4) MCP_TOKEN_<EP> 를 신값으로 승격, _NEXT 삭제 → up -d auth-proxy
```

## 보안 (네트워크 ACL 부재 보완 — §6.2)

단일 사용자가 가변 IP(회사/집/LTE)에서 접속 → IP allowlist 불가. 대신 **8겹 다층 방어**:

1. 강한 Bearer (256-bit/엔드포인트별) · 2. TLS 강제(HSTS) · 3. 엔드포인트 분리 토큰 ·
4. 상수시간 비교 · 5. 즉시 rotation(grace) · 6. real 접근 audit · 7. read-only `mcp_ro` 뷰 최소권한 ·
8. 노출면 축소(MCP 컨테이너 loopback 미노출).

→ 토큰 탈취 ≠ PII 유출 ≠ DB 변조. gateway 비밀은 파일·uid·프로세스 분리로 격리(§7).

## 엔드포인트 경로 튜닝 (기동 후 1회 확인)

auth-proxy 는 `/<endpoint>` prefix 를 떼고 나머지 경로를 `ROUTES` target 으로 포워딩한다. MCP 서버가 서브경로(예: `/mcp`, `/sse`)에서 listen 하면 둘 중 하나로 맞춘다:

- 클라이언트 url 을 `.../supabase-real/mcp` 로 두거나,
- compose `ROUTES` 의 target 에 경로 포함 (`/supabase-real=http://postgres-mcp-real:8000/mcp`).

기동 후 각 MCP 컨테이너 로그/문서에서 실제 streamable-http 경로를 확인해 한쪽으로 통일.

## 비포함 (§12)

egress 화이트리스트 / HA·다중 인스턴스 / 공식 Supabase MCP(PAT) / OAuth 기반 MCP 인증 / Terraform. (단일 개발자 · SPOF 허용 · 가드레일.)
