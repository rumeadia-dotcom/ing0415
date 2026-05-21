# cross-cutting/logen-adapter.md — 로젠택배 API 어댑터 명세

> 로젠택배 B2B Open API 의 4 메서드를 주문·배송 Edge Functions 가 공통으로 사용하기 위한 단일 어댑터 명세.
> 의존: `docs/spec/PRD.md` §6.2 / §6.3 / §7, `features/shipping.md`, `features/settings-shipping.md`.
> 위치: `apps/api/supabase/functions/_shared/logen-adapter.ts` (PR3 에서 구현).

---

## 1. Base URL

| 환경 | URL |
|---|---|
| 개발 (sandbox) | `https://topenapi.ilogen.com` |
| 운영 | `https://openapi.ilogen.com` |

- Edge Function 환경 변수 `LOGEN_BASE_URL` 로 주입 (debug / real 분리).
- `logen-verify-credential` 은 항상 sandbox 사용 검토 (운영 채번 누수 우려) — 운영 정책 확정 시 본 문서 갱신.

---

## 2. 인증

- 모든 요청에 `userId` (연동업체코드) + `custCd` (거래처코드) 를 body 또는 query 로 첨부.
- 두 값은 `logen_credentials` 의 bytea 컬럼에서 pgcrypto 복호화로만 획득 (`rpc.read_logen_credential_for_function`).
- HTTPS only.

---

## 3. 메서드 4 종

### 3.1 `getSlipNo` — 운송장번호 채번

```
POST /lrm02b-edi/edi/getSlipNo
Content-Type: application/json

Request:
{
  "userId": "<연동업체코드>",
  "slipQty": 25       // 채번할 운송장 개수
}

Response (success):
{
  "resultCd": "0",
  "resultMsg": "SUCCESS",
  "startSlipNo": "123456780001",
  "closeSlipNo": "123456780025",
  "slipNo": ["123456780001", ..., "123456780025"]
}
```

- `slipQty` 는 1 이상 정수. 운영상 한 회 호출 상한은 로젠 정책 확인 (현재 가정: 100).
- `slipNo[]` 의 개수가 `slipQty` 와 다른 경우 즉시 에러 처리.
- 채번 후 사용하지 않으면 누수 — 가능하면 `slipQty = 실제 등록할 주문 수` 로 정확히 호출.

### 3.2 `registerOrderData` — 주문 정보 일괄 등록

```
POST /lrm02b-edi/edi/registerOrderData
Content-Type: application/json

Request:
{
  "userId": "<연동업체코드>",
  "custCd": "<거래처코드>",
  "takeDt": "20260521",          // 집하 희망일 (YYYYMMDD)
  "sndCustNm": "<발송인 이름>",
  "sndCustAddr": "<발송지 주소>",
  "sndTelNo": "<발송인 연락처>",
  "rcvCustNm": "<수취인 이름>",
  "rcvCustAddr": "<수취인 주소>",
  "rcvTelNo": "<수취인 연락처>",
  "fareTy": "C",                  // 운임타입 (계약값)
  "qty": 1,                       // 박스 수량
  "dlvFare": 0,                   // 택배운임 (계약값)
  "fixTakeNo": "<셀러 측 주문 식별자, orders.id 사용>",
  "slipNo": "123456780001"        // getSlipNo 로 받은 1개
}

Response (success):
{
  "resultCd": "0",
  "resultMsg": "SUCCESS",
  "fixTakeNo": "<echo>",
  "slipNo": "<echo>"
}
```

- 한 호출이 한 주문 = 한 slipNo. 다건 등록은 호출자가 Promise.allSettled 로 fan-out.
- `fixTakeNo` 는 셀러 측 식별자 — 본 시스템에서는 `orders.id` (UUID) 를 그대로 사용.
- DB 저장: `orders.logen_order_id = response.fixTakeNo`, `orders.waybill_number = slipNo`.

### 3.3 `outSlipPrintPop` — 운송장 출력 팝업

```
GET /lrm02b-edi/edi/outSlipPrintPop?userId=...&custCd=...&takeDt=20260521
Accept: text/html
```

- 응답: 로젠 인쇄 팝업 HTML 또는 redirect URL.
- 본 시스템에서는 Edge Function 이 URL 생성 후 단발 응답 (클라이언트가 `window.open`).
- URL 자체에 `userId` / `custCd` 가 포함되면 안 됨 — 로젠이 토큰화 / 세션화된 URL 을 제공하는지 운영 검증 필요. 미지원 시 별도 토큰 게이트웨이 구현.

### 3.4 `inquirySlipNoMulti` — 출력 송장번호 조회 (fallback)

```
POST /lrm02b-edi/edi/inquirySlipNoMulti
Content-Type: application/json

Request:
{
  "userId": "<연동업체코드>",
  "custCd": "<거래처코드>",
  "takeDt": "20260521",
  "fixTakeNos": ["uuid1", "uuid2", ...]
}

Response (success):
{
  "resultCd": "0",
  "items": [
    { "fixTakeNo": "uuid1", "slipNo": "123456780001" },
    ...
  ]
}
```

- 사용처: `registerOrderData` 응답을 어떤 이유로 잃었을 때 slipNo 재조회.
- 본 시스템에서는 1순위로 사용하지 않고, 운영 incident 대응용으로 보존.

---

## 4. 에러 코드 매핑

| 로젠 resultCd / message | 어댑터 errorCode | 사용자 메시지 (i18n) |
|---|---|---|
| `0` | (success) | — |
| `1` 이상 + `INVALID_USERID` | `LGN_INVALID_CREDENTIAL` | "로젠 연동 코드를 다시 확인해주세요" |
| `INVALID_CUSTCD` | `LGN_INVALID_CREDENTIAL` | 동일 |
| `CONTRACT_NOT_FOUND` | `LGN_CONTRACT_NOT_FOUND` | "B2B 계약 진행이 필요합니다 (로젠 영업 담당 문의)" |
| `SLIPNO_EXHAUSTED` | `LGN_SLIPNO_EXHAUSTED` | "채번 가능한 운송장이 부족합니다. 로젠 담당자에게 문의해주세요" |
| `INVALID_RECEIVER` | `LGN_INVALID_RECEIVER` | "수취인 정보가 올바르지 않습니다 (주소/연락처 확인)" |
| 5xx / 네트워크 | `LGN_TRANSIENT` | "일시적 오류입니다. 잠시 후 다시 시도해주세요" — 자동 재시도 대상 |
| 기타 | `LGN_UNKNOWN` | 원문 + ErrorMessage fold |

LGN_TRANSIENT 만 어댑터 외부 (Edge Function) 의 재시도 정책 (`shipping.md` §4.2 — 3회 지수 백오프) 대상. 나머지는 즉시 실패.

---

## 5. 어댑터 인터페이스 (TS)

```ts
// apps/api/supabase/functions/_shared/logen-adapter.ts (PR3 구현)
export interface LogenAdapter {
  getSlipNo(input: { slipQty: number }): Promise<{ slipNo: string[]; startSlipNo: string; closeSlipNo: string }>;
  registerOrderData(input: RegisterOrderDataInput): Promise<{ fixTakeNo: string; slipNo: string }>;
  outSlipPrintPopUrl(input: { takeDt: string }): Promise<string>;  // 단발 URL 반환
  inquirySlipNoMulti(input: { takeDt: string; fixTakeNos: string[] }): Promise<Array<{ fixTakeNo: string; slipNo: string }>>;
}

export interface LogenAdapterCredentials {
  userId: string;
  custCd: string;
}

// 팩토리
export function createLogenAdapter(creds: LogenAdapterCredentials, baseUrl: string): LogenAdapter;
```

- `creds` 는 Edge Function 진입 시점에 1회 복호화 후 closure 보존 — 호출 사이에 재복호화 금지.
- baseUrl 은 환경 변수 주입.

---

## 6. 로깅 정책

CLAUDE.md "외부 API 로깅 패턴" 준수. 로젠 호출의 모든 로그에 다음 규칙:

```ts
logger.info({
  carrier: 'logen',
  method: 'getSlipNo' | 'registerOrderData' | ...,
  sellerId,             // UUID — 마스킹 대상 아님
  correlationId,        // 폴링 사이클 ID
  jobId?,               // ShippingJob ID (해당 시)
  slipQty?,             // 메서드별 핵심 파라미터
}, '→ logen request');
```

- `userId` (연동업체코드) / `custCd` (거래처코드) / `slipNo` / `sndTelNo` / `rcvTelNo` / `*Addr` 는 **절대 로그 미포함**.
- Sentry `beforeSend` 화이트리스트에 `carrier`, `method`, `sellerId`, `correlationId`, `jobId`, `errorCode` 만 포함 — 기타 키 자동 redact (`security.md §6.2` 마스터).

---

## 7. 단위 테스트 요구사항

| ID | 케이스 |
|---|---|
| LA-001 | getSlipNo 응답 slipNo[].length === slipQty 보장 |
| LA-002 | registerOrderData resultCd '0' → success 매핑 |
| LA-003 | resultCd != '0' → errorCode 매핑 정확성 |
| LA-004 | 5xx → LGN_TRANSIENT |
| LA-005 | userId / custCd 가 로그·예외 메시지에 포함되지 않음 (regex 검증) |
| LA-006 | inquirySlipNoMulti 빈 결과 처리 |
| LA-007 | outSlipPrintPopUrl 응답에 자격증명 미포함 검증 |

테스트 위치: `apps/api/supabase/functions/_shared/__tests__/logen-adapter.test.ts` (Deno test).

---

## 8. 미해결 사안

- 로젠 API 의 `slipQty` 회당 상한 — 운영 확인 필요 (가정 100).
- `outSlipPrintPop` 의 토큰화된 URL 발급 여부 — 미지원 시 자체 토큰 게이트웨이 설계 (별도 문서).
- `inquirySlipNoMulti` 의 `takeDt` 단위 — 일자 단위로 제한되는지 확인.
- 채번 후 미사용 slipNo 의 반환/취소 API 존재 여부 — `logen-verify-credential` 의 verify 흐름 영향.
