import type { Config } from 'tailwindcss'

/**
 * MarketCast — Tailwind v3 디자인 시스템.
 *
 * 토큰 마스터: docs/architecture/v1/ui-system.md + docs/design-renewal/designFile/concepts/studio-tokens.jsx
 * - 색상은 OKLCH `L C H` triplet CSS 변수 (apps/web/src/styles/globals.css)
 *   → `oklch(var(--*) / <alpha-value>)` 로 alpha 변형 지원.
 * - 라이트 전용 (v1.3 다크모드 제거 — 2026-05-22). `darkMode` 키 삭제.
 * - xl breakpoint 는 1200px 로 override (D1 결정).
 *
 * v1.3 포인트 키컬러:
 *  - accent 패밀리 ochre amber(hue 55) → vivid orange(#ff5a1f, hue 35).
 *  - 신규 `accent.onlight` (--accent-on-light) 키 — 흰 배경 위 작은 라벨용 darker variant.
 *
 * v1.2 Studio 리뉴얼:
 *  - 색공간 RGB → OKLCH 전환.
 *  - 폰트: Manrope (1st) + Pretendard (한글 fallback) + JetBrains Mono.
 *  - radii 스케일: 4 / 8 / 10 / 12 / 14 / 16 / 999.
 */
const config: Config = {
  content: ['./apps/web/index.html', './apps/web/src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1200px', // D1
      '2xl': '1440px',
    },
    extend: {
      colors: {
        // surface
        surface: {
          DEFAULT: 'oklch(var(--surface) / <alpha-value>)',
          subtle: 'oklch(var(--surface-subtle) / <alpha-value>)',
          muted: 'oklch(var(--surface-muted) / <alpha-value>)',
        },
        // Studio card (pure white in light, elevated panel in dark)
        bg: 'oklch(var(--surface) / <alpha-value>)',
        card: {
          DEFAULT: 'oklch(var(--card) / <alpha-value>)',
          2: 'oklch(var(--card2) / <alpha-value>)',
        },
        // text — Studio ink scale
        ink: 'oklch(var(--ink) / <alpha-value>)',
        text: {
          DEFAULT: 'oklch(var(--text) / <alpha-value>)',
          secondary: 'oklch(var(--text-secondary) / <alpha-value>)',
          tertiary: 'oklch(var(--text-tertiary) / <alpha-value>)',
        },
        dim: 'oklch(var(--dim) / <alpha-value>)',
        faint: 'oklch(var(--faint) / <alpha-value>)',
        // border
        border: {
          DEFAULT: 'oklch(var(--border) / <alpha-value>)',
          strong: 'oklch(var(--border-strong) / <alpha-value>)',
        },
        // accent — vivid orange (#ff5a1f, v1.3 키컬러)
        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
          hover: 'oklch(var(--accent-hover) / <alpha-value>)',
          soft: 'oklch(var(--accent-soft) / <alpha-value>)',
          'soft-border': 'oklch(var(--accent-soft-border) / <alpha-value>)',
          onlight: 'oklch(var(--accent-on-light) / <alpha-value>)',
        },
        // status
        success: {
          DEFAULT: 'oklch(var(--success) / <alpha-value>)',
          soft: 'oklch(var(--success-soft) / <alpha-value>)',
          'on-soft': 'oklch(var(--success-on-soft) / <alpha-value>)',
        },
        ok: {
          DEFAULT: 'oklch(var(--success) / <alpha-value>)',
          soft: 'oklch(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'oklch(var(--warning) / <alpha-value>)',
          soft: 'oklch(var(--warning-soft) / <alpha-value>)',
          'on-soft': 'oklch(var(--warning-on-soft) / <alpha-value>)',
        },
        warn: {
          DEFAULT: 'oklch(var(--warning) / <alpha-value>)',
          soft: 'oklch(var(--warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'oklch(var(--danger) / <alpha-value>)',
          soft: 'oklch(var(--danger-soft) / <alpha-value>)',
          'on-soft': 'oklch(var(--danger-on-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'oklch(var(--info) / <alpha-value>)',
          soft: 'oklch(var(--info-soft) / <alpha-value>)',
          'on-soft': 'oklch(var(--info-on-soft) / <alpha-value>)',
        },
        ring: 'oklch(var(--ring) / <alpha-value>)',
        // 마켓 브랜드 — Studio m1~m5 + alias 키 (sibling PR 호환)
        market: {
          naver: 'oklch(var(--market-naver) / <alpha-value>)',
          coupang: 'oklch(var(--market-coupang) / <alpha-value>)',
          gmarket: 'oklch(var(--market-gmarket) / <alpha-value>)',
          auction: 'oklch(var(--market-auction) / <alpha-value>)',
          eleventh: 'oklch(var(--market-eleventh) / <alpha-value>)',
          // 별칭 (studio.jsx 의 m1~m5 키)
          m1: 'oklch(var(--market-naver) / <alpha-value>)',
          m2: 'oklch(var(--market-coupang) / <alpha-value>)',
          m3: 'oklch(var(--market-gmarket) / <alpha-value>)',
          m4: 'oklch(var(--market-auction) / <alpha-value>)',
          m5: 'oklch(var(--market-eleventh) / <alpha-value>)',
        },
        // legacy alias — Wordmark 등 v1.1 잔존 코드 호환 (Studio 톤 매핑)
        navy: 'oklch(var(--navy) / <alpha-value>)',
      },
      backgroundImage: {
        'brand-grad': 'var(--brand-grad)',
      },
      borderRadius: {
        // Studio 스케일 4 / 8 / 10 / 12 / 14 / 16 / 999
        sm: 'var(--radius-sm)', // 4
        DEFAULT: 'var(--radius)', // 8
        md: 'var(--radius-md)', // 10
        lg: 'var(--radius-lg)', // 12
        xl: 'var(--radius-xl)', // 14
        '2xl': 'var(--radius-2xl)', // 16
        full: 'var(--radius-full)', // 999
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        // Studio 기본 — Manrope 1순위, Pretendard 한글 fallback
        sans: [
          'Manrope',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Apple SD Gothic Neo"',
          'system-ui',
          'sans-serif',
        ],
        // 영문 hero / 워드마크
        brand: [
          'Manrope',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        // 수치 · 코드 · 테이블 monospace
        mono: [
          'ui-monospace',
          '"JetBrains Mono"',
          '"IBM Plex Mono"',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
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
