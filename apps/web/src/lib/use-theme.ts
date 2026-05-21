import { useCallback, useEffect, useState } from 'react'

/**
 * useTheme — 라이트 / 다크 / 시스템 추종 3-state 토글.
 * ui-system.md §11
 *
 * - localStorage.theme: 'light' | 'dark' | 'system' | null
 * - html[data-theme] + html.dark 양쪽 갱신 (Tailwind darkMode 호환)
 * - SSR 없음(GitHub Pages SPA) → 첫 페인트는 index.html inline 스크립트가 처리, 이 훅은 mount 후 상태 sync 만
 */
export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

function readStoredTheme(): ThemeMode {
  // TEMP: 다크/시스템 모드 임시 비활성 — 라이트 default. 다시 켤 때 'system' 으로 복구.
  if (typeof window === 'undefined') return 'light'
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* noop */
  }
  return 'light'
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark())
  const root = document.documentElement
  if (isDark) {
    root.setAttribute('data-theme', 'dark')
    root.classList.add('dark')
  } else {
    root.setAttribute('data-theme', 'light')
    root.classList.remove('dark')
  }
}

export interface UseThemeResult {
  theme: ThemeMode
  resolved: 'light' | 'dark'
  setTheme: (mode: ThemeMode) => void
  toggle: () => void
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme())
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    theme === 'dark' || (theme === 'system' && systemPrefersDark()) ? 'dark' : 'light',
  )

  useEffect(() => {
    applyTheme(theme)
    setResolved(
      theme === 'dark' || (theme === 'system' && systemPrefersDark()) ? 'dark' : 'light',
    )
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* noop */
    }
  }, [theme])

  // 시스템 prefers 변경 추적 (theme === 'system' 일 때만 반영)
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => {
      applyTheme('system')
      setResolved(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return (): void => {
      mq.removeEventListener('change', handler)
    }
  }, [theme])

  const setTheme = useCallback((mode: ThemeMode): void => {
    setThemeState(mode)
  }, [])

  // 3-state 순환: light → dark → system → light
  const toggle = useCallback((): void => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'))
  }, [])

  return { theme, resolved, setTheme, toggle }
}
