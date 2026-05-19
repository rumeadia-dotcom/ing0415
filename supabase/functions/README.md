# Supabase Edge Functions

Stage F 에서 구현 예정. 본 디렉토리는 placeholder.

예정된 함수 (설계문서 인용):

- `auth-event-log` — `features/auth.md` §5.5
- `markets-oauth-start` / `markets-oauth-callback` / `markets-token-refresh` / `markets-disconnect` / `markets-verify` — `features/markets.md` §5
- `image-upload-url` / `image-register` / `image-transform` — `cross-cutting/image-pipeline.md` §5 ~ §7
- `registration-validate` / `registration-start` / `registration-market-worker` / `registration-retry` / `registration-cancel` — `features/registration.md` §6
- `track-session-start` — `ops/kpi.md` §3.3

각 함수는 본 디렉토리 하위 `<function-name>/index.ts` 로 생성. 공유 유틸은 `_shared/`.
