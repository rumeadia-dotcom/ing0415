---
name: release-deploy
description: feature → develop → release/vX.Y → main 운영 배포까지의 Git Flow 릴리즈 절차. 사용자가 "release", "릴리즈 진행", "main 배포", "운영 배포", "main 까지 머지", "release/ 브랜치 만들어", "릴리즈 PR" 이라고 말하거나, develop 의 누적 변경을 운영(`main`) 으로 내보낼 시점에 자동으로 트리거할 것. 릴리즈 PR 생성부터 main 머지·deploy.yml 완료·main → develop 백머지·stale 브랜치 정리까지 전 구간을 사용자 승인 게이트와 함께 진행하여 운영 사고를 방지하는 단일 진입점.
---

# 운영 릴리즈 배포 스킬

`develop` 의 누적 변경을 `release/vX.Y` 로 분기하여 `main` 으로 squash 머지 → GitHub Pages + Edge Functions + Sentry 운영 배포까지의 흐름을 사용자 승인 게이트와 함께 순차 수행한다.

이 스킬의 핵심은 **운영 사고 방지**다. main 머지 = 운영 노출이므로 사용자 명시 승인 없이 진행하지 않는다. 부수 룰 (branch protection 컨텍스트 정합, squash 가 deletion 을 누락하는 케이스, attribution 금지 등) 은 §트러블슈팅 / §핵심 룰 에 적힌 대로 일관 적용.

---

## 언제 사용하는가

### 사용자 명시 (즉시 수행)
- "release/ 브랜치 만들어", "release/vX.Y 진행"
- "main 까지 배포", "운영 배포", "main 머지"
- "릴리즈 PR 생성", "릴리즈 진행"

### 자동 트리거 (스킬이 "릴리즈 진행할까요?" 묻고 진행)
- `develop` 에 누적된 PR 이 3건 이상이고 마지막 release 이후 1주 이상 경과
- 운영 hotfix 가 develop 에만 있고 main 에 미반영
- 사용자가 "v0.X+1", "v1.0", "릴리즈 사이클" 등을 언급
- WIP 핸드오프 문서에 "운영 배포 완료" 가 다음 우선 순위로 표기됨

---

## 전제 조건 (시작 전 확인)

```bash
# 1. develop 이 main 보다 앞서 있는가 (앞서지 않으면 릴리즈할 게 없음)
git log origin/main..origin/develop --oneline | head -10

# 2. 현재 release/* 브랜치가 이미 존재하는가 (중복 릴리즈 방지)
git ls-remote --heads origin "release/*"

# 3. 직전 release 버전 확인 (다음 버전 결정용)
git log origin/main --oneline | grep -iE "release[/:]?v[0-9]+\.[0-9]+" | head -3
git tag -l | sort -V | tail -3

# 4. 운영 hotfix 미백머지 잔재 점검
gh pr list --state merged --base main --limit 5 --json number,title,mergedAt --jq '.[]'
```

다음 중 하나라도 해당하면 사용자에게 알리고 결정 받는다:
- develop 이 main 과 동일 (변경 없음) → 릴리즈 불가, 종료
- 다른 release/* 가 이미 열려 있음 → 그쪽 먼저 정리 권유
- 직전 릴리즈가 24시간 이내 → 정말 새 릴리즈인지 재확인

---

## 버전 결정

태그 자동 생성은 **하지 않는다**. 브랜치명 만 결정.

- 직전 = `release/v0.4` (또는 main 의 머지 커밋 메시지에서 추출) → 신규 = `release/v0.5`
- 직전이 없으면 `release/v0.1` 부터 시작
- 패치성 작은 변경은 마이너 (`v0.5` → `v0.5.1`) 가 아니라 다음 마이너 (`v0.6`) 로 간다 — 본 프로젝트 관례 (시점 2026-05-22). 사용자가 명시적으로 patch 원하면 따른다.

---

## 절차

### 1. feature PR 우선 정리 (있을 경우)

릴리즈 시작 전에 develop 에 들어가야 할 feature/hotfix PR 이 있는지 확인하고, 그것들이 모두 머지된 뒤에 release 시작.

```bash
gh pr list --state open --base develop --limit 10
```

미머지 PR 이 릴리즈 범위에 포함되어야 하는지 사용자에게 확인. 포함이면 그 PR 부터 머지.

### 2. develop 동기화

```bash
git fetch origin
git checkout develop
git pull origin develop
```

### 3. release 브랜치 생성

```bash
git checkout -b release/vX.Y
git push -u origin release/vX.Y
```

### 4. release PR 생성 (release/vX.Y → main)

PR body 는 다음 4 섹션:

```markdown
## Summary
v0.X — <한 줄 요약>. 직전 (`release/v0.X-1` → main) 이후 develop 누적 변경분을 운영(main) 으로 배포.

## 포함된 변경 (v0.X-1 이후)
- **PR #N** `<type>(<scope>)` — <한 줄 설명>
- ...

## 운영 배포 영향
- deploy.yml 자동 트리거 항목 (GitHub Pages / Edge Functions / Sentry release)
- DB 마이그레이션 변경 여부 (변경 없으면 명시 "변경 없음")
- 시크릿 변경 여부

## CI 게이트
- Lint & Typecheck / Unit / Build (dev) / Build (real) / E2E Golden Path / E2E a11y / Zod Mirror 7개 통과 필수

## Post-merge
- main → develop 백머지 chore commit
- WIP 갱신
```

```bash
gh pr create --base main --head release/vX.Y --title "release: vX.Y — <한 줄 요약>" --body-file /tmp/pr-release-body.md
```

### 5. main 머지 충돌 해소 (필요 시)

release PR 이 CONFLICTING 상태면 즉석 해소:

```bash
git fetch origin
git checkout release/vX.Y
git merge origin/main --no-edit
# 충돌 파일 수동 해소 (보통 1~2 파일, 예: Sidebar.tsx 의 import 줄)
git add <resolved-files>
git commit --no-edit
git push origin release/vX.Y
```

CI 가 다시 돈다 (push 1번 = CI 1번). 의도된 동작.

### 6. CI 통과 대기 (Monitor 가동)

```bash
# Monitor 도구로 백그라운드 polling. CI 완료 시 자동 알림.
# 매 30초 폴링, 새 변화만 emit, 종결 상태 (MERGED / FAILED / CLOSED) 에서 종료.
```

`Monitor` 도구 명령 예:

```bash
prev=""
while true; do
  state=$(gh pr view <N> --json state,mergeStateStatus,statusCheckRollup 2>/dev/null)
  s=$(jq -r '.state' <<<"$state")
  if [ "$s" = "MERGED" ]; then echo "MERGED"; break; fi
  if [ "$s" = "CLOSED" ]; then echo "CLOSED"; break; fi
  failed=$(jq -r '[.statusCheckRollup[]? | select(.conclusion=="FAILURE") | .name] | join(",")' <<<"$state")
  if [ -n "$failed" ]; then echo "FAILED: $failed"; break; fi
  cur=$(jq -r '[.statusCheckRollup[]? | "\(.name): \(.conclusion//.status)"] | sort | unique | join(" | ")' <<<"$state")
  if [ "$cur" != "$prev" ]; then echo "checks: $cur"; prev=$cur; fi
  sleep 30
done
```

이유: `gh pr checks --watch` 은 timeout 가능, 동기 polling 은 컨텍스트 낭비. Monitor 는 이벤트 기반.

### 7. ⚠ main 머지 = 운영 배포 — 사용자 명시 승인

CI 7개 전부 SUCCESS 가 떴어도 자동 머지하지 않는다. **사용자에게 명시 승인 요청** 후 진행:

> "PR #N CI 7개 전부 SUCCESS. 머지 진행 시 deploy.yml 자동 트리거 → GitHub Pages + Edge Functions 운영 배포. 진행할까요?"

사용자가 "진행" / "머지해" / "OK" 등 명시 응답 시에만:

```bash
gh pr merge <N> --squash
```

auto mode classifier 가 production 작업을 차단할 수 있으므로, 차단 시 사용자에게 안내 + 사용자가 직접 머지 또는 별도 승인.

### 8. deploy.yml 완료 대기

main 머지 직후 `deploy.yml` 워크플로우가 자동 실행. 4잡:
- **Build (real mode)** — vite build :real
- **Deploy to GitHub Pages** — `pages-deploy@v4`
- **Deploy Supabase Edge Functions** — `supabase functions deploy`
- **Finalize Sentry release** — sourcemap 업로드 + release commit

Monitor 로 polling:

```bash
RUN=$(gh run list --workflow=deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId')
# 위 Monitor 와 동일 패턴으로 status==completed 까지 polling
```

실패 시 즉시 사용자에게 알리고 deploy 잡별 로그 확인.

### 9. main → develop 백머지

main 의 squash commit 을 develop 으로 동기화. 별 브랜치로 진행:

```bash
git fetch origin
git checkout develop
git pull origin develop
git checkout -b chore/backmerge-vX.Y
git merge origin/main --no-edit
```

**충돌 가능 — 보통 Sidebar.tsx / router.tsx 등 main 과 develop 양쪽에서 수정한 파일.** 해소 후 commit.

### 10. orphan 파일 가드 (중요)

squash 머지가 deletion 을 누락하는 경우가 있다. **실제 사례**: 본 프로젝트 PR #80 squash 가 `apps/web/src/app/guards/{RequireMarket,RequireLogen}.tsx` 의 deletion 을 main 에 적용하지 않았다. router 의 import 와 사용은 제거되었지만 파일 자체가 main 에 orphan 으로 잔존.

백머지 브랜치에서 develop 의 deletion 상태를 보존하기 위해 명시 `git rm`:

```bash
# main 에는 있지만 develop 에서는 삭제된 파일 탐지
git diff --name-status origin/main origin/develop | grep "^D" | awk '{print $2}'

# 누락된 deletion 을 명시 적용
git rm <orphan-files>
git commit --amend --no-edit
```

이 단계는 **모든 백머지에서 점검 의무**. 누락 시 develop 가 오염되어 다음 release 가 또 같은 파일을 가져온다.

### 11. 백머지 PR

```bash
gh pr create --base develop --head chore/backmerge-vX.Y \
  --title "chore: main → develop 백머지 (vX.Y + orphan 정리)" \
  --body-file /tmp/pr-backmerge-body.md
gh pr merge <N> --squash --auto --delete-branch
```

`--auto` 로 CI 통과 시 자동 머지. `--delete-branch` 로 머지 후 리모트 정리.

### 12. stale 브랜치 정리

```bash
git fetch --prune origin           # 머지로 삭제된 리모트 ref 동기화
git checkout develop
git pull origin develop
# 로컬 stale 정리 (release/vX.Y, chore/backmerge-vX.Y, feature/* 등)
git branch -D release/vX.Y chore/backmerge-vX.Y feature/<해당-feature>
```

---

## 핵심 룰

### 사용자 승인 게이트

- **main 머지 (= 운영 배포 트리거) 는 절대 자동 진행 X.** CI 통과 후에도 사용자 명시 응답 필요.
- auto mode classifier 가 main 머지를 차단할 수 있다. 차단 시 우회하지 말고 사용자 안내.
- deploy.yml 실패는 즉시 사용자 통지 + 잡별 로그 확인.

### branch protection 컨텍스트 정합

CI 워크플로우의 잡 이름과 branch protection 의 `required_status_checks` 가 어긋나면 영원히 BLOCKED. 예: `Build (debug)` → `Build (dev)` rename 후 protection 미갱신.

```bash
# 현재 protection 확인
gh api repos/<owner>/<repo>/branches/develop/protection/required_status_checks --jq '.contexts'
gh api repos/<owner>/<repo>/branches/main/protection/required_status_checks --jq '.contexts'

# 갱신 (PUT)
gh api -X PUT repos/<owner>/<repo>/branches/<branch>/protection/required_status_checks/contexts \
  -f 'contexts[]=Lint & Typecheck' \
  -f 'contexts[]=Unit & Integration (Vitest)' \
  -f 'contexts[]=Build (dev)' \
  -f 'contexts[]=Build (real)' \
  -f 'contexts[]=E2E Golden Path (Chromium)'
```

protection 변경은 거버넌스 변경 — auto mode classifier 가 차단 가능. 명시 승인 요청.

### Monitor 활용

CI / deploy 상태 polling 은 동기 sleep 루프 대신 `Monitor` 도구로 백그라운드 이벤트화. timeout 1800s (30분) 권장. 30초 폴링 간격으로 API rate limit 회피.

### Claude attribution 금지

전역 룰 (`~/.claude/CLAUDE.md`). 커밋 메시지에 `Co-Authored-By: Claude ...` / `🤖 Generated with Claude Code` 절대 포함 금지. 본 스킬의 모든 commit / PR body 에 일관 적용.

### Squash 머지 함정

PR 충돌 해소를 위해 main 을 release 브랜치로 머지하면 squash 가 그 머지 commit 의 일부 변경 (특히 deletion) 을 누락할 수 있다. §10 의 orphan 가드는 **선택이 아니라 의무**.

---

## 트러블슈팅

### PR mergeStateStatus = BLOCKED 인데 CI 는 SUCCESS

원인 후보:
1. branch protection 컨텍스트 이름이 CI 잡 이름과 mismatch → §핵심 룰 의 protection 갱신
2. 필수 리뷰 (`required_pull_request_reviews`) 미충족 → 1인 운영 가정에선 0
3. linear history 위반 (rebase 필요) → `gh pr update-branch <N>`
4. up-to-date 가 strict → 위와 동일

진단:
```bash
gh pr view <N> --json mergeable,mergeStateStatus,reviewDecision
gh api repos/<owner>/<repo>/branches/<branch>/protection
```

### deploy.yml 실패

잡별 원인 분기:
- **Build (real mode)** 실패 → 환경변수 누락 또는 vite build 회귀. PR 의 Build (real) 가 통과했으므로 보통 시크릿 누락 (예: `REAL_SUPABASE_*` 변경)
- **Deploy to GitHub Pages** 실패 → pages 권한 / artifact 누락
- **Deploy Supabase Edge Functions** 실패 → 네트워크 (회사 네트워크가 Supabase API 차단), CLI 버전 (`supabase` 2.101+ 권장), `--use-api` 플래그
- **Finalize Sentry release** 실패 → SENTRY_AUTH_TOKEN 만료, 보통 비차단 (release 만 못 만듦)

### 백머지 시 충돌 폭증

main 이 release/vX.Y 와 크게 다른 파일을 동시 수정한 경우. 보통 hotfix 가 main 에만 들어가고 develop 에 백머지 안 된 상태가 누적되면 발생. 사전 점검 (§전제 조건 #4) 으로 회피.

심한 경우 백머지를 단순화: `git checkout chore/backmerge-vX.Y && git reset --hard origin/main` 후 develop 의 누락 변경만 cherry-pick. 단 이때 develop 의 모든 변경을 main 으로 반영해야 하므로 사용자와 영향 확인.

---

## 비포함 (다른 곳 ground truth)

요약·링크만 남기고 풀 복붙 X.

| 내용 | Ground truth |
|---|---|
| 빌드 / 테스트 / Lint 명령 | `CLAUDE.md §빌드 / 테스트 / Lint 명령` |
| Git Flow 룰 (브랜치 base 강제 등) | `CLAUDE.md §Rules` |
| CI 워크플로우 매트릭스 | `docs/architecture/v1/ops/ci-cd.md` |
| 빌드 모드 (dev/real + useMock) | `CLAUDE.md §빌드 모드` |
| 운영 시크릿·환경변수 | `docs/handoff/WIP-*.md §⚠즉시 필요한 운영 액션` |
| pgcrypto / Vault 시크릿 | `docs/architecture/v1/cross-cutting/credential-vault.md` |
| Sentry 마스킹 | `docs/architecture/v1/security.md §6.2 / §6.3` |

---

## 결과물

이 스킬이 끝나면 다음 상태:

- ✅ `release/vX.Y` 브랜치 main 머지 완료 + 리모트 삭제
- ✅ `chore/backmerge-vX.Y` develop 머지 완료 + 리모트 삭제
- ✅ deploy.yml 4잡 success
- ✅ 로컬 stale 브랜치 정리
- 🔄 다음 단계: `wip-update` 스킬로 WIP 핸드오프 갱신 권유 (자동 트리거)

전체 단계가 사용자 승인 게이트 (§7) + 부수 점검 (§10 orphan 가드, §11 branch protection 정합) 을 통과한 상태로 종료.
