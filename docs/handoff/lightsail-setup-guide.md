# Lightsail Market Gateway 셋업 가이드 (사용자 액션)

> 작성: 2026-05-22 / 대상: 운영자 (사용자 본인) / 마스터: `docs/architecture/v1/cross-cutting/market-gateway.md`

본 문서는 Lightsail 인스턴스 (`43.201.83.78`) 에 Market Gateway 를 띄우기까지 **사용자가 직접 실행할 단계** 만 모은 체크리스트다. Claude 가 대신 못 하는 영역 (AWS 콘솔 / SSH / 11번가 셀러센터) 전부 본 문서에 박혀 있다.

## 0. 결정된 값 (변경 금지)

| 항목 | 값 |
|---|---|
| Static IP | `43.201.83.78` |
| 자동 도메인 | `43-201-83-78.sslip.io` |
| 인스턴스 | Lightsail nano ($3.5/월, Ubuntu 22.04, RAM 512MB / 20GB SSD) |
| 리전 | Seoul (`ap-northeast-2`) |

## 1. AWS Lightsail 방화벽 (콘솔 작업)

Lightsail 콘솔 → 인스턴스 → **Networking** 탭. 다음 규칙만 허용 (그 외 전부 deny):

| Application | Protocol | Port | Source |
|---|---|---|---|
| SSH | TCP | 22 | 본인 IP (`<myip>/32`) |
| HTTP | TCP | 80 | Any IPv4 (Let's Encrypt ACME HTTP-01 challenge 발급·갱신용) |
| HTTPS | TCP | 443 | Any IPv4 |

> 본인 IP 확인: `curl ifconfig.me`. 변동 시 (재택 환경 등) 정기 갱신 필요.

## 2. SSH 접속 가능 확인

```bash
ssh -i ~/.ssh/<key>.pem ubuntu@43.201.83.78
# 첫 접속: "Are you sure you want to continue connecting?" → yes
# 프롬프트가 ubuntu@ip-... 로 바뀌면 성공
exit
```

key 파일 권한이 너무 열려 있으면 거부됨:

```bash
chmod 0400 ~/.ssh/<key>.pem
```

## 3. 게이트웨이 파일 전송 (로컬 → 인스턴스)

레포 루트에서:

```bash
rsync -avz -e "ssh -i ~/.ssh/<key>.pem" \
  infra/aws-lightsail-gateway/ \
  ubuntu@43.201.83.78:/tmp/market-gateway/
```

## 4. setup.sh 실행 (인스턴스 측)

```bash
ssh -i ~/.ssh/<key>.pem ubuntu@43.201.83.78

# 인스턴스 내부:
sudo GATEWAY_DOMAIN=43-201-83-78.sslip.io \
     OPS_EMAIL=jhan@konai.com \
     bash /tmp/market-gateway/setup.sh
```

스크립트가 자동으로 처리:
- swap 2GB 생성 (512MB RAM 보강)
- apt 패키지 설치 (curl / ufw / fail2ban / ...)
- Deno v1.46.3 / Caddy v2 설치
- `marketgw` 시스템 사용자 + `/opt/market-gateway/` + `/etc/market-gateway/env` 생성
- systemd unit + Caddyfile 배포 (sslip.io 도메인 치환)
- ufw 방화벽 22/80/443 활성화
- service 기동 + 헬스체크

## 5. HMAC 시크릿 생성 + 등록

인스턴스 측 / Supabase Edge Function 양쪽에 **동일 값** 등록 필수.

### 5.1 인스턴스 측

```bash
sudo openssl rand -hex 32 | sudo tee /tmp/sec >/dev/null
sudo sed -i "s/<REPLACE_ME_32B_HEX>/$(sudo cat /tmp/sec)/" /etc/market-gateway/env
sudo cat /tmp/sec   # ← 출력값을 5.2 에 입력. 화면에 보인 뒤 다음 줄로 shred
sudo shred -u /tmp/sec
sudo systemctl restart market-gateway
```

### 5.2 Supabase Edge Function 측 (로컬에서)

```bash
# 5.1 에서 cat 한 hex 값을 SECRET_HEX 에 채우기
SECRET_HEX=<paste-from-5.1>
supabase secrets set MARKET_GATEWAY_SECRET=$SECRET_HEX --project-ref eqoywqoalwkwbrdsulfl   # dev
supabase secrets set MARKET_GATEWAY_SECRET=$SECRET_HEX --project-ref lfrnythcujxdhehvkmtg   # real
```

> dev / real 동일 시크릿 사용 OK (게이트웨이 인스턴스 1대 공유). 분리 운영 시 향후 결정.

`MARKET_GATEWAY_URL` 도 함께 등록:

```bash
supabase secrets set MARKET_GATEWAY_URL=https://43-201-83-78.sslip.io --project-ref eqoywqoalwkwbrdsulfl
supabase secrets set MARKET_GATEWAY_URL=https://43-201-83-78.sslip.io --project-ref lfrnythcujxdhehvkmtg
```

## 6. 헬스체크

```bash
curl -i https://43-201-83-78.sslip.io/healthz
# 기대: HTTP/2 200 + body {"ok":true,"ts":...}
```

200 이 안 나오면 트러블슈팅 표 (§9) 참조.

## 7. 11번가 IP 화이트리스트 등록

11번가 셀러오피스 → 셀러어드민 → API 관리 → IP 등록.

- 등록할 IP: `43.201.83.78` (1개)
- 정책 반영까지 시간이 걸릴 수 있음 (11번가 측 운영팀 검토)
- 등록 신청은 **지금** 진행. 게이트웨이 구동과 무관하게 병행 가능.

## 8. 기타 마켓 (등록 불요)

- **네이버 스마트스토어** / **쿠팡** / **G마켓·옥션 (ESM)** — 현재 IP 화이트리스트 정책 없음. 등록 액션 X.
- 향후 정책 변경 시 같은 Static IP 등록.

## 9. 트러블슈팅

| 증상 | 원인 후보 | 대응 |
|---|---|---|
| `curl /healthz` Connection refused | service 미기동 | `sudo systemctl status market-gateway` → `journalctl -u market-gateway -n 50` |
| `curl /healthz` 502 | Deno 프로세스 down / 환경변수 누락 | env 파일 확인 (`sudo cat /etc/market-gateway/env`), `MARKET_GATEWAY_SECRET` 채워졌는지 |
| TLS 인증서 발급 실패 | 80 포트 차단 / 도메인 불일치 / rate-limit | `journalctl -u caddy -n 100`, 80 포트 룰 재확인, sslip.io 도메인 정확히 `<ip-hyphen>.sslip.io` |
| Edge Function → gateway 401 `hmac mismatch` | 시크릿 양쪽 불일치 | 5.1 / 5.2 의 hex 값 동일한지 재확인. 양쪽 재배포 |
| Edge Function → gateway 403 `upstream host not allowed` | 어댑터 호출 호스트가 화이트리스트에 없음 | `main.ts:21` ALLOWED_UPSTREAM_HOSTS 확인. 신규 호스트면 PR 로 추가 |
| 메모리 부족 (OOM) | 트래픽 증가 / 메모리 누수 | `free -h` / `journalctl -u market-gateway | grep -i oom`. swap 사용량 확인. 지속 시 인스턴스 plan upgrade ($5 / $10 — Static IP 유지) |
| 11번가 호출 401/403 | IP 화이트리스트 등록 미반영 | 11번가 셀러센터 등록 상태 확인. 등록 완료 후 수 분 대기 |

## 10. 운영 명령 (자주 쓰는 것)

```bash
# 로그 실시간
sudo journalctl -u market-gateway -f --output=json-pretty
sudo tail -f /var/log/caddy/access.log

# 재시작
sudo systemctl restart market-gateway
sudo systemctl reload caddy

# main.ts 갱신 (로컬 변경 → 재배포)
rsync -avz -e "ssh -i ~/.ssh/<key>.pem" \
  infra/aws-lightsail-gateway/main.ts \
  ubuntu@43.201.83.78:/tmp/main.ts
ssh -i ~/.ssh/<key>.pem ubuntu@43.201.83.78 \
  'sudo install -o marketgw -g marketgw -m 0644 /tmp/main.ts /opt/market-gateway/main.ts && sudo systemctl restart market-gateway'

# 메모리 / 디스크 / swap
free -h
df -h
swapon --show
```

## 11. 보안 룰북

- SSH 키 `.pem` 은 로컬 `~/.ssh/` 에만. git 커밋 금지.
- `/etc/market-gateway/env` 는 `0640 root:marketgw`. 일반 SSH 사용자 (`ubuntu`) 도 root sudo 없이는 못 읽음.
- HMAC 시크릿 로테이션: 분기 1회 권장. 양쪽 (인스턴스 env + Supabase secrets) 동시 갱신 → 게이트웨이 재시작 → Edge Function 재배포.
- 22 포트는 **본인 IP only**. 본인 IP 변경 시 즉시 갱신.
- Static IP detach 절대 금지 (한 번 detach 하면 동일 IP 재발급 보장 없음 + 마켓 화이트리스트 전부 무효화).

## 12. 다음 작업 (Claude 측)

본 가이드대로 §1~§7 완료 후, Phase 4 (`apps/api/supabase/functions/_shared/gatewayFetch.ts` + 어댑터 일괄 적용) 진입. 사용자가 §6 헬스체크 200 확인 시점에 Claude 가 후속 PR 시작.
