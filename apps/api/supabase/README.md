# Supabase 마이그레이션 운영

Stage E 산출물. debug / real 두 Supabase 프로젝트에 **동일** 마이그레이션을 적용한다 (`platform.md` §프로젝트 분리, `CLAUDE.md` §빌드 모드).

## 디렉토리

```
supabase/
├─ config.toml          # CLI 설정 (project_id placeholder)
├─ migrations/          # 타임스탬프 순 SQL — 단일 소스
├─ functions/           # Edge Functions (Stage F 에서 구현)
└─ README.md
```

## 적용 절차

1. **CLI 설치**: `pnpm dlx supabase --version` (글로벌 설치 회피, `pnpm dlx` 권장).
2. **로컬 부트**: `pnpm dlx supabase start` (Docker 필요. 로컬 DB + Studio + Inbucket).
3. **link** (debug 와 real 각각 1회):
   ```bash
   pnpm dlx supabase link --project-ref <debug-ref> --password <db-pw>
   # 또는
   pnpm dlx supabase link --project-ref <real-ref>  --password <db-pw>
   ```
4. **마이그레이션 적용**:
   - 로컬: `pnpm dlx supabase db reset` (전체 재적용) 또는 `pnpm dlx supabase migration up`
   - 원격: `pnpm dlx supabase db push`
5. **drift 검증**: `pnpm dlx supabase db diff` — 양 프로젝트 적용 후 diff = empty 확인.

## 새 마이그레이션 추가 규약

- 파일명: `YYYYMMDDHHMMSS_<snake_case_name>.sql` (UTC 타임스탬프).
- 한 파일은 단일 도메인. 여러 도메인을 한 파일에 몰지 않는다.
- 기존 마이그레이션 **수정 금지** — 항상 새 마이그레이션 추가로 변경.
- 모든 사용자 데이터 테이블은 **RLS ENABLE + 정책 명시** 필수.
- 클라이언트 직접 접근 금지 테이블(`market_credentials` / `oauth_state` / `market_credentials_audit` / `market_account_audit` / `audit_log`)은 정책 0개 = service_role only.

## Realtime publication

다음 테이블이 `supabase_realtime` publication 에 등록되어 있어야 한다 (`20260519000003`, `20260519000006`):

- `public.market_accounts`
- `public.registration_jobs`
- `public.registration_job_market_results`

CLI 검증: `select * from pg_publication_tables where pubname = 'supabase_realtime';`

## Storage 버킷

`20260519000011_storage_buckets.sql` 가 다음 두 private 버킷을 생성:

- `product-images-original` (영구)
- `product-images-transformed` (90일 GC — `image-pipeline.md` §3.1)

RLS 정책은 `storage.objects` 위에 적용 (`image-pipeline.md` §3.3).

## 보안 검수 ground truth

- RLS: `security.md` §3, `credential-vault.md` §3.2, `registration-job-state.md` §3.4
- 토큰 암호화 RPC: `credential-vault.md` §4.3
- audit append-only trigger: `credential-vault.md` §10.2

마이그레이션이 위 문서와 byte-level 정합한지 PR 시 reviewer 가 확인한다.
