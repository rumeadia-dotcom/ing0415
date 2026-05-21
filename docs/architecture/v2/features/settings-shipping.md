# features/settings-shipping.md — 배송 설정 (s9) 설계 (v2)

> v2 주문·배송 자동화의 s9 도메인 단일 진입점.
> 의존: `overview.md`, `cross-cutting/logen-adapter.md`, `docs/spec/PRD-v2-shipping.md` §3 / §4, `docs/spec/user_flow-v2-shipping.md` s9 (n58~n60).
> 소관: backend + security 주도 (자격증명 암호화), frontend / qa 리뷰.

---

## 1. 범위

- **포함**:
  - 화면: `/settings/shipping` (n58 허브), `/settings/shipping/logen` (n59 API 연동), `/settings/shipping/sender` (n60 발송인 정보).
  - 데이터: `logen_credentials` 테이블 + RLS + pgcrypto.
  - Edge Function: `logen-verify-credential` (연결 테스트).
  - 설정 토글: `auto_dispatch_after_print`, 기본 택배사.
- **제외**:
  - 마켓 계정 (`market_accounts`) 설정 → v1 `features/markets.md`.
  - 로젠 API 4 메서드 명세 → `cross-cutting/logen-adapter.md`.
  - 실제 자격증명 사용처 → `features/shipping.md`.

---

## 2. user_flow 매핑

| 노드 | 경로 | 컴포넌트 |
|---|---|---|
| n58 | `/settings/shipping` | `SettingsShippingPage` |
| n59 | `/settings/shipping/logen` | `SettingsShippingLogenPage` |
| n60 | `/settings/shipping/sender` | `SettingsShippingSenderPage` |

---

## 3. 데이터 모델

### 3.1 `logen_credentials` (셀러당 1 row)

```sql
create table logen_credentials (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade unique,

  -- 자격증명 (pgcrypto pgp_sym_encrypt 적용된 bytea — 평문 컬럼 없음)
  user_id_enc     bytea not null,     -- userId (연동업체코드)
  cust_cd_enc     bytea not null,     -- custCd (거래처코드)

  -- 발송인 정보 (평문 — PII 이지만 셀러 본인 정보, RLS 로 보호)
  sender_name     text,
  sender_address  text,
  sender_phone    text,

  -- 계약 시 확정 운영값
  fare_ty         text not null default 'C',
  dlv_fare        int  not null default 0,

  -- 동작 설정
  auto_dispatch_after_print boolean not null default false,

  -- 메타
  verified_at     timestamptz,        -- logen-verify-credential 마지막 성공 시각
  verification_error text,            -- 마지막 검증 실패 사유

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table logen_credentials enable row level security;

create policy logen_credentials_select_own on logen_credentials
  for select using (seller_id = auth.uid());

create policy logen_credentials_upsert_own on logen_credentials
  for insert with check (seller_id = auth.uid());

create policy logen_credentials_update_own on logen_credentials
  for update using (seller_id = auth.uid());

-- 단, 클라이언트가 user_id_enc / cust_cd_enc 컬럼에 직접 raw bytea 를 쓸 수 없도록
-- INSERT/UPDATE 시 두 컬럼은 security definer RPC 만 허용 (정책 + grant 분리):
--   rpc.save_logen_credential(p_user_id text, p_cust_cd text, ...) returns void
-- RPC 내부에서 pgp_sym_encrypt(p_user_id, current_setting('app.pgcrypto_key')) 적용.
```

### 3.2 복호화 RPC

```sql
create or replace function rpc.read_logen_credential_for_function(p_seller_id uuid)
returns table (
  user_id text, cust_cd text,
  sender_name text, sender_address text, sender_phone text,
  fare_ty text, dlv_fare int, auto_dispatch_after_print boolean
)
language plpgsql
security definer
as $$
begin
  -- Edge Function (service_role) 만 호출 허용 — grant execute to service_role
  return query
  select
    pgp_sym_decrypt(user_id_enc, current_setting('app.pgcrypto_key'))::text,
    pgp_sym_decrypt(cust_cd_enc, current_setting('app.pgcrypto_key'))::text,
    sender_name, sender_address, sender_phone,
    fare_ty, dlv_fare, auto_dispatch_after_print
  from logen_credentials
  where seller_id = p_seller_id;
end;
$$;

revoke all on function rpc.read_logen_credential_for_function(uuid) from public;
grant execute on function rpc.read_logen_credential_for_function(uuid) to service_role;
```

v1 `cross-cutting/credential-vault.md` 의 마켓 토큰 복호화 패턴과 동일 구조.

---

## 4. Edge Function — `logen-verify-credential` (n59)

### 4.1 시그니처

```ts
const LogenVerifyRequest = z.object({
  sellerId: z.string().uuid()
}).strict();

const LogenVerifyResponse = z.object({
  ok: z.boolean(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  verifiedAt: z.string().datetime().optional()
}).strict();
```

### 4.2 처리

```
1. logen_credentials 복호화 (rpc.read_logen_credential_for_function)
2. logen-adapter.getSlipNo(slipQty=1) 호출 — 베이스 URL 은 sandbox(topenapi) 또는 운영 환경 분리
3. 응답 resultCd === '0' (성공) → logen_credentials.verified_at = now(), verification_error = null
4. 실패 → verified_at 유지, verification_error 갱신
5. 성공 응답의 slipNo 는 즉시 폐기 (사용하지 않음, 채번 누수 우려 시 로젠 API 로 반환 요청 — 운영 정책 확인 필요)
```

### 4.3 보안

- `userId` / `custCd` 는 응답 / 로그에 절대 노출 금지 (security.md §6.2 화이트리스트 기준).
- Sentry `beforeSend` 가 본 함수의 모든 이벤트에서 `userId|user_id|custCd|cust_cd` 키 마스킹 강제.

---

## 5. 화면 — s9

### 5.1 n58 `/settings/shipping` 허브

레이아웃:
- 카드 1: 로젠택배 API 연동 상태 (연결됨 / 미연결 / 검증 실패) + [관리] → /settings/shipping/logen.
- 카드 2: 발송인 정보 (이름/주소/연락처 요약) + [편집] → /settings/shipping/sender.
- 카드 3: 동작 설정
  - 토글: "출력 후 자동 제출" (auto_dispatch_after_print)
  - 기본 택배사: v2 = 로젠만 (disabled, "추가 예정" 표기).

### 5.2 n59 `/settings/shipping/logen`

- 폼: `userId(연동업체코드)`, `custCd(거래처코드)` — both 6~12자 영숫자 (zod 검증, 로젠 규칙).
- [저장] → RPC `rpc.save_logen_credential` 호출 → 암호화 저장.
- [연결 테스트] → `logen-verify-credential` 호출 → 결과 토스트 + 카드 상태 갱신.
- 실패 시 에러 메시지 가이드:
  - `LGN_INVALID_CREDENTIAL` → "코드를 다시 확인해주세요"
  - `LGN_CONTRACT_NOT_FOUND` → "B2B 계약 진행이 필요합니다 (로젠 영업 담당 문의)"
  - 기타 → ErrorMessage fold.

### 5.3 n60 `/settings/shipping/sender`

- 폼: 발송인명 / 발송지 주소 / 연락처 / fareTy / dlvFare.
- 주소: 카카오 우편번호 API 또는 직접 입력 (v1 register step 4 의 컴포넌트 재사용 검토 — frontend.md 참조).
- fareTy: enum select ('C' = 착불, 'S' = 선불 등 — 운영값은 OQ-V2-04 해결 후 확정).
- 저장: 일반 UPDATE (암호화 컬럼 아님, RLS 로 본인만).

---

## 6. 보안 (요약)

| 항목 | 정책 |
|---|---|
| `userId` / `custCd` | pgcrypto bytea 컬럼만, 평문 컬럼 0, RPC 복호화는 service_role 만 |
| 로그 마스킹 | `userId|user_id|custCd|cust_cd` 키 마스킹 자동 (security.md §6.2 화이트리스트) |
| 발송인 정보 | 평문 저장 (셀러 본인 PII), RLS 로 본인만 SELECT/UPDATE |
| 자격증명 폼 | 입력 후 client state 에서 즉시 폐기 (RPC 호출 후 unmount) |

---

## 7. 테스트 매트릭스

| ID | 영역 | 케이스 |
|---|---|---|
| SS-001 | n59 form | userId 형식 위반 → 즉시 zod 에러 |
| SS-002 | RPC | 동일 seller_id 재저장 시 upsert 동작 |
| SS-003 | verify | 정상 코드 → verified_at 갱신 |
| SS-004 | verify | LGN_INVALID_CREDENTIAL → 사용자 메시지 매핑 |
| SS-005 | RLS | 타 셀러 logen_credentials 직접 SELECT → 거부 |
| SS-006 | n60 | fareTy / dlvFare 미설정 시 n51 등록 시도 → blockingReasons 노출 |
| SS-007 | log mask | Sentry breadcrumb 에 userId/custCd 미포함 검증 |

---

## 8. 미해결 사안

- OQ-V2-04: 운영 fareTy / dlvFare 값 — 로젠 계약 시 확정, 본 문서 §5.3 의 default 갱신.
- OQ-V2-05: `auto_dispatch_after_print` default 값 — 셀러 조사 후 결정 (현재 false).
- 로젠 채번 누수 시 반환 API 존재 여부 — verify 흐름의 slipNo 폐기 정책 영향.
