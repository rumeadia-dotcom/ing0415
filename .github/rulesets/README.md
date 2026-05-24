# Branch Protection Rulesets

GitHub Ruleset 백업. **GitHub Settings → Rules → Rulesets → New ruleset → "Import a ruleset"** 으로 복원한다.

## 파일

| 파일 | 대상 | 비고 |
|---|---|---|
| `develop.json` | `refs/heads/develop` | PR + 0 approval + thread resolution + 8 status checks + squash-only |

## 복원 절차

1. `https://github.com/rumeadia-dotcom/ing0415/settings/rules` 진입
2. **New branch ruleset** → 우측 점 3개 메뉴 → **Import a ruleset**
3. 본 디렉토리의 `*.json` 선택 → Save
4. Settings → Branches 에서 8개 status check 모두 required 인지 확인

## 변경 시 룰

CI 잡 (`name:`) 추가/이름 변경 시 본 JSON 의 `required_status_checks` 동기. PR 진입 게이트로 본 파일도 review 필수.

## approval 정책

`required_approving_review_count: 0` — 1인 셀러·1인 개발 모델 (CLAUDE.md MVP §제외) 가정. 팀 구성 후 1+ 로 상향 권장.

CI 8잡 + thread resolution + (필요 시) self-review 경로로 회귀 차단. 외부 리뷰는 squash 이후 release/* 단계에서 별도 트랙.

## 미포함

- main / release/* / hotfix/* — 필요 시 동일 패턴으로 추가
- bypass_actors — 비워둠 (admin 우회 금지). 긴급 hotfix 우회 필요 시 GitHub UI 에서 일회 추가 후 즉시 제거.
