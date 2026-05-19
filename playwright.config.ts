import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright 설정 (testing.md §8, qa/golden-path.md).
 *
 * - testDir: `tests/e2e`. Vitest 와 디렉토리 분리.
 * - baseURL: `E2E_BASE_URL` 환경변수, 미설정 시 `http://localhost:5174` (preview 기본).
 * - CI: retry 2 + workers 1 + html/github reporter.
 * - 로컬: list reporter, webServer 자동 기동 없음 (개발자가 `pnpm dev` / `pnpm preview` 직접 실행).
 *
 * 브라우저 매트릭스 (testing.md §8.3):
 *   - PR (develop): Chromium 만 (본 설정의 default).
 *   - main 머지 / release: WebKit, Firefox 는 별도 CI matrix 환경변수로 활성 (Stage H 에서 설정).
 *
 * 안정성 룰:
 *   - `page.waitForTimeout` 금지. expect locator 폴링으로 대기.
 *   - trace / video / screenshot 은 실패 시에만 보존 → CI 산출물 비용 절감.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 90_000, // 골든패스 상한 90s (testing.md §3.3).
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // WebKit / Firefox 는 CI 환경변수 `E2E_FULL_MATRIX=1` 일 때 활성 (Stage H).
    // 본 Stage 에서는 spec 만 작성. CI workflow 가 환경별 PROJECT 필터로 호출.
  ],
  webServer: process.env.CI
    ? {
        command: 'pnpm preview --port 5174 --strictPort',
        url: 'http://localhost:5174',
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
})
