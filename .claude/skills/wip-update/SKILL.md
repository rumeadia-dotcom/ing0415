---
name: wip-update
description: WIP 핸드오프 파일(docs/handoff/WIP-*.md) 을 최신 상태로 갱신하는 워크플로우. 사용자가 "WIP 최신화", "WIP 갱신", "핸드오프 갱신", "handoff 업데이트", "WIP 파일 갱신" 이라고 말하거나, feature/* 브랜치가 develop 로 머지된 직후·release/* 또는 hotfix/* 가 main 으로 머지된 직후·운영 배포 완료 직후·Phase 전환 시·외부 차단 항목이 해소된 시점에 자동으로 트리거할 것. 다음 세션이 짧은 진입 비용으로 작업을 이어받을 수 있도록 HEAD·테스트 카운트·운영 액션·남은 작업·후속 정합 백로그를 일관된 구조로 정리하는 단일 진입점.
---

# WIP 핸드오프 최신화 스킬

다음 세션이 짧은 비용으로 작업을 이어받도록 `docs/handoff/WIP-*.md` 를 갱신한다. **현재 상태의 스냅샷 + 다음 사람이 즉시 해야 할 일** 만 담는다 — 영구 룰·아키텍처 결정·코드 구조는 다른 곳이 ground truth.

---

## 파일 위치 / 명명

- **활성 파일**: `docs/handoff/WIP-<슬러그>.md` — 항상 **단일 활성 파일** 유지
- **아카이브**: 큰 마일스톤 전환 시 (예: v0.x → v0.x+1, 제품 범위 변경) 이전 파일을 `docs/handoff/archive/WIP-<날짜>.md` 로 이동하고 새 활성 파일을 만든다
- 슬러그는 현재 마일스톤·범위를 반영 (예: `WIP-5markets-mvp.md`, `WIP-v2-shipping.md`)
- 파일이 다음 마일스톤에 무의미해진 이름이면 이름 변경을 사용자에게 제안

## 언제 갱신하는가

### 자동 트리거 (스킬이 사용자에게 "WIP 갱신할까요?" 묻고 진행)

- `feature/*` 브랜치가 `develop` 로 머지된 직후
- `release/*` 또는 `hotfix/*` 가 `main` 으로 머지된 직후
- 운영 배포가 완료된 직후 (deploy.yml 성공 후)
- Phase 전환 (예: v0.x → v0.x+1, Stage X 완료)
- 외부 차단 항목이 해소된 시점

### 사용자 명시 (질문 생략, 즉시 수행)

- "WIP 최신화", "WIP 갱신", "핸드오프 갱신" 등 명시적 요청

---

## 무엇을 포함하는가

스킬이 실제로 정보를 수집할 때 다음 명령들을 사용해 ground truth 를 확인한다:

```bash
# HEAD + 테스트 카운트
git log --oneline origin/develop -1
git log --oneline origin/main -1
pnpm test --run 2>&1 | tail -3   # passed/failed/todo 카운트 발췌

# 최근 머지 / 변경 범위
git log --oneline origin/main..origin/develop | head -20
gh pr list --state merged --base develop --limit 10

# 운영 상태
gh run list --workflow=deploy.yml --limit=3
```

### 필수 섹션 (순서 고정)

1. **헤더** — develop HEAD 커밋 + 테스트 카운트, main HEAD 커밋 + 릴리즈 태그, 갱신 날짜
2. **스택 한눈에** — 프론트·백엔드·호스팅·모니터링·CI/CD·브랜치 전략·빌드모드. 변동 없으면 그대로 유지
3. **도메인 모델** — v1 / v2 ... ASCII 다이어그램. 새 도메인 추가 시 갱신
4. **완료된 작업 요약** — 표 형태. 단계 / 내용 / 커밋·PR 컬럼. 최신 항목은 굵게
5. **신규 마일스톤 상세** — 가장 최근 완료된 큰 작업의 내용 (페이지·Edge Function·마이그레이션·어댑터 등 카테고리별)
6. **운영 현황** — 배포 URL, 최근 deploy run 상태, 운영 DB 적용 상태
7. **⚠ 즉시 필요한 운영 액션** — 사용자가 수동으로 해야 하는 일 (Supabase Vault 시크릿, Edge Function env vars, DB 마이그 재실행 등). **번호 매김 + 정확한 명령·키 이름 명시**
8. **남은 작업** — 외부 차단 / 후속 정합 PR / 운영 게이트 / 출시 후 분리
9. **백로그** — v2+ 또는 다음 마일스톤 후보. 짧게
10. **다음 세션 진입** — 단일 커맨드 + 우선 순위 1·2·3
11. **(필요 시) 룰 강제 메모** — 최근 사고로 강제 적용된 룰 (예: "Git Flow base = develop")

## 무엇을 포함하지 않는가

다른 곳이 ground truth 인 정보는 WIP 에 복사하지 않는다 — drift 만 만든다.

| 내용 | Ground truth |
|---|---|
| 코드 구조·파일 경로 디테일 | `git ls-tree`, 코드 자체 |
| 머지된 PR 의 변경 내역 상세 | PR 본문, `git log` |
| 영구 룰·아키텍처 결정 | `CLAUDE.md`, `docs/architecture/v1\|v2/` |
| 디자인 토큰·컴포넌트 명세 | `docs/architecture/v1/ui-system.md` |
| 마켓 API 명세·자격증명 종류 | `docs/architecture/v1/cross-cutting/market-adapter.md` |

요약 / 링크만 남긴다. 풀 복붙 금지.

---

## 길이·톤

- **200-300줄 이하**. 초과 시 종료된 마일스톤 항목을 아카이브로 분리
- 액션 동사 우선: "Vault 시크릿 등록", "마이그레이션 재실행", "타입 정합 갱신". 설명·배경은 최소
- 표·코드블록 적극 활용해 스캔 가능하게
- "⚠" 이모지는 운영 액션·차단·강제 룰 메모 등 **즉시 주목 필요** 항목에만. 남발 금지
- 한국어 본문 + 영문 식별자 (브랜치명·커밋·파일경로) 혼용 — 기존 문서 톤 유지

## 커밋 메시지 컨벤션

```
docs(handoff): WIP 갱신 — <한 줄 요약>
```

예:
- `docs(handoff): WIP 갱신 — v0.2 main 배포 + 운영 액션 4건`
- `docs(handoff): WIP 갱신 — 시드 셀러 생성 완료 + Golden Path E2E 14 해제`
- `docs(handoff): WIP 최신화 — 운영 배포 + hotfix 3개 반영`

---

## 작업 절차

1. **사용자에게 트리거 확인** (자동 트리거인 경우만) — "WIP 갱신할까요?" 한 줄. 명시 요청이면 생략
2. **ground truth 수집** — 위 §"무엇을 포함하는가" 의 명령들 실행
3. **활성 WIP 파일 식별** — `ls docs/handoff/WIP-*.md` 로 확인. 여러 개면 사용자에게 어느 것이 활성인지 질문
4. **기존 WIP 읽기** — Read 도구로 전체. 변동 없는 섹션은 보존 (특히 §스택 한눈에, §도메인 모델, §백로그)
5. **갱신 작성** — Write 도구로 전체 재작성 (Edit 보다 Write 가 안전 — 섹션 순서·구조 강제). §무엇을 포함하는가 의 11 섹션 순서 따를 것
6. **길이 체크** — `wc -l` 로 200-300줄 범위 확인. 초과 시 아카이브 분리 제안
7. **사용자 검토** — "갱신 완료. 검토 후 커밋할까요?"
8. **커밋** — 사용자 승인 후 위 §커밋 메시지 컨벤션 따라 커밋. **Claude attribution 절대 금지** (`Co-Authored-By: Claude ...`, `🤖 Generated with Claude Code` 등 추가하지 말 것 — 전역 룰)

---

## 예시 패턴

### 운영 액션 섹션 (운영 배포 직후 갱신)

```markdown
## ⚠ 즉시 필요한 운영 액션 (사용자 작업)

### 1. Supabase Vault 시크릿 등록 (운영 프로젝트)
\`\`\`
supabase_functions_url = https://<project-ref>.supabase.co/functions/v1
service_role_key       = <Supabase service_role JWT>
\`\`\`
→ pg_cron 마이그레이션 재실행 가능해짐.

### 2. Edge Function env vars
\`\`\`
LOGEN_API_BASE_URL = https://openapi.ilogen.com
LOGEN_PGCRYPTO_KEY = <암호화 키>
\`\`\`
→ logen-* Edge Function 본 동작.

### 3. pg_cron 마이그레이션 재적용
Actions UI → "Deploy (real)" → workflow_dispatch → `apply_db_migrations=true` 재실행
```

### 룰 강제 메모 (사고 회수 시)

```markdown
### ⚠ Git Flow 룰 강제 (CLAUDE.md §Rules)
- 새 feature/* 브랜치는 **반드시 develop 에서 분기**. main 에서 분기 금지.
- Claude Code Agent 도구의 isolation: "worktree" 는 base 를 main 으로 잡으므로
  prompt 에서 `git checkout -B feature/X origin/develop` 강제.
- 과거 사고: PR #28~#37 가 main lineage 로 분기되어 cherry-pick 회수.
```

### 다음 세션 진입 (마지막 섹션)

```markdown
## 다음 세션 진입

\`\`\`bash
git pull origin develop && pnpm install && pnpm test
\`\`\`

**N passed** 확인 후 진입.

### 우선 순위
1. <가장 시급한 작업 — 외부 차단 해제 후 가능해진 것 또는 운영 액션 후속>
2. <두 번째 — 후속 정합 PR 또는 잔여 운영 게이트>
3. <세 번째 — 백로그 진입 가능한 첫 항목>
```

---

## 안티 패턴 (피할 것)

- **PR 본문 풀 복사** — 한 줄 요약 + PR 번호 링크만
- **변동 없는 섹션 매번 재작성** — Diff 노이즈만 생김. §스택·§도메인·§백로그 는 보존
- **종료된 마일스톤 항목을 끝까지 끌고 가기** — 아카이브 파일로 분리
- **"앞으로 할 일" 추상 나열** — 구체적 명령·파일경로·커밋·우선순위 없으면 다음 세션에 무용지물
- **새로 발견된 후속 작업을 별도 메모로만 남기기** — WIP 의 "남은 작업" 또는 "후속 정합 백로그" 에 즉시 추가
