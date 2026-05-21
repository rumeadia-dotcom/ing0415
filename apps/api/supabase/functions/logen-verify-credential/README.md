# logen-verify-credential

로젠택배 Open API 자격증명(`userId`/`custCd`) 검증 + 발송인 정보 저장(pgcrypto 암호화).

## 호출 시퀀스

```
client
  └─ POST /functions/v1/logen-verify-credential
       headers: Authorization: Bearer <seller_jwt>
       body: {
         userId: string,        // 연동업체코드
         custCd: string,        // 거래처코드
         senderName: string,    // 발송인 이름
         senderAddress: string, // 발송인 주소
         senderPhone: string,   // 발송인 전화번호
         fareTy?: string,       // 운임구분 (기본 'C')
         dlvFare?: number       // 기본 운임 (기본 0)
       }

edge function
  ├─ 1) seller JWT 검증 (Supabase Auth)
  ├─ 2) body zod parse
  ├─ 3) POST https://(topen|open)api.ilogen.com/lrm02b-edi/edi/getSlipNo
  │      body: { userId, slipQty: 1 }
  │      timeout 15s, retry 0
  ├─ 4) resultCd 검증
  │      - '00' / 'OK' / 'SUCCESS' / 'S' → 성공
  │      - 'AUTH*' / 'E401' / 'E403' → status='unauthorized'
  │      - 그 외 실패 → status='error'
  └─ 5) 성공 시 RPC fn_set_logen_credentials (pgp_sym_encrypt 저장)
        → status='active' 응답
```

## 응답

```ts
{
  status: 'active' | 'unauthorized' | 'error',
  verifiedAt: ISO8601,
  correlationId: string,
  errorCode?: string,
  errorMessage?: string,
}
```

## 환경 변수

| Key | 기본값 | 비고 |
|---|---|---|
| `LOGEN_API_BASE_URL` | `https://topenapi.ilogen.com` | dev. 운영은 `https://openapi.ilogen.com` |
| `LOGEN_PGCRYPTO_KEY` | — | (직접 미사용 — `MASTER_KEY_<kid>` 라우팅 경유) |
| `MASTER_KEY_CURRENT_KID` | — | 자격증명 암호화 키 식별자 |
| `MASTER_KEY_<KID>` | — | 실제 pgcrypto 키 |

## 의존

- **PR2 마이그레이션 `20260521000005_logen_credentials_rpc.sql`** 가 다음 RPC 를 정의해야 한다:
  - `fn_set_logen_credentials(p_seller_id, p_user_id, p_cust_cd, p_sender_name, p_sender_address, p_sender_phone, p_fare_ty, p_dlv_fare, p_master_key, p_kid, p_correlation_id) returns uuid`
  - `fn_get_logen_credentials(p_seller_id, p_master_key, p_correlation_id) returns (...)`
- 본 PR 머지 시점에 PR2 가 먼저 적용되어 있어야 함.

## 보안 / 로깅

- `userId` / `custCd` / `senderPhone` 등 PII 는 로그에 **길이만** 출력 (`userIdLen` / `custCdLen`).
- 모든 외부 호출에 `X-Correlation-Id` 헤더 + 응답 header 로 echo.
- 실패는 `market_account_audit` 에 `verify_failure` 로 적재 (PII 제외).
- Logen API 응답 body 는 직접 응답에 노출하지 않음 — `resultCd` / 간략 메시지만.

## 실패 모드

| 시나리오 | 응답 status | errorCode |
|---|---|---|
| Logen 5xx | `error` | `http_5xx` |
| Logen 401/403 | `unauthorized` | `http_401` etc |
| Logen 429 | `error` | `http_429` |
| Logen 응답 JSON 파싱 실패 | `error` | `invalid_json` |
| Logen 응답 스키마 불일치 | `error` | `schema_mismatch` |
| resultCd = 'AUTH*' | `unauthorized` | (resultCd 그대로) |
| resultCd = 'VAL*' / 'SYS*' / 기타 | `error` | (resultCd 그대로) |
| pgcrypto RPC 실패 | `error` | `credentials_store_failed` |
| Logen timeout (15s) | `error` | `timeout` |
| 네트워크 오류 | `error` | `network` |
