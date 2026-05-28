# Lightsail Market Gateway 셋업 가이드 (사용자 액션)

> 작성: 2026-05-22 / 대상: 운영자 (사용자 본인) / 마스터: `docs/architecture/v1/cross-cutting/market-gateway.md`

본 문서는 Lightsail 인스턴스 (`3.36.239.243`) 에 Market Gateway 를 띄우기까지 **사용자가 직접 실행할 단계** 만 모은 체크리스트다.

**두 가지 방식 제공**:

- **Part A — GitHub Actions 자동 배포 (Windows / Mac / Linux 모두 추천)**: GH Secrets 에 값 7개 등록 + 버튼 1번. CLI 환경 무관.
- **Part B — SSH 수동 (Linux / WSL2 / Git Bash 환경 보유자용 fallback)**: rsync + ssh 직접.

## 0. 결정된 값 (변경 금지)

| 항목 | 값 |
|---|---|
| Static IP | `3.36.239.243` |
| 자동 도메인 | `3-36-239-243.sslip.io` |
| 인스턴스 | Lightsail 2GB plan ($10/월, Ubuntu 22.04, RAM 2GB / 60GB SSD) |
| 리전 | Seoul (`ap-northeast-2`) |

---

# Part A — GitHub Actions 자동 배포 (추천)

CLI 환경 (Linux / Mac / WSL) 없이 GitHub 웹 UI 만으로 진행 가능.

## A.1 사전 작업: Supabase Personal Access Token 발급

GH Actions 가 Supabase secrets 를 자동 등록하기 위해 필요.

1. https://supabase.com/dashboard/account/tokens 접속
2. **Generate new token** 클릭
3. Name 입력 (예: `gh-actions-market-gateway`)
4. **Generate token** 클릭
5. 보여지는 토큰 값을 **메모장에 임시 보관** (이 화면 떠나면 다시 못 봄)

## A.2 사전 작업: SSH `.pem` 파일 내용 확보

Lightsail 콘솔에서 받은 `.pem` 파일을 **메모장으로 열어서** 전체 내용 복사.

내용 형식 (예):

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAACFwAAAAdzc2gtcn
...여러 줄...
-----END OPENSSH PRIVATE KEY-----
```

또는

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
```

**처음 `-----BEGIN` 부터 마지막 `-----END ... -----` 까지 전체** 가 한 덩어리.

## A.3 GitHub Secrets 7개 등록

브라우저로:

1. https://github.com/rumeadia-dotcom/ing0415 접속
2. 상단 탭 **Settings**
3. 좌측 메뉴 **Secrets and variables** → **Actions**
4. **New repository secret** 버튼

다음 7개를 하나씩 등록 (Name 은 **정확히** 동일하게):

| Name | Value |
|---|---|
| `LIGHTSAIL_SSH_KEY` | A.2 에서 복사한 `.pem` 파일 **전체 내용** (`-----BEGIN` 부터 `-----END` 줄 포함) |
| `LIGHTSAIL_HOST` | `3.36.239.243` |
| `GATEWAY_DOMAIN` | `3-36-239-243.sslip.io` |
| `OPS_EMAIL` | `jhan@konai.com` |
| `SUPABASE_ACCESS_TOKEN` | A.1 에서 발급한 토큰 |
| `DEV_SUPABASE_PROJECT_REF` | `eqoywqoalwkwbrdsulfl` |
| `REAL_SUPABASE_PROJECT_REF` | `lfrnythcujxdhehvkmtg` (기존 `deploy.yml` 도 동일 시크릿 사용) |

각 항목마다 **Add secret** 버튼으로 저장. 등록 완료 후 Secrets 목록에 7개가 보이면 성공.

> 등록한 값은 다시 볼 수 없음 (보안). 오타 시 삭제 후 재등록.

## A.4 Lightsail 방화벽 (콘솔)

AWS Lightsail 콘솔 → 인스턴스 → **Networking** 탭 → **IPv4 Firewall**:

| Application | Protocol | Port | Source |
|---|---|---|---|
| SSH | TCP | 22 | `0.0.0.0/0` (Any IPv4) — GH Actions runner IP 가 동적이라 일시적으로 전체 허용 |
| HTTP | TCP | 80 | Any IPv4 (Let's Encrypt ACME) |
| HTTPS | TCP | 443 | Any IPv4 |

> **보안 강화 옵션**: 첫 셋업 완료 후 SSH 22 를 본인 IP 만으로 좁히고, 재배포 시 GH Actions IP 또는 일시 오픈으로 운영. 현재는 첫 셋업이라 Any 로 시작.

## A.5 워크플로우 실행 (full-setup)

1. https://github.com/rumeadia-dotcom/ing0415/actions 접속
2. 좌측 워크플로우 목록에서 **Deploy Market Gateway** 클릭
3. 우측 상단 **Run workflow** 드롭다운 버튼 클릭
4. Branch: `main` 또는 `claude/fetch-98aut` (워크플로우 파일이 들어간 브랜치)
5. `실행할 작업` 드롭다운에서 **`full-setup`** 선택
6. **Run workflow** 클릭

## A.6 진행 상황 확인

3 ~ 5분 소요. 단계별로:

| Step | 기대 결과 | 실패 시 |
|---|---|---|
| `SSH 키 준비` | `ssh ok: ip-...` | LIGHTSAIL_SSH_KEY 형식 오류 — 다시 등록 |
| `게이트웨이 파일 전송` | rsync 로그 | LIGHTSAIL_HOST / 방화벽 22 |
| `setup.sh 실행` | apt + Deno + Caddy 설치 로그 | 인스턴스 디스크·메모리 |
| `HMAC 시크릿 생성·동기화` | `시크릿 로테이션 완료` | SUPABASE_ACCESS_TOKEN 권한 |
| `헬스체크` | `healthz OK — {"ok":true,...}` | Let's Encrypt 발급 지연 (최대 3분 자동 재시도) |

모든 단계 ✅ (초록 체크) 면 게이트웨이 운영 시작.

## A.7 운영 (이후 반복 사용)

같은 워크플로우의 `실행할 작업` 만 바꿔 재실행:

| Action | 용도 |
|---|---|
| `full-setup` | 첫 설치 또는 초기화. 시크릿도 새로 생성. |
| `update-main` | `main.ts` 만 갱신 + 서비스 재시작 (시크릿 변경 X). git push 후 사용. |
| `rotate-secret` | HMAC 시크릿만 새로 발급. 분기 1회 권장. |
| `restart` | 서비스 + Caddy 재시작. |
| `healthcheck` | 외부 헬스체크만 — 다른 작업 안 함. |

## A.8 5개 마켓 IP 화이트리스트 등록 (전부 필수)

GH Actions 와 무관하게 **별도** 진행 (병행 가능). 5개 마켓 모두 동일 IP `3.36.239.243` 등록.

| 마켓 | 등록 위치 |
|---|---|
| 네이버 스마트스토어 | 커머스 API 센터 → 애플리케이션 → IP 허용 목록 |
| 쿠팡 | Wing → 마이오피스 → API 사용 신청 → 허용 IP 등록 |
| G마켓 / 옥션 (ESM) | ESM Plus 셀러관리 → 외부 시스템 연동 → IP 등록 |
| 11번가 | 셀러오피스 (https://soffice.11st.co.kr) → API 관리 → IP 등록 |

검토 시간 마켓별 상이 (수 시간 ~ 수일). 5개 모두 등록 완료 전엔 키 발급도 막힐 수 있음 (2026-05-23 정정).
- 등록 완료 안 되어도 다른 마켓 (네이버 / 쿠팡 / G·옥션) 은 정상 동작

---

# Part B — SSH 수동 (fallback)

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
ssh -i ~/.ssh/<key>.pem ubuntu@3.36.239.243
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
  ubuntu@3.36.239.243:/tmp/market-gateway/
```

## 4. setup.sh 실행 (인스턴스 측)

```bash
ssh -i ~/.ssh/<key>.pem ubuntu@3.36.239.243

# 인스턴스 내부:
sudo GATEWAY_DOMAIN=3-36-239-243.sslip.io \
     OPS_EMAIL=jhan@konai.com \
     bash /tmp/market-gateway/setup.sh
```

스크립트가 자동으로 처리:
- swap 2GB 생성 (메모리 압박 시 안전망)
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
supabase secrets set MARKET_GATEWAY_URL=https://3-36-239-243.sslip.io --project-ref eqoywqoalwkwbrdsulfl
supabase secrets set MARKET_GATEWAY_URL=https://3-36-239-243.sslip.io --project-ref lfrnythcujxdhehvkmtg
```

## 6. 헬스체크

```bash
curl -i https://3-36-239-243.sslip.io/healthz
# 기대: HTTP/2 200 + body {"ok":true,"ts":...}
```

200 이 안 나오면 트러블슈팅 표 (§9) 참조.

## 7. 마켓별 IP 화이트리스트 등록 (5개 마켓 전부 필수)

**중요 (2026-05-23 정정)**: v1 정식 5개 마켓 **전부** 가 셀러의 access key / secret key / OAuth client 발급 단계에서 고정 IP 화이트리스트 등록을 요구. 등록 안 하면 키 자체가 발급 안 되거나 발급된 키로 API 호출 거부됨.

**등록할 IP**: `3.36.239.243` (1개. 5개 마켓 모두 동일 IP)

**셀러는 키 발급 전에 5개 마켓 모두 등록 진행 필요**:

| 마켓 | 등록 위치 |
|---|---|
| 네이버 스마트스토어 | 네이버 커머스 API 센터 → 애플리케이션 → IP 허용 목록 |
| 쿠팡 | Wing → 마이오피스 → API 사용 신청 → 허용 IP 등록 |
| G마켓 / 옥션 (ESM) | ESM Plus 셀러관리 → 외부 시스템 연동 → IP 등록 |
| 11번가 | 셀러오피스 → 셀러어드민 → API 관리 → IP 등록 |

정책 반영까지 시간 차이 있을 수 있음 (마켓별 운영팀 검토). 게이트웨이 구동과 무관하게 병행 진행 가능.

> 이전 버전 가이드에 "11번가만 IP 등록 필요" 라고 잘못 기재되어 있었음. 실 운영에서 5개 마켓 모두 IP 등록 단계가 키 발급의 전제임이 확인됨 (2026-05-23). 셀러 onboarding 안내에 명시 필요.

## 9. 트러블슈팅

| 증상 | 원인 후보 | 대응 |
|---|---|---|
| `curl /healthz` Connection refused | service 미기동 | `sudo systemctl status market-gateway` → `journalctl -u market-gateway -n 50` |
| `curl /healthz` 502 | Deno 프로세스 down / 환경변수 누락 | env 파일 확인 (`sudo cat /etc/market-gateway/env`), `MARKET_GATEWAY_SECRET` 채워졌는지 |
| TLS 인증서 발급 실패 | 80 포트 차단 / 도메인 불일치 / rate-limit | `journalctl -u caddy -n 100`, 80 포트 룰 재확인, sslip.io 도메인 정확히 `<ip-hyphen>.sslip.io` |
| Edge Function → gateway 401 `hmac mismatch` | 시크릿 양쪽 불일치 | 5.1 / 5.2 의 hex 값 동일한지 재확인. 양쪽 재배포 |
| Edge Function → gateway 403 `upstream host not allowed` | 어댑터 호출 호스트가 화이트리스트에 없음 | `main.ts:21` ALLOWED_UPSTREAM_HOSTS 확인. 신규 호스트면 PR 로 추가 |
| 메모리 부족 (OOM) | 트래픽 증가 / 메모리 누수 | `free -h` / `journalctl -u market-gateway | grep -i oom`. swap 사용량 확인. 지속 시 인스턴스 plan upgrade ($5 / $10 — Static IP 유지) |
| 마켓 API 401/403 | 해당 마켓 셀러 콘솔의 IP 화이트리스트 미등록 / 반영 지연 | §7 의 5개 마켓 등록 상태 확인. 등록 완료 후 수 분 대기 |
| 게이트웨이 → 마켓 502 `upstream error` | 마켓이 IP 차단 (= 키 발급 단계의 IP 등록 누락) | §7 참조. 5개 마켓 모두 동일 IP 등록 진행 |

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
  ubuntu@3.36.239.243:/tmp/main.ts
ssh -i ~/.ssh/<key>.pem ubuntu@3.36.239.243 \
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
