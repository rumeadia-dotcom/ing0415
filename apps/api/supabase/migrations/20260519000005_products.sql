-- 20260519000005_products.sql
-- 출처:
--   features/registration.md §3.1 ENUM, §3.2 shipping_policies, §3.3 products, §3.5 product_market_mappings
--   cross-cutting/image-pipeline.md §6 product_images / product_image_transforms
--   features/history.md §3.2 (products.thumbnail_image_id 참조 — 본 마이그레이션이 컬럼 추가)
-- 목적: s3 상품 등록 도메인의 데이터 모델 (이미지·배송정책·매핑 포함).

----------------------------------------------------------------------
-- 1. ENUM (registration.md §3.1 + image-pipeline.md §6)
----------------------------------------------------------------------
create type public.product_status as enum (
  'draft',
  'ready',
  'registered'
);

create type public.product_image_role as enum (
  'main',
  'sub'
);

create type public.shipping_method as enum (
  'parcel',
  'direct',
  'quick',
  'visit_pickup'
);

-- image-pipeline.md §6 image_status / transform_status
create type public.image_status as enum (
  'pending',
  'uploaded',
  'transforming',
  'ready',
  'failed'
);

create type public.transform_status as enum (
  'pending',
  'running',
  'succeeded',
  'failed'
);

-- 마켓 ID 는 ENUM 대신 text + check (registration.md / markets.md 모두 text 채택)
-- — 신규 마켓 추가가 ENUM ALTER 보다 가벼움.

----------------------------------------------------------------------
-- 2. shipping_policies (registration.md §3.2)
----------------------------------------------------------------------
create table public.shipping_policies (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  fee             integer not null check (fee >= 0),
  method          public.shipping_method not null,
  eta_days        smallint not null check (eta_days between 0 and 30),
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint shipping_policies_name_len check (char_length(name) between 1 and 50)
);

-- 기본 배송정책은 셀러당 최대 1개
create unique index shipping_policies_default_per_seller
  on public.shipping_policies (seller_id)
  where is_default = true;

create index shipping_policies_seller_idx on public.shipping_policies (seller_id);

alter table public.shipping_policies enable row level security;

create policy shipping_policies_select_own
  on public.shipping_policies for select
  using (seller_id = auth.uid());

create policy shipping_policies_insert_own
  on public.shipping_policies for insert
  with check (seller_id = auth.uid());

create policy shipping_policies_update_own
  on public.shipping_policies for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy shipping_policies_delete_own
  on public.shipping_policies for delete
  using (seller_id = auth.uid());

----------------------------------------------------------------------
-- 3. products (registration.md §3.3 + history.md thumbnail_image_id 참조)
--    thumbnail_image_id 는 product_images 가 생성된 후 FK 가능하므로
--    초기 NULLABLE + DEFERRED FK 패턴 또는 ALTER 추가. 여기서는 product_images 가
--    같은 마이그레이션에서 만들어진 후 ALTER 로 FK 추가.
----------------------------------------------------------------------
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  seller_id           uuid not null references auth.users(id) on delete cascade,

  -- 기본 정보
  name                text not null,
  price               integer not null check (price >= 0),
  original_price      integer check (original_price is null or original_price >= price),
  brand               text,
  manufacturer        text,
  description_html    text,                                  -- DOMPurify sanitized HTML

  -- 카테고리 (내부 단일 카테고리. 마켓별 매핑은 product_market_mappings)
  base_category_id    text not null,

  -- 배송
  shipping_policy_id  uuid references public.shipping_policies(id) on delete restrict,

  -- 대표 이미지 ID (history.md §3.2 인용). FK 는 product_images 생성 후 ALTER.
  thumbnail_image_id  uuid,

  -- 상태
  status              public.product_status not null default 'draft',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint products_name_len         check (char_length(name) between 2 and 100),
  constraint products_brand_len        check (brand is null or char_length(brand) <= 50),
  constraint products_manufacturer_len check (manufacturer is null or char_length(manufacturer) <= 50),
  constraint products_description_len  check (description_html is null or char_length(description_html) <= 50000)
);

create index products_seller_idx        on public.products (seller_id);
create index products_seller_status_idx on public.products (seller_id, status);
create index products_seller_updated    on public.products (seller_id, updated_at desc);

alter table public.products enable row level security;

create policy products_select_own
  on public.products for select
  using (seller_id = auth.uid());

create policy products_insert_own
  on public.products for insert
  with check (seller_id = auth.uid());

create policy products_update_own
  on public.products for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy products_delete_own
  on public.products for delete
  using (seller_id = auth.uid());

-- updated_at 트리거 (sellers 의 touch_updated_at 재사용)
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

----------------------------------------------------------------------
-- 4. product_images (image-pipeline.md §6 마스터 DDL)
----------------------------------------------------------------------
create table public.product_images (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  position        smallint not null check (position between 0 and 9),
  original_path   text not null,
  mime            text not null check (mime in ('image/jpeg','image/png','image/webp')),
  bytes           bigint not null check (bytes > 0 and bytes <= 10485760),  -- 10MB
  width           int,
  height          int,
  sha256          text,                                    -- 멱등성 키
  status          public.image_status not null default 'pending',
  uploaded_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (product_id, position),
  unique (seller_id, sha256)                               -- 동일 셀러 동일 파일 재업로드 차단
);

create index product_images_product_idx on public.product_images (product_id);
create index product_images_status_idx  on public.product_images (status);

alter table public.product_images enable row level security;

create policy product_images_select_own
  on public.product_images for select
  using (seller_id = auth.uid());

create policy product_images_insert_own
  on public.product_images for insert
  with check (seller_id = auth.uid());

create policy product_images_update_own
  on public.product_images for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy product_images_delete_own
  on public.product_images for delete
  using (seller_id = auth.uid());

create trigger product_images_set_updated_at
  before update on public.product_images
  for each row execute function public.touch_updated_at();

-- 이제 products.thumbnail_image_id 의 FK 를 추가 (forward ref 회피).
alter table public.products
  add constraint products_thumbnail_image_fk
  foreign key (thumbnail_image_id) references public.product_images(id) on delete set null;

----------------------------------------------------------------------
-- 5. product_image_transforms (image-pipeline.md §6 — 마켓별 변환본)
--    INSERT/UPDATE 는 service_role 만. 클라이언트는 SELECT 만.
----------------------------------------------------------------------
create table public.product_image_transforms (
  id              uuid primary key default gen_random_uuid(),
  image_id        uuid not null references public.product_images(id) on delete cascade,
  market          text not null check (market in ('naver','coupang','11st','gmarket','auction')),
  output_path     text,
  output_bytes    bigint,
  output_width    int,
  output_height   int,
  output_format   text check (output_format in ('jpeg','png','webp')),
  status          public.transform_status not null default 'pending',
  error_code      text,
  error_message   text,                                    -- 마스킹된 사용자 노출 메시지
  attempts        smallint not null default 0,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),

  unique (image_id, market)
);

create index pit_image_idx  on public.product_image_transforms (image_id);
create index pit_status_idx on public.product_image_transforms (status);

alter table public.product_image_transforms enable row level security;

-- SELECT: 셀러 본인의 image 가 가진 변환본만
create policy pit_select_own
  on public.product_image_transforms for select
  using (
    exists (
      select 1 from public.product_images pi
      where pi.id = product_image_transforms.image_id
        and pi.seller_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE 정책 부재 → service_role 만 (image-transform Edge Function).

----------------------------------------------------------------------
-- 6. product_market_mappings (registration.md §3.5)
----------------------------------------------------------------------
create table public.product_market_mappings (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null references public.products(id) on delete cascade,
  seller_id               uuid not null references auth.users(id) on delete cascade,
  market_id               text not null
                          check (market_id in ('naver','coupang','11st','gmarket','auction')),

  -- 카테고리 매핑 (Step 3)
  market_category_code    text not null,

  -- 사용자 오버라이드 (선택)
  market_name_override    text,
  market_price_override   integer
                          check (market_price_override is null or market_price_override >= 0),

  -- 마켓 고유 옵션
  market_options          jsonb not null default '{}'::jsonb,

  -- 변환 마지막 검증 시점
  last_validated_at       timestamptz,
  last_validation_errors  jsonb,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint pmm_unique_per_product_market unique (product_id, market_id),
  constraint pmm_override_name_len check (
    market_name_override is null or char_length(market_name_override) between 2 and 100
  )
);

create index pmm_product_idx on public.product_market_mappings (product_id);
create index pmm_seller_idx  on public.product_market_mappings (seller_id);
create index pmm_market_idx  on public.product_market_mappings (market_id);

alter table public.product_market_mappings enable row level security;

create policy pmm_select_own
  on public.product_market_mappings for select
  using (seller_id = auth.uid());

create policy pmm_insert_own
  on public.product_market_mappings for insert
  with check (seller_id = auth.uid());

create policy pmm_update_own
  on public.product_market_mappings for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy pmm_delete_own
  on public.product_market_mappings for delete
  using (seller_id = auth.uid());

create trigger pmm_set_updated_at
  before update on public.product_market_mappings
  for each row execute function public.touch_updated_at();
