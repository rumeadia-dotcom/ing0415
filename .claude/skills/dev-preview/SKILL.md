---
name: dev-preview
description: 로컬 Vite 개발 서버(mock 모드)를 백그라운드로 올리고 사용자 머신의 Chrome 으로 띄우는 워크플로우. 사용자가 "로컬 서버 올리고 크롬으로 띄워", "dev 서버 띄워", "개발 서버 실행하고 브라우저 열어", "로컬에서 띄워봐", "크롬으로 실행" 이라고 말할 때 트리거. 포트 점유(5173→5174 폴백)를 자동 감지하고, 원격 Playwright MCP 가 localhost 에 접근 못 하는 제약을 알기에 사용자 로컬 Chrome 으로 연다.
---

# 로컬 개발 서버 + Chrome 미리보기 스킬

`pnpm dev` (mock 모드: `VITE_APP_MODE=dev` + `VITE_USE_MOCK=true`, 자동 로그인) 를 백그라운드로 올리고, Vite 가 실제로 바인딩한 포트를 로그에서 읽어 사용자 머신의 Chrome 으로 띄운다.

---

## 핵심 제약 (이 스킬이 존재하는 이유)

- **원격 Playwright MCP 는 로컬 dev 서버에 접근 불가.** Playwright MCP 브라우저는 AWS Lightsail (`3.36.239.243`) 에 떠 있어 그쪽 `localhost` 에는 우리 dev 서버가 없다 → `NS_ERROR_CONNECTION_REFUSED`. 따라서 미리보기는 **반드시 사용자 머신의 Chrome** (`Start-Process chrome`) 으로 연다.
- **포트는 고정 아님.** 5173 이 점유되면 Vite 가 5174, 5175… 로 자동 폴백한다. 5173 을 가정하지 말고 **반드시 로그에서 실제 포트를 추출**한다.

---

## 절차

### 1. dev 서버 백그라운드 실행

`pnpm dev` 를 `run_in_background: true` 로 실행한다. (기본 mock 모드 — dev-supabase 에 붙지 않고 in-memory + 자동 로그인이라 가장 안전하고 빠르다.)

```
Bash(command="pnpm dev", run_in_background=true)
```

반환된 background ID 와 output 파일 경로를 기억한다.

> 변형: 사용자가 "dev DB 로", "실 마켓으로" 라고 하면 `pnpm dev:db` (dev-supabase + real 어댑터) 를 쓴다. `pnpm dev:real` (운영 DB) 은 위험하므로 사용자가 명시적으로 요청해도 한 번 더 확인한다.

### 2. 서버 준비 대기 + 포트 추출

output 파일을 Read 해서 `Local:   http://localhost:<PORT>/` 라인을 찾는다. 아직 안 나왔으면 잠깐 후 다시 Read (Vite ready 는 보통 1초 내). 그 라인에서 **실제 포트**를 추출한다.

전형적 출력:
```
  VITE v5.4.21  ready in 769 ms
  ➜  Local:   http://localhost:5174/
```

### 3. 사용자 로컬 Chrome 으로 열기

추출한 포트로 사용자 머신의 Chrome 을 띄운다 (PowerShell):

```
Start-Process chrome "http://localhost:<PORT>/"
```

### 4. 사용자에게 보고

- 실행 모드 (mock / dev:db / dev:real)
- 실제 주소 (`http://localhost:<PORT>/`) — 폴백된 포트면 그 사유 한 줄
- Chrome 을 띄웠다는 사실
- (해당 시) 원격 Playwright 로는 스크린샷 검증이 안 되어 로컬 Chrome 으로 열었다는 한 줄

---

## 주의

- **이미 떠 있는 서버 재사용**: 같은 세션에서 이미 dev 서버를 띄웠으면 새로 올리지 말고 기존 포트로 Chrome 만 다시 연다.
- **포트 가정 금지**: 항상 로그에서 읽는다. 5173 하드코딩 금지.
- **Playwright MCP 로 검증해야 하는 경우** (a11y / 콘솔 에러 회귀 등) 는 이 스킬 범위 밖 — 그건 배포된 URL 또는 별도 터널 대상. 로컬 미리보기는 사용자 눈으로 확인하는 용도다.
