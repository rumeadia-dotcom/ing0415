-- 20260531000001_seller_id_default_auth_uid.sql
-- 출처:
--   features/registration.md §3.2 shipping_policies / §3.3 products
--   security.md §RLS — owner 컬럼 default 관용구
-- 목적:
--   클라이언트 직접 INSERT 시 seller_id 누락으로 RLS WITH CHECK 위반(42501) 발생을 차단.
--
-- 배경 (2026-05-31 운영 사고):
--   shipping_policies INSERT (useShippingPolicies.ts) 가 seller_id 를 보내지 않아
--   real DB 에서 `new row violates row-level security policy` (PostgREST error=42501) 발생.
--   seller_id 컬럼은 NOT NULL + default 없음이라 NULL 로 들어가 `NULL = auth.uid()` → false.
--   products INSERT (useProductDraft.ts) 도 동일 패턴의 잠재 버그.
--   (mock supabase 는 RLS 미강제 → dev 에서는 드러나지 않고 real 에서만 발현.)
--
-- 해법:
--   owner 컬럼 seller_id 에 `default auth.uid()` 부여 — 클라이언트가 생략해도
--   인증된 호출자(authenticated)의 uid 로 자동 채움. RLS WITH CHECK(seller_id = auth.uid())
--   는 그대로 유지되므로, 다른 seller_id 를 명시 전송하는 spoofing 은 여전히 차단된다.
--   ALTER ... SET DEFAULT 는 멱등 (재적용 안전).

alter table public.shipping_policies
  alter column seller_id set default auth.uid();

alter table public.products
  alter column seller_id set default auth.uid();
