-- 20260519000011_storage_buckets.sql
-- 출처: cross-cutting/image-pipeline.md §3 (버킷 구조 + RLS)
-- 목적: product-images-original / product-images-transformed 두 private 버킷 + storage.objects RLS.

----------------------------------------------------------------------
-- 1. 버킷 생성 (private, public 노출 금지)
----------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images-original', 'product-images-original', false,
   10485760,                                              -- 10MB
   array['image/jpeg','image/png','image/webp']),
  ('product-images-transformed', 'product-images-transformed', false,
   10485760,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

----------------------------------------------------------------------
-- 2. storage.objects RLS (image-pipeline.md §3.3)
--    경로 규약: <sellerId>/<productId>/... → (storage.foldername(name))[1] = auth.uid()
----------------------------------------------------------------------

-- 원본 버킷: 셀러는 본인 prefix 만 SELECT / INSERT / DELETE
create policy "original_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'product-images-original'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "original_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images-original'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "original_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images-original'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 원본은 immutable. UPDATE 정책 부재 → 덮어쓰기 금지 (멱등성).

-- 변환본 버킷: 셀러는 SELECT 만. INSERT/UPDATE/DELETE 는 service_role 만 (image-transform Edge Function).
create policy "transformed_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'product-images-transformed'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT/UPDATE/DELETE 정책 부재 → authenticated 거부. service_role 만 변환본 작성.

----------------------------------------------------------------------
-- 3. 참고 코멘트
----------------------------------------------------------------------
-- NOTE: `COMMENT ON POLICY ... ON storage.objects` 는 Supabase 관리형 storage 의
-- supabase_storage_admin 만 가능하므로 제거. 정책 의도는 image-pipeline.md §3.3 참조.
