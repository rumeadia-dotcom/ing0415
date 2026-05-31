-----------------------------------------------------------------------
-- product_images UNIQUE 완화: (seller_id, sha256) → (product_id, sha256)
--
-- 배경 (2026-05-31 운영 사고):
--   상품 이미지 업로드 시 image-register 가 409 duplicate_image 로 차단.
--   기존 UNIQUE (seller_id, sha256) = "동일 셀러 동일 파일 전역 차단" 이라
--   셀러가 같은 이미지(로고·공통 대표컷)를 다른 상품에 재사용하거나, 이전
--   등록 시도/재시도 후 같은 파일을 다시 올리면 영구 거부됐다.
--   image-pipeline.md §6 주석은 sha256 을 "멱등성 키" 로 명시했으나 구현은
--   차단이었음(의도 불일치).
--
-- 변경:
--   - drop  UNIQUE (seller_id, sha256)  — 전역 차단 제거
--   - add   UNIQUE (product_id, sha256) — 같은 상품 내 동일 파일 중복만 차단
--   - keep  UNIQUE (product_id, position) — 같은 상품 같은 위치 중복 차단(불변)
--
-- 멱등성은 image-register Edge 가 23505 충돌 시 기존 row 를 반환하는 것으로 보강.
--
-- 데이터 안전: 기존 (seller_id, sha256) UNIQUE 하에선 셀러당 sha256 이 유일했으므로
--   product 당으로도 유일 → (product_id, sha256) add 시 중복 없음.
--
-- 마스터: docs/architecture/v1/cross-cutting/image-pipeline.md §6
-----------------------------------------------------------------------

alter table public.product_images
  drop constraint if exists product_images_seller_id_sha256_key;

alter table public.product_images
  add constraint product_images_product_id_sha256_key unique (product_id, sha256);
