-- 20260601000001_market_category_index.sql
-- 마켓 공통 카테고리 전역 인덱스 + 빌드 메타 (카테고리 추천 Phase 1).
-- 마스터: docs/superpowers/specs/2026-05-31-category-recommendation-design.md §4.1
-- 카테고리 트리는 셀러 무관 마켓 공통 → per-seller 아닌 전역 1벌. 읽기는 authenticated 전역 허용,
-- 쓰기 정책 없음 = service_role(Edge)만. pg_trgm 으로 path_text ILIKE 검색 가속.
create extension if not exists pg_trgm with schema extensions;

create table public.market_category_index (
  market_id   text not null,
  code        text not null,
  name        text not null,
  parent_code text,
  depth       int  not null,
  leaf        boolean not null,
  path_text   text not null,
  path_labels jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (market_id, code)
);

create index market_category_index_search_trgm
  on public.market_category_index using gin (path_text extensions.gin_trgm_ops);
create index market_category_index_leaf
  on public.market_category_index (market_id, leaf);

create table public.market_category_index_meta (
  market_id         text primary key,
  status            text not null,
  built_at          timestamptz,
  node_count        int,
  source_account_id uuid,
  error             text,
  updated_at        timestamptz not null default now()
);

alter table public.market_category_index enable row level security;
alter table public.market_category_index_meta enable row level security;

create policy market_category_index_select_all
  on public.market_category_index for select to authenticated using (true);
create policy market_category_index_meta_select_all
  on public.market_category_index_meta for select to authenticated using (true);
