-- 20260601000004_shipping_config.sql
-- C9: 수량 구간(박스) 배송비 — 배송 설정 인라인 재편.
-- 스펙: docs/superpowers/specs/2026-06-01-quantity-tiered-shipping-design.md §2.
--   - products.shipping_config jsonb (단일 진실원본) 추가, shipping_policy_id 제거.
--   - shipping_policies → 배송 템플릿(config jsonb + name + is_default)로 enrich.
-- 기존 배포는 pre-launch(실셀러 데이터 없음). 안전을 위해 backfill 후 드롭.

----------------------------------------------------------------------
-- 1. shipping_policies: config jsonb 추가 + 기존 flat(fee/method/eta_days) backfill.
----------------------------------------------------------------------
alter table public.shipping_policies
  add column config jsonb;

update public.shipping_policies sp
  set config = jsonb_build_object(
    'method',        sp.method::text,
    'etaDays',       sp.eta_days,
    'feeType',       case when sp.fee = 0 then 'free' else 'paid' end,
    'baseFee',       sp.fee,
    'payType',       'prepaid',
    'bundleAllowed', false
  )
  where sp.config is null;

alter table public.shipping_policies
  alter column config set not null;

-- 기존 flat 컬럼 제거 (템플릿은 config 단일 소스).
alter table public.shipping_policies
  drop column fee,
  drop column method,
  drop column eta_days;

comment on column public.shipping_policies.config is
  'C9 배송 템플릿(ShippingConfigSchema). shipping_policies = prefill 템플릿으로 강등.';

----------------------------------------------------------------------
-- 2. products: shipping_config jsonb 추가 + 참조 정책에서 backfill.
----------------------------------------------------------------------
alter table public.products
  add column shipping_config jsonb;

update public.products p
  set shipping_config = coalesce(
    (select sp.config from public.shipping_policies sp where sp.id = p.shipping_policy_id),
    jsonb_build_object(
      'method',        'parcel',
      'etaDays',       3,
      'feeType',       'free',
      'baseFee',       0,
      'payType',       'prepaid',
      'bundleAllowed', false
    )
  )
  where p.shipping_config is null;

alter table public.products
  alter column shipping_config set not null;

-- 필수 FK 제거 (인라인 모델로 전환).
alter table public.products
  drop column shipping_policy_id;

comment on column public.products.shipping_config is
  'C9 배송 설정 인라인(ShippingConfigSchema). feeType=quantity_tiered 시 box={qtyPerBox,feePerBox}.';
