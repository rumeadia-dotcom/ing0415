import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Vitest 설정 — 단위·통합 테스트 (testing.md §2 / §6 / §7).
//
// - 환경: jsdom (RTL 컴포넌트 렌더 + 브라우저 API).
// - globals: false. describe / it / expect 는 각 테스트 파일에서 명시적 import.
// - setupFiles: tests/vitest.setup.ts — jest-dom matcher + jsdom 폴리필.
// - include: co-located apps/web/src 테스트 + tests/unit.
// - alias @ → apps/web/src. tsconfig.app.json paths 와 정합 (모노레포 정리 2026-05-19).
//
// Playwright spec 은 본 설정의 include 밖.
// tests/e2e 는 playwright.config.ts 가 잡는다.
// 두 러너가 같은 디렉토리를 더블 픽업하지 않도록 분리.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web/src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/vitest.setup.ts'],
    include: [
      'apps/web/src/**/*.test.ts',
      'apps/web/src/**/*.test.tsx',
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    // Playwright 와 디렉토리 충돌 회피.
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/e2e/**',
      'tests/fixtures/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'apps/web/src/**/*.d.ts',
        'apps/web/src/main.tsx',
        'apps/web/src/app/router.tsx',
        'apps/web/src/**/types.ts',
        'apps/web/src/**/index.ts',
      ],
    },
    // jsdom 콘솔 노이즈 억제는 setupFiles 안에서 처리.
    clearMocks: true,
    restoreMocks: true,
  },
})
