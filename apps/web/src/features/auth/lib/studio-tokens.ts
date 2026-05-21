/**
 * s1 인증 화면 전용 클래스 토큰 묶음 (반복 방지).
 *
 * - PR1 머지로 globals.css / tailwind.config.ts 의 named token (ink/dim/faint/accent/...) 가 도입된 후,
 *   본 파일은 *raw OKLCH 매핑이 아닌* '인증 도메인 한정 컴포지트 class 단축자' 로 역할이 좁혀졌다.
 * - 참조: docs/design-renewal/designFile/concepts/studio-domains.jsx (s1),
 *   docs/design-renewal/designFile/concepts/studio-extras.jsx (OAuth callback).
 */
export const studioClass = {
  /** 카드 컨테이너 — 흰색 + 16px radius + 1px border + 28~36px padding + soft shadow */
  card:
    'border bg-white border-border rounded-[16px] p-[28px] md:p-[36px] shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_32px_-16px_rgba(0,0,0,0.18)]',
  /** Card2 (subtle surface — 탭 컨테이너 / 정보 박스) */
  card2: 'bg-card-2 rounded-[12px]',
  /** 카드 헤딩 (H1/H2) — 26px ink weight 700 -0.02em tracking */
  h1: 'text-[26px] font-bold text-ink tracking-[-0.02em] leading-tight',
  /** Sub copy — 13.5 dim */
  sub: 'text-[13.5px] text-dim leading-relaxed',
  /** Field label — 12 dim weight 600 */
  label:
    'text-[12px] font-semibold text-dim mb-1.5 block',
  /** Input — radius 10, borderHi 1px, padding 10/12, font 13.5 */
  input:
    'h-auto rounded-[10px] border border-border-strong bg-white px-[12px] py-[10px] text-[13.5px] text-ink placeholder:text-faint focus-visible:ring-accent focus-visible:border-accent aria-[invalid=true]:border-danger aria-[invalid=true]:border-[1.5px] md:text-[13.5px]',
  /** 에러 헬퍼 텍스트 — 11.5 danger */
  helperError: 'text-[11.5px] text-danger mt-1.5',
  /** 일반 헬퍼 텍스트 — 11.5 faint */
  helperHint: 'text-[11.5px] text-faint mt-1.5',
  /** Primary CTA — ink bg, white text, full-width, radius 10, padding 12/18, weight 700 */
  ctaPrimary:
    'w-full h-auto rounded-[10px] bg-ink hover:bg-text !text-white px-[18px] py-[12px] text-[14px] font-bold shadow-[0_1px_0_rgba(0,0,0,0.06),0_4px_12px_-3px_rgba(0,0,0,0.2)] disabled:opacity-60',
  /** 탭 리스트 (언더라인 가이드) — 하단 1px border + flex 가로 배치 */
  tabList:
    'flex w-full gap-6 border-b border-border bg-transparent p-0 h-auto rounded-none justify-start',
  /** 탭 트리거 — 텍스트 only + 활성 시 2px ink 언더라인 (가이드선 위에 -2px 로 겹침) */
  tabTrigger:
    'relative -mb-[2px] rounded-none bg-transparent px-1 pb-2.5 pt-1 text-[13.5px] font-medium text-faint border-b-2 border-transparent transition-colors hover:text-dim data-[state=active]:text-ink data-[state=active]:font-semibold data-[state=active]:border-ink focus-visible:outline-none focus-visible:text-ink',
  /** 강조 액션 링크 — ink 700 underline-offset 3 */
  linkStrong:
    'text-ink font-bold underline underline-offset-[3px] hover:text-accent transition-colors',
  /** 보조 링크 — ink + accent underline (WCAG: text-accent 단독은 작은 글자 4.5:1 미달) */
  linkAccent:
    'text-ink font-semibold underline decoration-accent decoration-2 underline-offset-2 hover:decoration-[3px]',
  /** Body faint 텍스트 (footer 라인) */
  bodyFaint: 'text-[13px] text-faint',
  /** 비밀번호 토글 버튼 (input 안쪽 우측) */
  passwordToggle:
    'absolute inset-y-0 right-0 flex items-center px-3 text-[11.5px] font-semibold text-faint hover:text-ink focus-visible:outline-none focus-visible:underline rounded-r-[10px]',
} as const
