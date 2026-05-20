# E2E 테스트 (Playwright)

> 마스터: `docs/architecture/v1/testing.md` §8, `docs/architecture/v1/qa/golden-path.md`

## 디렉토리

- `golden-path.spec.ts` — 골든 패스 1 시나리오. **main 머지 게이트**.
  현재는 placeholder 라우트 진입 검증 1단계만 active (`G0`), G1~G10 은 `test.fixme` 상태.
  각 페이지가 실제 폼/액션을 구현하면 단계별 어설션을 활성화한다.
- `a11y.spec.ts` — placeholder 라우트 axe 0 violation 회귀 테스트.

## 실행

```bash
# 1. 브라우저 설치 (최초 1회)
pnpm test:e2e:install

# 2. 로컬: dev 서버 또는 preview 서버 먼저 띄움
pnpm dev          # http://localhost:5173
# 또는
pnpm build && pnpm preview --port 5174

# 3. E2E 실행 (env 로 baseURL 지정)
E2E_BASE_URL=http://localhost:5173 pnpm test:e2e

# 4. UI 모드 (디버깅)
pnpm test:e2e:ui
```

## 시나리오 토글 (testing.md §8.2)

MSW 가 도입되는 Stage F+ 부터는 `x-msw-scenario` 헤더로 5xx / 429 / 401 / timeout / partial 토글.
현재 Stage G 는 mock 어댑터 자체에 `globalThis.__MOCK_SCENARIO__` 가 들어있으므로
debug 모드 dev 서버 위에서 page.addInitScript 로 주입 가능.

## CI 매트릭스 (testing.md §8.3)

| 트리거 | 프로젝트 |
|---|---|
| PR → develop | chromium 만 (default) |
| main 머지 | chromium 전체 + webkit / firefox 골든 패스 (Stage H 의 workflow 매트릭스) |
| release/* | chromium / webkit / firefox 전체 (Stage H) |

## 안정성 룰

- `page.waitForTimeout` 사용 금지. `expect(locator).toBeVisible()` 로 대기.
- `test.skip / test.fixme / test.only` 우회 PR 거부 (qa 룰).
- 단계 어설션이 placeholder 페이지로 임시 약하다면 `test.fixme` 로 명시.

## 거부 사유 (testing.md §16 / R-003)

골든 패스 단 1 단계라도 fail / skip / timeout → main 머지 차단.
