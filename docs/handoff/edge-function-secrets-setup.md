# Edge Function Secrets 셋업 가이드 (운영 — `real` 프로젝트)

운영 Supabase 프로젝트 (`lfrnythcujxdhehvkmtg`) 의 Edge Function 이 부팅하려면 아래 시크릿이 필요. 누락 시 함수가 시작도 못하고 `event loop error: Error: [env] invalid environment: ...` 로 throw 한다.

이 문서는 그 누락 시크릿을 한 번에 채우는 절차다. 한 번만 하면 영구.

## 진단 — 정말 누락인지 먼저 확인

Supabase Dashboard → Settings → **Edge Functions** → **Secrets** 탭:

🔗 https://supabase.com/dashboard/project/lfrnythcujxdhehvkmtg/settings/functions

아래 4개가 모두 있으면 본 가이드 불필요. 1개라도 없으면 진행.

| Secret | 필수? |
|---|---|
| `MASTER_KEY_CURRENT_KID` | ✅ |
| `MASTER_KEY_<위 KID 값>` | ✅ |
| `PUBLIC_APP_ORIGIN` | ✅ |
| `DAILY_SALT` | ✅ |

## A. 마스터 키 (pgcrypto)

마켓 OAuth 토큰·자격증명을 pgcrypto 로 AES 암호화해서 저장할 때 사용. 한 번 생성하면 영구 보관 (분실 시 기존 자격증명 복호화 불가).

### A.1 KID 결정

키 식별자. 분기별 회전 권장. 예: `mk_2026_q2` (2026년 2분기).

→ **Secret 이름**: `MASTER_KEY_CURRENT_KID`
→ **Value**: `mk_2026_q2`

### A.2 마스터 키 값 생성

PowerShell / Mac terminal / Lightsail Browser SSH 어디서든:

```bash
openssl rand -hex 32
```

출력 예시 (64자 hex):
```
a3f9b2c1d4e5...
```

→ **Secret 이름**: `MASTER_KEY_mk_2026_q2` (KID 와 매칭)
→ **Value**: 위 명령 출력 그대로

### A.3 보관

이 키를 **분실하면 기존 암호화 데이터 복호화 불가**. 비밀번호 매니저 (1Password / Bitwarden) 같은 곳에 보관.

## B. PUBLIC_APP_ORIGIN

OAuth 콜백 redirect_uri 화이트리스트 검증에 사용.

→ **Secret 이름**: `PUBLIC_APP_ORIGIN`
→ **Value**: `https://rumeadia-dotcom.github.io`

> 경로 (예: `/ing0415`) 는 포함하지 않음. 도메인만.

## C. DAILY_SALT

IP / User-Agent fingerprint 의 일일 회전 salt. KPI 계산용. 32자 이상.

```bash
openssl rand -hex 32
```

→ **Secret 이름**: `DAILY_SALT`
→ **Value**: 위 명령 출력

> 운영 정책상 매일 회전 권장. 첫 셋업은 한 번만, 그 후 cron / GitHub Actions 스케줄로 회전 가능 (별도 트랙).

## D. APP_MODE (권장)

기본값은 `debug`. 운영은 `real` 로 명시.

→ **Secret 이름**: `APP_MODE`
→ **Value**: `real`

## E. Market Gateway (이미 GH Actions 가 자동 등록)

`Deploy Market Gateway → full-setup` 또는 `rotate-secret` 실행 시 워크플로우가 아래 2개를 자동으로 dev / real 양쪽 Supabase 에 push:

- `MARKET_GATEWAY_SECRET` (게이트웨이 인스턴스 HMAC)
- `MARKET_GATEWAY_BASE_URL` (`https://43-201-83-78.sslip.io`)

만약 누락이면 워크플로우를 한 번 더 실행하거나 수동 등록:

→ **Secret 이름**: `MARKET_GATEWAY_BASE_URL`
→ **Value**: `https://43-201-83-78.sslip.io`

→ **Secret 이름**: `MARKET_GATEWAY_SECRET`
→ **Value**: Lightsail 인스턴스의 `/etc/market-gateway/env` 파일의 `MARKET_GATEWAY_SECRET=` 뒤 값

> Lightsail Browser SSH 에서 확인:
> ```bash
> sudo cat /etc/market-gateway/env | grep MARKET_GATEWAY_SECRET
> ```
> 출력의 `=` 오른쪽 hex 64자.

## F. 등록 절차 (Supabase Dashboard)

위 A–E 의 각 Secret 을 차례로:

1. 🔗 https://supabase.com/dashboard/project/lfrnythcujxdhehvkmtg/settings/functions 접속
2. **Add new secret** 버튼
3. **Name** + **Value** 입력 → **Save**
4. 다음 secret 반복

> Supabase Dashboard 가 secret 을 저장하면 **모든 Edge Function 이 자동 재시작**된다 (수분 내). 별도 deploy 불필요.

## G. 검증

### G.1 Edge Function 부팅 확인

🔗 https://supabase.com/dashboard/project/lfrnythcujxdhehvkmtg/logs/edge-functions

가장 최근 로그에서:
- ❌ `event loop error: Error: [env] invalid environment: ...` → 아직 누락. 어떤 변수인지 메시지 확인.
- ✅ 정상 로그 (예: `boot: edge function ready`) → 부팅 성공.

### G.2 실 호출 검증

운영 사이트 (https://rumeadia-dotcom.github.io/ing0415/) 접속 → 마켓 계정 페이지에서 쿠팡 또는 G마켓 자격증명 입력 시도.

이번엔 `알 수 없는 오류` 가 아니라:
- 잘못된 키 → **`인증 실패 (401)`** 같은 명확한 마켓 응답
- 올바른 키 → **`연결 성공`**

게이트웨이 로그 (`sudo journalctl -u market-gateway -f`) 에 동시에:
```
→ proxy request market=coupang ...
← proxy response status=401|200 ms=...
```

위 로그 라인이 보이면 어댑터 → 게이트웨이 → 마켓 의 전체 흐름이 정상.

## H. 마켓 OAuth Client (해당 마켓 사용 시 추후 등록)

각 마켓의 개발자 센터에서 발급받은 client 자격증명. **필수 아님** — 해당 마켓 OAuth 흐름이 필요한 시점에 등록.

| Secret | 값 출처 |
|---|---|
| `NAVER_CLIENT_ID` | 네이버 커머스 API 센터 |
| `NAVER_CLIENT_SECRET` | 네이버 커머스 API 센터 |
| `COUPANG_VENDOR_ID` | 쿠팡 Wing |
| `COUPANG_ACCESS_KEY` | 쿠팡 Wing |
| `COUPANG_SECRET_KEY` | 쿠팡 Wing |

> 쿠팡 / 네이버는 셀러별 자격증명이므로 본 Edge Function env 가 아니라 **사용자별 `market_accounts` 테이블의 `credential_payload`** 에 암호화 저장이 정석. 본 env 의 값은 OAuth client (앱) 자격증명 — 셀러 자격증명과 별개.

## I. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `event loop error: invalid environment: MASTER_KEY_CURRENT_KID, ...` | 4개 필수 누락 | A–C 다시 |
| `[env] master key not found or too short for kid=mk_2026_q2` | KID 와 매칭되는 동적 키 누락 | A.2 다시 — Secret 이름이 `MASTER_KEY_mk_2026_q2` 인지 확인 |
| `MARKET_GATEWAY_BASE_URL` 누락 → 어댑터 호출 시 `gateway not configured` | GH Actions 가 옛 이름 (`MARKET_GATEWAY_URL`) 으로 등록했었음 | hotfix/v0.9.1 머지 후 워크플로우 재실행 또는 수동 등록 |

## 설계 정합

- `docs/architecture/v1/security.md §5` — 시크릿 분류
- `docs/architecture/v1/cross-cutting/credential-vault.md §5` — pgcrypto 마스터 키 회전
- `apps/api/supabase/functions/_shared/env.ts` — zod 검증 단일 소스
