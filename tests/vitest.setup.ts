/**
 * Vitest 전역 setup.
 *
 * - jest-dom matcher 확장 (`toBeInTheDocument`, `toHaveTextContent` 등).
 * - jsdom 미지원 브라우저 API 폴리필 (matchMedia / IntersectionObserver / ResizeObserver).
 * - 각 테스트 후 RTL DOM 정리.
 *
 * 본 파일은 vitest 가 자동 로드한다 (vitest.config.ts `setupFiles`).
 * 컴포넌트 테스트에서 별도 import 불필요.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// ── DOM cleanup ───────────────────────────────────────────────────────────────
afterEach(() => {
  cleanup()
})

// ── matchMedia 폴리필 ────────────────────────────────────────────────────────
// jsdom 미지원. shadcn/ui 다크 모드 토글, 반응형 컴포넌트 등이 호출.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }),
  })
}

// ── IntersectionObserver 폴리필 ───────────────────────────────────────────────
// Radix Tooltip / Dialog 등 일부 컴포넌트가 의존.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    observe(): void {
      /* noop — jsdom 미지원 폴리필 */
    }
    unobserve(): void {
      /* noop */
    }
    disconnect(): void {
      /* noop */
    }
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver
}

// ── ResizeObserver 폴리필 ─────────────────────────────────────────────────────
if (typeof globalThis.ResizeObserver === 'undefined') {
  class MockResizeObserver implements ResizeObserver {
    observe(): void {
      /* noop */
    }
    unobserve(): void {
      /* noop */
    }
    disconnect(): void {
      /* noop */
    }
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
}

// ── scrollTo 폴리필 (Radix Dialog 등이 호출) ──────────────────────────────────
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = vi.fn() as unknown as Window['scrollTo']
}
