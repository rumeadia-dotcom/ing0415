# Branch Protection Rulesets

GitHub Ruleset 백업. **GitHub Settings → Rules → Rulesets → New ruleset → "Import a ruleset"** 으로 복원한다.

## 파일

| 파일 | 대상 | 비고 |
|---|---|---|
| `develop.json` | `refs/heads/develop` | PR + 0 approval + thread resolution + 3 status checks (CI Gate 어그리게이터 + Lint & Typecheck + Unit) + squash-only |

## 복원 절차

1. `https://github.com/rumeadia-dotcom/ing0415/settings/rules` 진입
2. **New branch ruleset** → 우측 점 3개 메뉴 → **Import a ruleset**
3. 본 디렉토리의 `*.json` 선택 → Save
4. Settings → Branches 에서 3개 status check (CI Gate / Lint & Typecheck / Unit & Integration (Vitest)) 모두 required 인지 확인

## 변경 시 룰

CI 잡 (`name:`) 추가/이름 변경 시 본 JSON 의 `required_status_checks` 동기. PR 진입 게이트로 본 파일도 review 필수.

**required check 는 항상 실행되는 잡만 둔다.** `ci.yml` 의 무거운 잡(build / e2e / pgTAP)은 feature push·경로필터로 **skip 될 수 있어**, required 로 두면 strict 정책에서 영구 pending → 머지 영구 차단된다. 따라서 조건부 잡은 단일 **`CI Gate`** 잡(`if: always()`)이 result 를 집계하고, branch protection 은 CI Gate + 항상 실행되는 빠른 레인(Lint & Typecheck / Unit) 만 required 로 둔다 (ci-cd.md §11).

## approval 정책

`required_approving_review_count: 0` — 1인 셀러·1인 개발 모델 (CLAUDE.md MVP §제외) 가정. 팀 구성 후 1+ 로 상향 권장.

CI Gate(전체 잡 집계) + thread resolution + (필요 시) self-review 경로로 회귀 차단. 외부 리뷰는 squash 이후 release/* 단계에서 별도 트랙.

## 미포함

- main / release/* / hotfix/* — 필요 시 동일 패턴으로 추가
- bypass_actors — 비워둠 (admin 우회 금지). 긴급 hotfix 우회 필요 시 GitHub UI 에서 일회 추가 후 즉시 제거.
