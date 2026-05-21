# logen-register-shipment

로젠택배 집하 예약 자동 등록 + 운송장번호 채번.

## 마스터 문서
- `docs/spec/PRD-v2-shipping.md` §2.2 (전체 처리 순서)
- `docs/spec/user_flow-v2-shipping.md` s8 n51 (자동 등록 흐름) / n50 (실패 시 수동 처리)
- `apps/api/supabase/migrations/20260521000001_orders.sql` (orders 테이블)
- `apps/api/supabase/migrations/20260521000003_logen_credentials.sql` (자격증명 테이블)

## 트리거
- `orders-sync` Edge Function 이 주문 수집 직후 `fetch ${SUPABASE_URL}/functions/v1/logen-register-shipment` 로 service_role JWT 부착하여 invoke.
- 외부 직접 호출 차단 — Authorization 헤더가 `SUPABASE_SERVICE_ROLE_KEY` 인지 검증.

## 입출력

### Request
```json
{
  "sellerId": "uuid",
  "orderIds": ["uuid", "..."]
}
```

### Response 200
```json
{
  "registered": 3,
  "failed": 1,
  "skipped": 0,
  "results": [
    { "orderId": "...", "status": "registered", "slipNo": "...", "fixTakeNo": "..." },
    { "orderId": "...", "status": "failed", "errorCode": "unauthorized", "errorMessage": "..." }
  ]
}
```

### Response 4xx / 5xx
- 401 `missing_token` / 403 `service_role_required` — 인증 실패
- 400 `validation` — 요청 본문 검증 실패
- 404 `logen_credential_not_found` — 셀러가 로젠 자격증명 미연결
- 500 `internal` — 예기치 못한 실패

## 처리 순서
1. 자격증명 복호 (`fn_decrypt_logen_credential` RPC — PR3 의존)
2. orders 로드 (`status='collected'` + seller_id 본인 필터)
3. `getSlipNo(slipQty=N)` — 1s/4s/9s 지수 백오프 재시도 3회
4. `registerOrderData × N` — `Promise.allSettled` + 주문별 1s/4s/9s 재시도 3회
5. DB 전이:
   - 성공 → `status='logen_registered'`, `logen_order_id=fixTakeNo`, `waybill_number=slipNo`, `logen_registered_at=now()`
   - 실패 → `status='logen_failed'`, `error_code`, `error_message`

## 재시도 정책
- `MarketError.retryable` (rate_limit / server / network) 만 재시도
- `unauthorized` / `validation` 는 즉시 종료 → `logen_failed` 진입 → n50 수동 처리 유도

## 의존 (외부)
- **PR3**: `fn_decrypt_logen_credential` RPC + 자격증명 검증 함수 (`logen-verify-credential`)
- **PR5**: `orders-sync` 가 본 함수를 invoke
- 로젠 OpenAPI: `getSlipNo`, `registerOrderData`

## 환경 변수
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — service_role 자기 검증
- `MASTER_KEY_<CURRENT_KID>` — 자격증명 복호용 pgcrypto 마스터 키
- `LOGEN_BASE_URL` (optional) — 기본값 `https://openapi.ilogen.com` (운영). 개발: `https://topenapi.ilogen.com`

## 로깅
- 외부 호출은 `→ market request` / `← market response` / `← market error` 패턴 (CLAUDE.md "외부 API 로깅 패턴")
- 자격증명 평문 (`userId` / `custCd`) 절대 노출 금지 — 길이만 (`userIdLen`, `custCdLen`)
- `correlationId` 모든 로그에 부착

## 테스트
- `tests/unit/edge/logen-register-shipment.test.ts` — Vitest (Deno 런타임 없이 Node 환경에서 알고리즘 검증)
- 시나리오: happy / 부분 실패 / 전체 실패 / 재시도 / slipNo 부족 / 비대상 주문 스킵
