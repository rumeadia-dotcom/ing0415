# Market Gateway (AWS Lightsail VPS) — 설계 결정

> 마스터 문서. v1.3 도입 (2026-05-22). 본 문서가 ground truth.

## 1. 배경 · 도입 이유

Supabase Edge Function 의 **outbound IP 가 동적**이라 IP 화이트리스트 정책을 요구하는 마켓 API 와 충돌한다.

- **11번가**: API Key 단일 인증 + IP 화이트리스트 강제 → v1 출시 시점에 진입 불가, v2 이관 결정 (2026-05-19, `market-adapter.md`)
- **쿠팡 Wing OpenAPI**: HMAC 인증이지만 IP 정책 도입 가능성 — `docs/handoff/WIP-5markets-mvp.md §외부 차단` 표 기재
- **네이버 / G마켓 / 옥션**: 현재 IP 정책 없음. 단 정책 변경 시 동일 차단 위험

해결책: **AWS Lightsail VPS 의 고정 IP 1개를 모든 마켓 API outbound 의 단일 경유점으로 사용**. Edge Function → Gateway → 마켓 API 로 흐름 일원화.

## 2. 결정 (확정)

| 항목 | 값 | 근거 |
|---|---|---|
| **공급자** | AWS Lightsail | 운영 친숙도 (AWS 생태계) + 단순한 고정요금 + 서울 리전 보유 |
| **인스턴스** | $5/월 plan (vCPU 2 / RAM 2GB / 60GB SSD / 3TB transfer) | Caddy + Deno + 여유 메모리 확보. 트래픽 한도 v1 충분 |
| **리전** | Seoul (`ap-northeast-2`) | 한국 마켓 API 와 동일 리전 → RTT 5~10ms (Singapore 50ms 대비 우월). 추가 hop 지연 거의 없음 |
| **고정 IPv4 (Static IP)** | 1개 (인스턴스 attach 중 무료) | 마켓 화이트리스트 등록 대상. detach 시 과금 — Lightsail UI 에서 detach 금지 룰 |
| **OS** | Ubuntu 22.04 LTS | Lightsail 공식 이미지, apt 생태계, 보안 패치 안정 |
| **TLS / 리버스 프록시** | Caddy v2 | Let's Encrypt auto-renew, 설정 1파일 |
| **게이트웨이 본체** | Deno HTTP server | Edge Function 과 런타임 동일 → `MarketAdapter` 코드 100% 재사용 |
| **인증 (EF ↔ GW)** | HMAC-SHA256 (shared secret + timestamp + body) | mTLS 대비 운영 부담 적음, replay 방어 |
| **도메인** | `gateway.<운영 도메인>` | Caddy 가 Let's Encrypt 자동 발급. Lightsail DNS 또는 Route 53 |
| **적용 범위** | **5개 마켓 전부** (네이버/쿠팡/G마켓/옥션/11번가) | 일관성. 마켓별 분기 X. 11번가 v1 복귀 포함 |
| **예상 월 비용** | **$5/월** (≈ ₩7,000) | 베타 단계 부담 거의 0 |

## 3. 아키텍처

```
┌─────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Browser    │     │ Supabase Edge Func   │     │ AWS Lightsail    │
│  (SPA)      │────▶│ (Deno, 동적 IP)      │────▶│ Seoul (고정 IP)  │────▶ 마켓 API
│             │     │  - MarketAdapter     │ HMAC│  - Caddy v2      │      (네이버/쿠팡/
│             │     │  - gatewayFetch()    │     │  - Deno GW       │       G마켓/옥션/
└─────────────┘     └──────────────────────┘     └──────────────────┘       11번가)
                                                          │
                                                          ▼
                                                     ┌────────┐
                                                     │ Sentry │
                                                     │ stdout │
                                                     └────────┘
```

- 사용자 브라우저 ↔ Edge Function 통신은 변경 없음 (Supabase Auth · RLS · Realtime 그대로)
- Edge Function 은 **모든 마켓 호출**을 `gatewayFetch()` 로 wrapping → 고정 IP 단일 outbound
- Gateway 는 **forward proxy 가 아닌 application-level wrapper** — 요청 검증 + 로깅 + 마켓 API 호출 + 응답 그대로 반환

### 왜 forward proxy (Squid 등) 가 아닌가
- 마켓 API 가 mTLS · IP-bound 토큰 등 추가 인증을 도입 시 application-level wrapper 가 대응 유연
- correlationId / jobId 전파 + 구조화 로그 일관성
- 에러 마스킹 (`security.md §6.2` PII 제거) 을 게이트웨이 측에서도 강제 가능

### 왜 EC2 가 아닌 Lightsail
- 운영 단순성: 인스턴스 + 고정 IP + DNS + 방화벽이 한 콘솔에서. EC2/VPC/Security Group/Elastic IP 분리 운영 대비 부담 적음
- 고정요금: $5/월 (트래픽 포함). EC2 t4g.small 약 $13/월 + 데이터 전송 별도. v1 베타 단계에 과한 사양 불필요
- 마이그레이션 경로: 트래픽 증가 시 Lightsail snapshot → EC2 변환 가능

## 4. 컴포넌트 상세

### 4.1 AWS Lightsail VPS

| 디렉토리 | 내용 |
|---|---|
| `/etc/caddy/Caddyfile` | TLS + `gateway.<domain>` → `127.0.0.1:8787` reverse-proxy |
| `/opt/market-gateway/main.ts` | Deno HTTP server (`Deno.serve`) |
| `/etc/systemd/system/market-gateway.service` | Deno 프로세스 supervisor |
| `/var/log/market-gateway/` | 구조화 로그 (`logger.info({...})`) |

### 4.2 Edge Function 측 (`apps/api/supabase/functions/_shared/`)

```ts
// gatewayFetch.ts (신규)
export async function gatewayFetch(
  market: MarketId,
  url: string,
  init: RequestInit & { correlationId: string; jobId?: string },
): Promise<Response> {
  const ts = Date.now().toString()
  const body = init.body ?? ''
  const sig = await hmacSign(ts + market + url + body) // HMAC-SHA256
  return fetch(`${GATEWAY_BASE}/v1/proxy`, {
    method: 'POST',
    headers: {
      'x-gw-ts': ts,
      'x-gw-sig': sig,
      'x-gw-market': market,
      'x-gw-correlation-id': init.correlationId,
      'x-gw-job-id': init.jobId ?? '',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url, method: init.method, headers: init.headers, body }),
  })
}
```

각 `MarketAdapter` 의 `createProduct` / `authenticate` / `refreshToken` / `fetchCategoryTree` 가 raw `fetch` 대신 `gatewayFetch()` 호출. **debug 모드는 mock 어댑터가 우회**하므로 영향 없음.

### 4.3 Deno gateway 본체

```ts
// /opt/market-gateway/main.ts (요약)
Deno.serve({ port: 8787 }, async (req) => {
  if (!verifyHmac(req)) return new Response('unauthorized', { status: 401 })
  const { url, method, headers, body } = await req.json()
  const market = req.headers.get('x-gw-market')
  const cid = req.headers.get('x-gw-correlation-id')
  const jid = req.headers.get('x-gw-job-id')

  logger.info({ market, cid, jid, method, target: maskUrl(url) }, '→ proxy request')
  const t0 = performance.now()
  const upstream = await fetch(url, { method, headers, body })
  const ms = Math.round(performance.now() - t0)
  logger.info({ market, cid, jid, status: upstream.status, ms }, '← proxy response')

  // 응답 그대로 forward (스트림 보존)
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  })
})
```

## 5. 보안

| 항목 | 정책 |
|---|---|
| **HMAC 시크릿** | `MARKET_GATEWAY_SECRET` (≥32B random). Edge Function env + VPS env 양쪽 등록 |
| **Timestamp drift** | ±5분 (replay 방어) |
| **TLS** | Let's Encrypt (Caddy 자동), HSTS preload |
| **Inbound 방화벽 (Lightsail networking)** | 443 (Caddy) + 22 (SSH 본인 IP only). 그 외 deny |
| **Outbound 방화벽** | 마켓 도메인 화이트리스트 (선택, 운영 안정화 후) |
| **로그 마스킹** | `security.md §6.2` redact 규칙 동일 적용. OAuth 토큰 / HMAC 키 / API Key / 셀러 PII 로깅 금지 |
| **Sentry** | Gateway 자체도 Sentry 클라이언트 연동 (Edge Function 환경과 동일 `beforeSend` redact) |
| **시크릿 저장** | VPS 환경변수 (`systemd EnvironmentFile=/etc/market-gateway/env`). git 미관리, 600 권한 |
| **AWS IAM** | Lightsail 콘솔 접근은 MFA 필수. 별도 IAM 사용자 (root 키 사용 금지) |
| **AWS Account 분리** | 가능하면 별도 AWS 계정 또는 OU 로 격리. 운영 PII 데이터는 Supabase Cloud 측에만 존재 — Lightsail 인스턴스에 PII 영구 저장 금지 (passthrough 만) |

## 6. 운영

### 6.1 SPOF 분석

| 시나리오 | 영향 | 대응 (v1) | 향후 (v2) |
|---|---|---|---|
| Lightsail 인스턴스 down | 모든 마켓 API 호출 차단 | Edge Function 측 retry (지수 백오프, 3회) + Sentry alert + 사용자 등록 잡 `failed` 처리 + 수동 재시도 | Second Lightsail 인스턴스 + Lightsail Load Balancer ($18/월) |
| Gateway 프로세스 죽음 | 동일 | systemd `Restart=always` 자동 복구 | — |
| 마켓 API rate limit | 마켓별 격리 (다른 마켓 영향 없음) | 어댑터 측 backoff 그대로 | Gateway 측 rate-limit smoothing |
| Lightsail Seoul 리전 장애 | 모든 마켓 호출 차단 | 위와 동일 (수동 대응) + AWS Status Dashboard 모니터링 | multi-region (Tokyo backup) |
| Static IP 분실 (실수 detach) | 화이트리스트 불일치 → 인증 실패 | Lightsail 콘솔 권한 분리 + 운영 룰북 명시 | IaC (Terraform) 로 IP 관리 자동화 |

v1 은 1 인스턴스 단일 장애 허용. SLA 99%+ 보장이 필요한 시점에 second instance + Lightsail Load Balancer 도입.

### 6.2 배포 절차

| 단계 | 작업 | 담당 |
|---|---|---|
| 1 | AWS 계정 (또는 IAM 사용자) + Lightsail 활성화 + 서울 리전 + $5 Ubuntu 인스턴스 + Static IP attach + SSH 키 + DNS A 레코드 | 사용자 (수동) |
| 2 | `infra/aws-lightsail-gateway/setup.sh` 로 인스턴스 초기 셋업 (apt + Caddy + Deno + systemd unit) | Claude (코드) → 사용자 SSH 실행 |
| 3 | `MARKET_GATEWAY_SECRET` 생성 + Supabase Edge Function env + 인스턴스 env 동시 등록 | 사용자 |
| 4 | 헬스체크 — `curl https://gateway.<domain>/healthz` 200 OK | 사용자 |
| 5 | 마켓별 화이트리스트 등록 (해당 마켓만): 쿠팡 Wing / 11번가 / G·옥션 ESM+ | 사용자 (사람 액션) |
| 6 | `gatewayFetch()` 도입 PR + `MarketAdapter` 호출 일괄 교체 | Claude (코드) |
| 7 | 5개 마켓 parity 테스트 (debug mock + real 양쪽) | Claude (테스트) + 사용자 (실 호출) |
| 8 | release/v0.8 → main 운영 배포 | release-deploy 스킬 |

### 6.3 모니터링

- **Caddy access log**: `/var/log/caddy/access.log` — 요청 카운트 / 응답 코드 분포
- **Gateway structured log**: stdout → systemd-journald → `journalctl -u market-gateway`
- **Sentry**: Edge Function + Gateway 양쪽 동일 프로젝트, `environment=production`, tag `service=market-gateway`
- **Uptime**: 외부에서 `curl /healthz` 주기 호출 (사용자 결정 — UptimeRobot 무료 / Sentry Cron / AWS CloudWatch Synthetics)
- **AWS CloudWatch (Lightsail metrics)**: CPU / 네트워크 / burstable credit 모니터링. 무료

## 7. Phase 분해 (PR 단위)

| Phase | 작업 | 산출물 | 의존 |
|---|---|---|---|
| **1 (본 PR)** | 본 문서 작성 + `market-adapter.md` 11번가 v1 복귀 반영 + `CLAUDE.md` MVP 범위 갱신 | `market-gateway.md` + 2 문서 patch | — |
| 2 | `infra/aws-lightsail-gateway/` 디렉토리: Deno gateway 스켈레톤 + Caddyfile + systemd unit + setup.sh + README | infra PR | 1 |
| 3 | `apps/api/supabase/functions/_shared/gatewayFetch.ts` + `MARKET_GATEWAY_*` env types + unit 테스트 | refactor PR | 2 + 사용자 인스턴스 준비 |
| 4 | 네이버·쿠팡·G마켓·옥션 어댑터 `gatewayFetch()` 일괄 적용 + parity 테스트 | feature PR | 3 + 시크릿 등록 |
| 5 | **11번가 어댑터 v1 정식 구현** — `MarketAdapter` 인터페이스 채우기 + API Key 흐름 + parity 테스트 | feature PR (큼) | 4 |
| 6 | release/v0.8 → main | release-deploy 스킬 | 5 |

## 8. 비포함 (v1)

- **Second instance / Lightsail Load Balancer ($18/월)** — SLA 요건 명시 후
- **Lightsail Object Storage 이미지 마이그레이션** — Supabase Storage 유지
- **Lightsail Managed Database (Postgres)** — Supabase Cloud Postgres 유지
- **Gateway 측 캐싱 / rate-limit smoothing** — 필요성 측정 후
- **mTLS** — 운영 부담 대비 효익 적음. HMAC + IP 방화벽 조합으로 충분
- **Terraform / CDK IaC** — 인스턴스 1대 + 시크릿 1개라 수동 운영. 인스턴스 늘면 IaC 도입

## 9. 트레이드오프 (의식)

| 항목 | 영향 |
|---|---|
| **추가 RTT 한 hop** | 마켓 API 호출당 Edge Function ↔ Lightsail Seoul 추가. Supabase Cloud 리전 위치 의존 — Tokyo (ap-northeast-1) 기준 ~30ms. 등록 잡 1건 (마켓당 1~3 호출) 기준 +90~270ms. 사용자 체감 영향 미미 (등록 잡 자체가 비동기) |
| **단일 장애점** | v1 1 인스턴스 — SPOF. 위 §6.1 retry + 수동 대응으로 1차 방어 |
| **VPS 운영 학습 곡선** | Ubuntu + Caddy + Deno + systemd. 기존 Supabase Cloud 만 운영하던 단순 모델에서 자가 운영 영역 등장. setup.sh 로 표준화 |
| **AWS 계정 비용 노출** | $5 정액이지만 AWS billing alert + Lightsail 자체 cap 확인 (트래픽 초과 시 별도 과금) |
| **추가 시크릿** | `MARKET_GATEWAY_SECRET` — Edge Function env + 인스턴스 env 양쪽 일치 유지 |
| **마켓 API 응답 변환 위험** | gateway 가 응답을 그대로 forward 하지만, `Response` 스트림 / Content-Length 등 헤더 처리 버그 가능. Phase 4 parity 테스트로 검증 |

## 10. 변경 이력

- 2026-05-22 — v1.3 도입 결정. Phase 1 문서 작성 (본 PR). 공급자 = AWS Lightsail Seoul.

---

**관련 문서**: `market-adapter.md` (어댑터 인터페이스 + 11번가 v1 복귀) · `credential-vault.md` (HMAC secret 저장 위치) · `security.md §6.2` (로깅 redact) · `CLAUDE.md §MVP 범위` (11번가 v1 진입 반영)
