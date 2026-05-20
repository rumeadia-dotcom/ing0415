---
name: parallel-pr-automation
description: AI를 이용해 여러 PR을 병렬로 자동 생성하고 관리하는 워크플로우. "PR 자동화", "병렬 PR", "PR 여러개 동시에", "Claude Code로 PR 돌리기", "worktree로 병렬 작업", "에이전트 병렬 실행", "자동으로 PR 만들기", "PR 배치 처리" 등의 요청이 있을 때 반드시 사용할 것.
---

# Parallel PR Automation 스킬

AI(Claude Code)를 이용해 여러 PR을 병렬로 자동 생성하는 워크플로우를 설명하고 설정을 도와주는 스킬.

---

## 전체 개념

```
작업 목록 N개 준비
    ↓
Git Worktree N개 생성 (브랜치 자동 분리)
    ↓
Claude Code 에이전트 N개가 동시에 각 작업 처리
    ↓
각각 PR 자동 생성
    ↓
사람은 PR 리뷰만
```

사람이 개입하는 지점은 **작업 목록 작성**과 **PR 리뷰** 두 곳뿐.

---

## 방식 1: Git Worktree + 병렬 에이전트 (로컬)

### 핵심 개념: Git Worktree란?

같은 레포를 여러 디렉토리에 동시에 체크아웃하는 기능.  
`.git` 데이터베이스는 공유하지만, 파일 시스템은 완전히 분리됨.  
→ 에이전트끼리 파일 충돌 없이 독립적으로 작업 가능.

### 설정 방법

```bash
# worktree 생성 (각 작업마다)
git worktree add .claude/worktrees/feat-login feature/login
git worktree add .claude/worktrees/feat-payment feature/payment
git worktree add .claude/worktrees/fix-auth bugfix/auth-timeout

# 각 worktree에서 Claude Code 실행
cd .claude/worktrees/feat-login && claude
cd .claude/worktrees/feat-payment && claude
cd .claude/worktrees/fix-auth && claude
```

### Claude Code 명령어

```bash
# worktree 이름 지정해서 자동 생성
claude --worktree feat-login

# 에이전트가 작업 완료 후 PR 생성 요청
> 이 변경사항으로 PR 만들어줘
```

### 진행 상황 확인

```bash
# 활성 worktree 목록 확인
git worktree list

# 특정 worktree diff 확인
cd .claude/worktrees/feat-login
git diff main
```

### 정리

```bash
# worktree 제거 (작업 완료 후)
git worktree remove .claude/worktrees/feat-login

# stale worktree 정리
git worktree prune
```

---

## 방식 2: GitHub Actions 자동화 (CI/CD 연동)

PR이 열릴 때마다 자동으로 Claude가 개입하는 방식.

### 기본 워크플로우 파일

`.github/workflows/claude.yml`

```yaml
name: Claude Code PR Automation

on:
  issues:
    types: [opened, labeled]
  issue_comment:
    types: [created]
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 주요 트리거 패턴

| 트리거 | 동작 |
|--------|------|
| 이슈에 `@claude` 멘션 | 이슈 읽고 코드 짜서 PR 오픈 |
| PR 오픈/업데이트 | 자동 코드 리뷰 코멘트 |
| 코드 변경 감지 | 관련 문서 자동 업데이트 PR |
| 릴리즈 태깅 | 릴리즈 노트 자동 생성 |

### 무한 루프 방지

```yaml
# Claude가 만든 PR/커밋이 다시 트리거하지 않도록
if: |
  github.event.pull_request.user.type != 'Bot' &&
  !startsWith(github.event.pull_request.title, 'docs:')
```

### API 키 보안

```yaml
# 반드시 GitHub Secrets 사용
anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}

# 절대 하드코딩 금지
# anthropic_api_key: "sk-ant-api03-..."  ← 위험
```

---

## 방식 3: continuous-claude (완전 자동화)

브랜치 생성 → 작업 → PR 오픈 → CI 통과 대기 → 머지까지 루프를 자동화하는 오픈소스 도구.

GitHub: `AnandChowdhary/continuous-claude`

```
🌿 브랜치 생성
🤖 Claude Code 실행
💬 변경사항 커밋
📤 브랜치 푸시
🔨 PR 생성
🔍 CI 체크 대기
✅ 체크 통과
🔀 자동 머지
↩️ 다음 반복
```

---

## 방식 선택 기준

| 상황 | 추천 방식 |
|------|-----------|
| 로컬에서 피처 여러 개 동시 개발 | Git Worktree + 병렬 에이전트 |
| 이슈 → PR 자동화 | GitHub Actions |
| 코드 리뷰 자동화 | GitHub Actions (PR 트리거) |
| 완전 무인 자동화 | continuous-claude |

---

## 주의사항

- **Worktree 적정 수**: 실무에서 6~10개가 상한선. 그 이상이면 PR 머지가 병목일 가능성이 높음
- **공유 파일 충돌 주의**: `package.json`, config 파일 등 여러 에이전트가 동시에 수정할 수 있는 파일은 작업 분리 시 고려 필요
- **토큰 비용**: 병렬 에이전트는 토큰 사용량도 병렬로 늘어남
- **Claude Max 플랜**: OAuth 토큰으로 API 키 없이 GitHub Actions 사용 가능 (v1.0.44+)

---

## 빠른 시작 체크리스트

### 로컬 병렬 워크플로우
- [ ] `git worktree add` 로 작업별 worktree 생성
- [ ] 각 worktree에서 Claude Code 실행
- [ ] 작업 완료 후 PR 생성 요청
- [ ] PR 리뷰 후 머지
- [ ] `git worktree remove` 로 정리

### GitHub Actions
- [ ] `ANTHROPIC_API_KEY` → GitHub Secrets 등록
- [ ] `.github/workflows/claude.yml` 생성
- [ ] 봇 루프 방지 조건 추가
- [ ] 이슈에서 `@claude` 멘션으로 테스트
