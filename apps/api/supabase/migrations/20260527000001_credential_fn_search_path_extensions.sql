----------------------------------------------------------------------
-- 자격증명 RPC 함수의 search_path 에 extensions 추가
--
-- 운영 사고 (2026-05-27, correlationId 39cffee6 / 요청 346cb344):
--   markets-connect 의 storeCredential 단계에서 RPC fn_encrypt_and_store_credential
--   이 PostgreSQL 42883 (undefined_function) 으로 실패 → vault_unavailable.
--
-- 근본 원인:
--   Supabase 클라우드는 pgcrypto 확장을 `extensions` 스키마에 설치한다
--   (pgp_sym_encrypt / pgp_sym_decrypt 가 extensions 에 위치). 그런데 자격증명
--   RPC 함수들은 `set search_path = public, pg_temp` 로 정의되어 extensions 가
--   빠져 있어, bare 호출한 pgp_sym_* 가 해결되지 않아 42883 이 난다.
--   (로컬/pgTAP 은 pgcrypto 가 public 에 있어 통과 → real 미검증으로 잠복.)
--
-- 수정:
--   대상 함수들의 search_path 에 `extensions` 를 추가한다. 본문 변경 없음
--   (ALTER FUNCTION ... SET). public 도 유지하므로 로컬(pgcrypto in public)·
--   클라우드(pgcrypto in extensions) 양쪽에서 모두 해결된다. 존재하지 않는
--   시그니처는 건너뛴다 (환경별 적용 차이에 안전).
--
-- 마스터: docs/architecture/v1/cross-cutting/credential-vault.md §4 / §5
----------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'fn_encrypt_and_store_credential',
        'fn_decrypt_credential',
        'fn_set_logen_credentials',
        'fn_get_logen_credentials'
      )
  loop
    execute format(
      'alter function %s set search_path = public, extensions, pg_temp',
      r.sig
    );
    raise notice 'search_path patched: %', r.sig;
  end loop;
end $$;
