import type { Config } from 'tailwindcss'

/**
 * MarketCast — Tailwind v3 디자인 시스템.
 *
 * 토큰 마스터: docs/architecture/v1/ui-system.md
 * - 색상은 RGB triplet CSS 변수 (src/styles/globals.css) → `rgb(var(--*) / <alpha-value>)` 로 alpha 변형 지원.
 * - 라이트/다크는 `[data-theme="dark"]` 또는 `.dark` 양쪽 모두 동작 (테마 토글이 data-theme 기록).
 * - 마켓 브랜드색은 모드 무관 단일값 (법적 가이드라인 회피) — HEX 직접 박지 않고 CSS 변수로 wrap (다크 톤업도 변수에서 처리).
 * - xl breakpoint 는 1200px 로 override (D1 결정).
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1200px', // D1: 우리 데스크탑 기준 1200 으로 override
      '2xl': '1440px',
    },
    extend: {
      colors: {
        // surface
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
        },
        // text
        text: {
          DEFAULT: 'rgb(var(--text) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
        // border
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
        },
        // accent
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          'soft-border': 'rgb(var(--accent-soft-border) / <alpha-value>)',
        },
        // status
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          soft: 'rgb(var(--success-soft) / <alpha-value>)',
          'on-soft': 'rgb(var(--success-on-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          soft: 'rgb(var(--warning-soft) / <alpha-value>)',
          'on-soft': 'rgb(var(--warning-on-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
          'on-soft': 'rgb(var(--danger-on-soft) / <alpha-value>)',
        },
        info: {
          soft: 'rgb(var(--info-soft) / <alpha-value>)',
          'on-soft': 'rgb(var(--info-on-soft) / <alpha-value>)',
        },
        // ring (focus)
        ring: 'rgb(var(--ring) / <alpha-value>)',
        // 마켓 브랜드 — 변수로 wrap (다크 톤업 ui-system.md §3.2 반영)
        market: {
          naver: 'rgb(var(--market-naver) / <alpha-value>)',
          eleventh: 'rgb(var(--market-eleventh) / <alpha-value>)',
          gmarket: 'rgb(var(--market-gmarket) / <alpha-value>)',
          auction: 'rgb(var(--market-auction) / <alpha-value>)',
          coupang: 'rgb(var(--market-coupang) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)', // 6
        DEFAULT: 'var(--radius)', // 8
        md: 'var(--radius-md)', // 10
        lg: 'var(--radius-lg)', // 14
        xl: 'var(--radius-xl)', // 20
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Apple SD Gothic Neo"',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // ui-system.md §4.2 스케일
        display: ['2.5rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
        h1: ['1.75rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        'h1-mobile': ['1.5rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        h2: ['1.25rem', { lineHeight: '1.3', fontWeight: '700', letterSpacing: '-0.02em' }],
        h3: ['1rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['0.9375rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-mobile': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        sm: ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
        xs: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        label: ['0.78125rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '-0.01em' }],
        button: ['0.8125rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.01em' }],
        'button-mobile': ['0.9375rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.01em' }],
      },
      spacing: {
        // 의미 토큰 (4px 베이스). Tailwind 기본 1=4px 스케일과 충돌 안 나는 의미 이름만 추가.
        tight: '4px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-in-from-top': {
          from: { transform: 'translateY(-8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-from-bottom': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-skeleton': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 120ms ease-in',
        'slide-in-from-top': 'slide-in-from-top 180ms ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 180ms ease-out',
        'pulse-skeleton': 'pulse-skeleton 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
