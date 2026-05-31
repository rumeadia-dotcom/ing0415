-- 최근 사용 카테고리 RPC — s3 상품등록 3단계 "최근 사용" 칩.
--   셀러가 과거 등록(product_market_mappings)에서 고른 마켓별 카테고리를 최신순 6개.
--   market_category_index 와 left join 해 라벨/경로를 채움(인덱스 미적재 시 코드 fallback).
--   security invoker + auth.uid() 격리 (get_registration_job 스타일 — RLS 그대로 적용).
--   마스터: docs/architecture/v1/features/category-sync.md §6 / specs/2026-05-31-category-recommendation-design.md
create or replace function public.get_recent_categories(p_market_id text)
returns jsonb language sql security invoker stable as $$
  with recent as (
    select distinct on (pmm.market_category_code)
      pmm.market_category_code as code, pmm.created_at
    from public.product_market_mappings pmm
    where pmm.seller_id = auth.uid()
      and pmm.market_id = p_market_id
      and pmm.market_category_code <> ''
    order by pmm.market_category_code, pmm.created_at desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', r.code,
        'name', coalesce(idx.name, r.code),
        'pathText', coalesce(idx.path_text, r.code),
        'pathLabels', coalesce(idx.path_labels, jsonb_build_array(r.code))
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  from (select * from recent order by created_at desc limit 6) r
  left join public.market_category_index idx
    on idx.market_id = p_market_id and idx.code = r.code;
$$;

grant execute on function public.get_recent_categories(text) to authenticated;
