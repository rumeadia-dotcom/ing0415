/**
 * legal 도메인 진입점.
 * v1 출시 사전조건 (WIP Phase 5) — 약관 / 개인정보처리방침 / 매뉴얼 정적 페이지.
 *
 * 비인증 접근 가능. 라우터는 `/legal/terms`, `/legal/privacy`, `/manual` 에 매핑.
 */
export { TermsPage } from './pages/TermsPage'
export { PrivacyPage } from './pages/PrivacyPage'
export { ManualPage } from './pages/ManualPage'
export { LegalLayout, type LegalSection, type LegalLayoutProps } from './components/LegalLayout'
