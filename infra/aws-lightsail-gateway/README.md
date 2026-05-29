# Market Gateway — AWS Lightsail VPS

모든 Supabase Edge Function → 마켓 API 호출이 본 게이트웨이를 경유한다 (고정 IP 단일 outbound). 설계 ground truth: [`docs/architecture/v1/cross-cutting/market-gateway.md`](../../docs/architecture/v1/cross-cutting/market-gateway.md).

본 디렉토리는 **Phase 2 산출물** — Lightsail 인스턴스에 배포할 스켈레톤 (Deno gateway + Caddy + systemd + setup 스크립트). Edge Function 측 `gatewayFetch()` 클라이언트는 Phase 3 (`apps/api/supabase/functions/_shared/gatewayFetch.ts`) 에서 작성.

## 파일

| 파일 | 위치 (인스턴스) | 역할 |
|---|---|---|
| `main.ts` | `/opt/market-gateway/main.ts` | Deno HTTP server. HMAC 검증 + 마켓 호스트 화이트리스트 + proxy + structured log |
| `Caddyfile` | `/etc/caddy/Caddyfile` | TLS (Let's Encrypt) + 보안 헤더 + reverse-proxy → `127.0.0.1:8787` |
| `market-gateway.service` | `/etc/systemd/system/market-gateway.service` | systemd unit. `Restart=always`, hardening (NoNewPrivileges / ProtectSystem 등) |
| `setup.sh` | (실행 스크립트) | apt install + Deno + Caddy + 사용자 / 디렉토리 / env / systemd / ufw 일괄 셋업 |
| `.env.example` | (참고용) | `/etc/market-gateway/env` 의 템플릿 |

## 인스턴스 사양

| 항목 | 값 |
|---|---|
| 공급자 | AWS Lightsail |
| 리전 | Seoul (`ap-northeast-2`) |
| Plan | $3.5/월 nano (vCPU 2 / RAM 512MB / 20GB SSD / 1TB transfer) |
| OS | Ubuntu 22.04 LTS |
| Static IP | 1개 (attach 중 무료, detach 금지) |
| DNS | `<ip-hyphen>.sslip.io` 자동 (예: `3-36-239-243.sslip.io`) — DNS 패널 조작·도메인 구매 불요 |
| swap | 2GB (setup.sh 자동 생성, 512MB RAM 보강) |

## 배포 절차

상세는 `market-gateway.md §6.2` 참조. 요약:

사용자용 단계별 가이드: [`docs/handoff/lightsail-setup-guide.md`](../../docs/handoff/lightsail-setup-guide.md). 요약:

```bash
# 1) AWS Lightsail 콘솔
#    - Seoul 리전 / Ubuntu 22.04 / $3.5 nano plan 인스턴스 생성
#    - Static IP 발급 + 인스턴스 attach
#    - SSH 키 다운로드
#    - Networking: 22 (SSH 본인 IP) + 80 (ACME) + 443 만 허용
#    - DNS 패널 작업 없음 — sslip.io 자동 매핑

# 2) SSH 접속
ssh -i ~/.ssh/<key>.pem ubuntu@<static-ip>

# 3) 본 디렉토리를 인스턴스로 전송
#    로컬에서:
rsync -avz infra/aws-lightsail-gateway/ ubuntu@<static-ip>:/tmp/market-gateway/

# 4) 인스턴스 측에서 셋업 실행
#    GATEWAY_DOMAIN 은 Static IP 의 하이픈 형태 + .sslip.io
#    예) Static IP 3.36.239.243 → 3-36-239-243.sslip.io
sudo GATEWAY_DOMAIN=3-36-239-243.sslip.io OPS_EMAIL=ops@<domain> \
  bash /tmp/market-gateway/setup.sh

# 5) MARKET_GATEWAY_SECRET 채우기
sudo openssl rand -hex 32 | sudo tee /tmp/sec >/dev/null
sudo sed -i "s/<REPLACE_ME_32B_HEX>/$(sudo cat /tmp/sec)/" /etc/market-gateway/env
sudo shred -u /tmp/sec
sudo systemctl restart market-gateway

# 6) 동일 값을 Supabase Edge Function env 에도 등록
#    Supabase 대시보드 → Project Settings → Edge Functions → secrets
#    또는 supabase secrets set MARKET_GATEWAY_SECRET=<hex>

# 7) 헬스체크
curl -i https://3-36-239-243.sslip.io/healthz
# → 200 {"ok":true,"ts":...}

# 8) 마켓별 화이트리스트 등록 (Phase 4~5 진입 직전, 사람 액션)
#    - 쿠팡 Wing 셀러 측
#    - 11번가 셀러오피스
#    - G마켓·옥션 ESM+
```

## 운영

### 로그

```bash
# gateway structured log (JSON)
sudo journalctl -u market-gateway -f --output=json-pretty

# Caddy access log (JSON)
sudo tail -f /var/log/caddy/access.log
```

### 재시작

```bash
sudo systemctl restart market-gateway
sudo systemctl reload caddy
```

### main.ts 업데이트

```bash
# 로컬에서 변경 → rsync → 재시작
rsync -avz infra/aws-lightsail-gateway/main.ts ubuntu@<ip>:/tmp/main.ts
ssh ubuntu@<ip> 'sudo install -o marketgw -g marketgw -m 0644 /tmp/main.ts /opt/market-gateway/main.ts && sudo systemctl restart market-gateway'
```

### 모니터링

- **AWS Lightsail metrics**: CPU / 네트워크 / burst credit — 무료, 콘솔에서 확인
- **Uptime**: 외부에서 `curl /healthz` 주기 호출 (UptimeRobot 무료 / Sentry Cron / CloudWatch Synthetics)
- **Sentry**: Edge Function + Gateway 동일 프로젝트, `tag service=market-gateway`

## 보안

- `/etc/market-gateway/env` 권한 `0640 root:marketgw`. 일반 사용자 접근 차단
- HMAC 시크릿은 Edge Function env + 인스턴스 env 양쪽 일치. 로테이션 시 양쪽 동시 갱신
- `main.ts` 의 `ALLOWED_UPSTREAM_HOSTS` 화이트리스트 — 임의 URL forwarding 차단 (SSRF 방어). 현재: `api.commerce.naver.com` / `api-gateway.coupang.com` / `sa.esmplus.com` (G·옥션 공유 ESM Single Account API) / `openapi.11st.co.kr` (11번가 Seller API)
- Caddy hardening: HSTS preload / X-Content-Type-Options nosniff / -Server
- systemd hardening: NoNewPrivileges / ProtectSystem=strict / SystemCallFilter=@system-service

## 비포함 (v1)

- IaC (Terraform / CDK) — 인스턴스 1대 + 시크릿 1개라 수동 운영
- HA / Load Balancer / multi-region — SLA 요건 명시 후
- Object Storage 이미지 마이그레이션 — Supabase Storage 유지
