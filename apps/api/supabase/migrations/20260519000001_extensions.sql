-- 20260519000001_extensions.sql
-- 출처: credential-vault.md §3.1 (pgcrypto 필수), platform.md §Supabase Postgres
-- 목적: 후속 마이그레이션이 의존하는 확장 활성화. 단일 책임.

create extension if not exists "pgcrypto";        -- gen_random_uuid, pgp_sym_*
create extension if not exists "citext";          -- 이메일 등 case-insensitive 컬럼 (auth.users 는 Supabase 가 별도 처리, 본 프로젝트는 reserved)

-- pg_cron 은 Supabase Cloud 기본 비활성. real 프로젝트에서 별도 활성 결정 후
-- 운영자가 dashboard 에서 ENABLE EXTENSION 수행. 본 마이그레이션은 활성화하지 않는다.
-- (markets.md §2.5 oauth_state 정리 cron / image-pipeline.md §11 변환본 GC 가 필요한 시점에 결정)

-- 모든 후속 마이그레이션이 public 스키마 default search_path 를 가정한다.
-- security definer 함수는 개별적으로 `set search_path = public` 명시.
