/**
 * Studio 디자인 컨셉 — s1 인증 화면 전용 OKLCH 토큰 (디자이너 인계 ground truth).
 *
 * - 본 토큰은 Tailwind arbitrary value 로 적용 (raw OKLCH).
 * - globals.css / tailwind.config.ts 토큰 체계와 별도. 디자인 리뉴얼 정식 토큰화
 *   (PR1 - tokens) 후 본 파일은 제거 예정.
 * - 참조: docs/design-renewal/designFile/concepts/studio-domains.jsx (s1)
 *         docs/design-renewal/designFile/concepts/studio-extras.jsx (OAuth callback)
 */
export const studio = {
  bg: 'oklch(0.975 0.008 75)',
  card: '#ffffff',
  card2: 'oklch(0.985 0.006 75)',
  border: 'oklch(0.92 0.008 75)',
  borderHi: 'oklch(0.85 0.01 75)',
  ink: 'oklch(0.15 0.015 60)',
  dim: 'oklch(0.48 0.012 60)',
  faint: 'oklch(0.68 0.01 60)',
  accent: 'oklch(0.62 0.14 55)',
  accentBg: 'oklch(0.94 0.04 65)',
  ok: 'oklch(0.55 0.10 160)',
  okBg: 'oklch(0.94 0.05 160)',
  danger: 'oklch(0.55 0.16 25)',
} as const

/**
 * 자주 쓰이는 Tailwind arbitrary 클래스 (반복 방지).
 */
export const studioClass = {
  /** 카드 컨테이너 — 흰색 + 16px radius + 1px border + 28~36px padding + soft shadow */
  card:
    'border bg-white border-[oklch(0.92_0.008_75)] rounded-[16px] p-[28px] md:p-[36px] shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_32px_-16px_rgba(0,0,0,0.18)]',
  /** Card2 (subtle surface — 탭 컨테이너 / 정보 박스) */
  card2: 'bg-[oklch(0.985_0.006_75)] rounded-[12px]',
  /** 카드 헤딩 (H1/H2) — 26px ink weight 700 -0.02em tracking */
  h1: 'text-[26px] font-bold text-[oklch(0.15_0.015_60)] tracking-[-0.02em] leading-tight',
  /** Sub copy — 13.5 dim */
  sub: 'text-[13.5px] text-[oklch(0.48_0.012_60)] leading-relaxed',
  /** Field label — 12 dim weight 600 */
  label:
    'text-[12px] font-semibold text-[oklch(0.48_0.012_60)] mb-1.5 block',
  /** Input — radius 10, borderHi 1px, padding 10/12, font 13.5 */
  input:
    'h-auto rounded-[10px] border border-[oklch(0.85_0.01_60)] bg-white px-[12px] py-[10px] text-[13.5px] text-[oklch(0.15_0.015_60)] placeholder:text-[oklch(0.68_0.01_60)] focus-visible:ring-[oklch(0.62_0.14_55)] focus-visible:border-[oklch(0.62_0.14_55)] aria-[invalid=true]:border-[oklch(0.55_0.16_25)] aria-[invalid=true]:border-[1.5px] md:text-[13.5px]',
  /** 에러 헬퍼 텍스트 — 11.5 danger */
  helperError: 'text-[11.5px] text-[oklch(0.55_0.16_25)] mt-1.5',
  /** 일반 헬퍼 텍스트 — 11.5 faint */
  helperHint: 'text-[11.5px] text-[oklch(0.68_0.01_60)] mt-1.5',
  /** Primary CTA — ink bg, white text, full-width, radius 10, padding 12/18, weight 700 */
  ctaPrimary:
    'w-full h-auto rounded-[10px] bg-[oklch(0.15_0.015_60)] hover:bg-[oklch(0.22_0.018_60)] !text-white px-[18px] py-[12px] text-[14px] font-bold shadow-[0_1px_0_rgba(0,0,0,0.06),0_4px_12px_-3px_rgba(0,0,0,0.2)] disabled:opacity-60',
  /** 탭 비활성 — 투명 + faint */
  tabInactive:
    'px-[14px] py-[8px] rounded-[7px] text-[13.5px] font-medium text-[oklch(0.68_0.01_60)] bg-transparent transition-colors hover:text-[oklch(0.48_0.012_60)]',
  /** 탭 활성 — white + soft shadow */
  tabActive:
    'px-[14px] py-[8px] rounded-[7px] text-[13.5px] font-semibold text-[oklch(0.15_0.015_60)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
  /** 강조 액션 링크 — ink 700 underline-offset 3 */
  linkStrong:
    'text-[oklch(0.15_0.015_60)] font-bold underline underline-offset-[3px] hover:text-[oklch(0.62_0.14_55)] transition-colors',
  /** 보조 링크 — accent */
  linkAccent:
    'text-[oklch(0.62_0.14_55)] font-semibold hover:underline underline-offset-2',
  /** Body faint 텍스트 (footer 라인) */
  bodyFaint: 'text-[13px] text-[oklch(0.68_0.01_60)]',
  /** 비밀번호 토글 버튼 (input 안쪽 우측) */
  passwordToggle:
    'absolute inset-y-0 right-0 flex items-center px-3 text-[11.5px] font-semibold text-[oklch(0.68_0.01_60)] hover:text-[oklch(0.15_0.015_60)] focus-visible:outline-none focus-visible:underline rounded-r-[10px]',
} as const
