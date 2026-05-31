---
name: overnight-autofix
description: 사용자가 자리에 없는(자는·외출) 동안 완전 자율로 버그를 검수→수정→테스트→develop 머지까지 수행하는 무인 워크플로우. 사용자가 "자는 동안 버그 고쳐놔", "밤새 검수 돌려놔", "자면서 검증 태워", "자율로 버그 잡고 develop 머지까지", "overnight 검수", "나 없는 동안 고쳐놔" 라고 말하거나, 사용자가 곧 자리를 비우며 장시간 무인 작업을 위임할 때 반드시 트리거할 것. 질문 없이 안전한 기본값으로 결정하고, 발견·수정·검증·머지 전 과정을 BUGLOG 로 남겨 아침 인계 리포트로 종료한다. main 운영 배포는 절대 하지 않는다.
---

# Overnight 자율 검수·수정·머지 스킬

사용자가 자리에 없는 동안, 지정된 플로우를 **반복 검수 → 근본원인 수정 → 테스트로 증명 → `develop` 머지**까지 완전 자율로 수행한다. 응답 가능한 사람이 없다는 게 이 스킬의 전제다 — 그래서 **질문하지 않고**, 결정은 "사용자 편의 우선 + 안전" 기준으로 직접 내리며, 모든 판단을 로그로 남겨 아침에 검증 가능하게 한다.

핵심은 **무인 안전성**이다. 운영(main) 노출·파괴적 작업·범위 폭주를 가드레일로 차단하고, 그 안에서 최대한 많은 진짜 버그를 잡는다.

---

## 언제 사용하는가

### 사용자 명시 (즉시 수행, 질문 없음)
- "자는 동안 버그 고쳐놔", "밤새 검수 돌려놔", "자면서 검증 태워"
- "나 없는 동안 고쳐놔", "자율로 잡고 develop 머지까지"
- "overnight 검수", "장시간 무인으로 돌려"

### 자동 트리거 (스킬이 범위를 확인하고 진행)
- 사용자가 "이제 잘게 / 나갔다 올게" 류로 자리를 비우며 작업을 위임
- 장시간(수 시간+) 무인 작업이 전제된 위임

---

## 시작 시: 범위 확정 (단 한 번의 확인)

사용자가 자리에 없으므로 **시작 직후 단 한 번만** 범위를 정리하고, 응답을 기다리지 않고 진행한다. 사용자가 이미 집중 플로우를 말했으면 그대로 채택한다.

1. **집중 플로우** — 사용자가 지정한 플로우. 미지정이면 전체를 한 번 훑되, 위험도 높은 핵심 플로우(상품 등록 위저드 / 주문현황·신규주문 / 로젠 등록 / 운송장 출력 / 송장 제출 완료 / 배송 이력)를 우선순위로 둔다.
2. **머지 권한** — 기본값: `develop` 까지 자율 머지. `main` 운영 배포는 금지 (§가드레일).
3. **작업 브랜치** — `feature/overnight-autofix-<YYYYMMDD>` 를 `develop` 기준으로 분기.

이 세 가지를 한 줄로 로그에 명시하고 바로 baseline 수집으로 넘어간다.

---

## 핵심 원칙

- **질문 금지.** 결정이 필요하면 "사용자 편의 우선 + 안전"으로 직접 내리고, 결정과 근거를 BUGLOG 에 남긴다. 응답을 기다리느라 멈추지 않는다.
- **근본원인부터** — `superpowers:systematic-debugging` 스킬로 진단. 증상 땜질 금지.
- **테스트로 증명** — `superpowers:test-driven-development` 로 버그마다 먼저 실패하는 테스트를 추가하고, 수정 후 통과를 확인한다. `superpowers:verification-before-completion` — "고쳤다"는 주장 전에 반드시 명령 실행 결과로 증명.
- **전수 조사 후 일괄 수정** — 수정이 닿는 모든 곳을 grep 으로 blast radius 부터 열거(CLAUDE.md §수정 작업 룰). 일부만 고치고 끝내지 않는다.
- **MCP 우선** — 스키마/RLS 는 `supabase-dev` MCP, 운영 영향은 `supabase-real`(read-only), 운영 에러 빈도는 `sentry` MCP 로 확인 (CLAUDE.md §MCP 적극 사용).
- **추측 금지** — 확신 없으면 코드·문서·테스트로 검증한 뒤 진행.

---

## 절차

### 1. Baseline 수집

라운드 시작 전 현재 상태를 고정한다. 무엇이 원래 깨져 있었고 무엇을 내가 깼는지 구분하기 위함이다.

```bash
git fetch origin && git checkout develop && git pull origin develop
git checkout -b feature/overnight-autofix-<YYYYMMDD>
```

```bash
pnpm typecheck ; pnpm lint ; pnpm test ; pnpm test:e2e
```

- 실패·경고·flaky 를 전부 BUGLOG 에 기록. flaky(같은 코드인데 재실행 시 결과 다름)는 "baseline flaky"로 표기해 내 수정 탓으로 오인하지 않는다.
- Sentry MCP 로 운영 에러 빈도 상위 이슈를 조회해 **실제 발생 중인 버그**를 우선순위 상단으로 끌어올린다.

> ⚠ **원격 Playwright MCP 는 localhost 에 접근 불가.** dev 서버 UI 를 브라우저로 직접 검증할 수 없다. UI 검증은 단위/E2E 테스트와 코드 정독으로 한다 (CLAUDE.md §dev-preview 제약).

### 2. 검수 라운드 (집중 플로우별)

집중 플로우마다 다음을 교차 대조해 정합성이 깨진 곳을 찾는다:

- `apps/web/src/features/<domain>/` 구현 ↔ zod 스키마(`apps/web/src/lib/schemas/`) ↔ Edge Function(`apps/api/supabase/functions/`) ↔ 마켓/택배 어댑터 ↔ `locales/ko.ts`
- 설계문서(`docs/architecture/v1/features/`, `docs/design-renewal/s{N}-*.md`)와 구현의 어긋남
- **행복경로뿐 아니라** 실패·부분실패(partial)·토큰 만료·빈 상태(empty)·로딩/에러 4상태 경로 (CLAUDE.md §4상태 + partial 처리)

운영 사고성 버그는 CLAUDE.md §운영 사고 진단의 6단계 chain(서버 throw → 직렬화 → 클라 parse → 스키마 → UI 매핑 → 인프라)을 **한 번에** 훑어 가설 목록부터 세운다. 한 단계씩 점진 진단 금지.

### 3. 버그별 수정 사이클

각 버그에 대해:

1. BUGLOG 항목 생성: `{플로우, 증상, 근본원인, 영향파일, 심각도}`
2. 실패하는 테스트 추가 (재현)
3. blast radius grep → 최소 수정으로 일괄 처리
4. `pnpm typecheck && pnpm lint && pnpm test` green 확인 (관련 e2e 도)
5. 논리 단위로 커밋 — `git-commit` 스킬 사용, 메시지 한국어
6. BUGLOG 에 `{수정, 검증결과}` 채움

### 4. 라운드 반복

한 라운드가 끝나면 집중 플로우 전체를 **다시** 훑어 회귀/누락을 점검한다. 새 버그가 더 안 나오거나 명백히 수렴하면 마무리로 넘어간다. 작업량이 많아도 괜찮다 — 수렴이 기준이지 시간이 기준이 아니다.

---

## 마무리 → develop 머지

### 5. 전체 게이트

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e
```

골든패스(`tests/e2e/golden-path.spec.ts`) 포함 전부 green 이어야 한다. **`test.skip/fixme/only` 로 우회 금지** (CLAUDE.md §테스트 디시플린).

### 6. WIP 갱신 + 동기화 sweep

- `wip-update` 스킬로 활성 WIP(`docs/handoff/WIP-*.md`) 갱신 — 고친 버그·검증 결과·남은 작업·막힌 지점 반영. feature 브랜치 위에서 갱신해 **같은 PR 에 포함**(머지 후 별도 WIP PR 방지).
- BUGLOG sweep 으로 설계문서 동기화(CLAUDE.md §2개 산출물 동기화) 반영 후 최종 커밋.

### 7. develop 머지 (자율 — 끝까지 수행)

```bash
git push -u origin feature/overnight-autofix-<YYYYMMDD>
gh pr create --base develop --head feature/overnight-autofix-<YYYYMMDD> \
  --title "fix(overnight): <한 줄 요약 — N건 버그 수정>" --body-file /tmp/pr-overnight-body.md
```

required check 3개(**CI Gate** / Lint & Typecheck / Unit & Integration)를 `Monitor` 도구로 polling(30초 간격, 동기 sleep 금지):

```bash
prev=""
while true; do
  state=$(gh pr view <N> --json state,statusCheckRollup 2>/dev/null)
  s=$(jq -r '.state' <<<"$state")
  [ "$s" = "MERGED" ] && { echo "MERGED"; break; }
  [ "$s" = "CLOSED" ] && { echo "CLOSED"; break; }
  failed=$(jq -r '[.statusCheckRollup[]? | select(.conclusion=="FAILURE") | .name] | join(",")' <<<"$state")
  [ -n "$failed" ] && { echo "FAILED: $failed"; break; }
  cur=$(jq -r '[.statusCheckRollup[]? | "\(.name): \(.conclusion//.status)"] | sort | unique | join(" | ")' <<<"$state")
  [ "$cur" != "$prev" ] && { echo "checks: $cur"; prev=$cur; }
  sleep 30
done
```

머지 판단:
- **전부 green** → `gh pr merge <N> --squash --delete-branch` 로 자율 머지. (develop 은 운영이 아니므로 사용자 승인 불필요.)
- **flaky/인프라성 실패**(로컬 게이트는 green인데 CI만 실패) → `gh run rerun <run-id> --failed` 로 재실행 시도.
- **코드 결함으로 실패** → 머지하지 말고 원인 수정 → 재push → 다시 green 확인. green 전엔 절대 머지 금지.
- **끝내 green 불가** → PR 을 open 으로 남기고, 막힌 지점을 WIP·BUGLOG·PR 코멘트에 정확히 기록.

머지 후:
```bash
git fetch --prune origin && git checkout develop && git pull origin develop
```

---

## 가드레일 (절대 하지 않는 것)

- **`main` 운영 배포 금지.** `develop` 까지만. main 머지·태그·deploy.yml 수동 트리거 전부 금지 — 무인 중 운영 사고 방지.
- **운영(real) DB write 금지.** `supabase-real` 은 read-only. INSERT/UPDATE/DELETE 시도 금지.
- **시크릿 변경 / Edge Function env vars 변경 금지.**
- **파괴적 git 작업 금지** — `push --force`, `reset --hard`, 파일 대량 삭제, 브랜치 강제 삭제. 확신 없으면 하지 않는다.
- **범위 밖 대규모 리팩터·기능 추가 금지.** 버그 수정에 집중. 큰 리팩터가 필요해 보이면 수정하지 말고 BUGLOG 에 "후속 제안"으로만 기록.
- **골든패스/테스트 우회 금지** — skip/fixme/only.

가드레일에 막혀 진행 불가한 항목은 멈추지 말고 BUGLOG 에 "아침 인계 필요"로 적고 다음 버그로 넘어간다.

---

## 아침 인계 리포트 (종료 시 마지막 메시지)

사용자가 일어나 한눈에 파악하도록 마지막 메시지를 다음 형식으로 정리한다:

```markdown
## 🌙 Overnight 검수 결과 (<날짜>)

### 머지 결과
- PR #N → develop **머지 완료** (또는 open — 사유)
- HEAD: <develop 최신 커밋>

### 고친 버그 (N건)
| # | 플로우 | 증상 | 근본원인 | 수정 | 심각도 |
|---|--------|------|----------|------|--------|
| 1 | 상품등록 | ... | ... | ... | high |

### 검증 결과
- typecheck/lint/test/build/e2e: ✅ 전부 green (또는 실패 항목)
- baseline 대비 추가/해소된 flaky

### 남은 이슈 / 아침 인계 필요
- 가드레일에 막힌 항목, 못 뚫은 CI, 후속 리팩터 제안
```

BUGLOG 전문은 WIP 파일에 남기고, 리포트는 요약만.

---

## 비포함 (다른 곳 ground truth)

| 내용 | Ground truth |
|---|---|
| 빌드/테스트/Lint 명령 | `CLAUDE.md §빌드 / 테스트 / Lint 명령` |
| Git Flow·머지 룰 | `CLAUDE.md §Rules` + `docs/architecture/v1/ops/ci-cd.md` |
| 운영 릴리즈(main 배포) 절차 | `release-deploy` 스킬 — **이 스킬 범위 밖** |
| WIP 갱신 형식 | `wip-update` 스킬 |
| 디버깅·TDD·검증 방법론 | `superpowers:systematic-debugging` / `test-driven-development` / `verification-before-completion` |
| 운영 사고 6단계 진단 chain | `CLAUDE.md §운영 사고 진단` |
| MCP 도구 매핑 | `CLAUDE.md §MCP 적극 사용` |

---

## 결과물

이 스킬이 끝나면:

- ✅ 집중 플로우 반복 검수 + 발견 버그 근본원인 수정 (테스트로 증명)
- ✅ 전체 게이트 green + WIP 갱신 + 설계문서 동기화
- ✅ `feature/overnight-autofix-<날짜>` → `develop` 머지 완료 (또는 사유와 함께 open)
- ✅ 아침 인계 리포트 출력
- 🚫 main 운영 배포·운영 DB write·파괴적 작업은 일절 수행하지 않음
