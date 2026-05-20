# legal — 약관 / 개인정보처리방침 / 매뉴얼 정적 페이지 (v1 출시 사전조건)

작성: 2026-05-20 (D-C — v1 출시 사전조건 구현)
상태: 초안 (콘텐츠는 법률 검토 전)
근거: WIP-5markets-mvp.md Phase 5 (v1 출시) — "매뉴얼·약관·개인정보처리방침"

## 1. 목적

v1 출시 전 사용자 동의·고지 의무 충족을 위한 3종 정적 페이지를 제공한다.

- **약관 (`/legal/terms`)** — 서비스 이용에 관한 권리·의무·책임. 회원가입 동의 항목의 본문.
- **개인정보처리방침 (`/legal/privacy`)** — 「개인정보 보호법」 제30조에 따른 공개 의무 충족. 마켓 OAuth 토큰 처리 절차 명시.
- **매뉴얼 (`/manual`)** — 셀러용 5단계 가이드. 베타 셀러 온보딩 + 트러블슈팅 진입점.

## 2. 라우팅

| 경로 | 컴포넌트 | 셸 | 인증 |
|---|---|---|---|
| `/legal/terms` | `TermsPage` | `PublicLegalShell` | 비인증 접근 가능 |
| `/legal/privacy` | `PrivacyPage` | `PublicLegalShell` | 비인증 접근 가능 |
| `/manual` | `ManualPage` | `PublicLegalShell` | 비인증 접근 가능 |

`PublicLegalShell` 은 `router.tsx` 내부에 정의된 `<main>` + `<Footer />` 만 가진 경량 셸. 사이드바·헤더 없음. `RequireAuth` 그룹 밖에 배치되어 회원가입 단계에서도 약관 본문을 자유롭게 열람할 수 있다.

## 3. 컴포넌트

- `features/legal/components/LegalLayout.tsx` — 사이드 TOC + 본문 article. 모든 3페이지 공통 시각.
- `features/legal/pages/TermsPage.tsx` — 12조 (목적/정의/효력/서비스/회원가입/의무/변경·중단/정보/면책/분쟁/준거법/부칙).
- `features/legal/pages/PrivacyPage.tsx` — 10조 (수집항목/방법/목적/보유기간/제3자제공/위탁/파기/권리/안전성/보호책임자).
- `features/legal/pages/ManualPage.tsx` — 5섹션 (회원가입 → 5단계 위저드 → 결과 → 이력 → FAQ).

## 4. i18n

모든 텍스트는 `apps/web/src/locales/ko.ts` 의 `ko.legal.*` / `ko.footer.*` 네임스페이스 참조. 페이지 컴포넌트는 하드코딩 금지 (CLAUDE.md "i18n" 규칙).

```
ko.legal.common.{tocHeading, skipToContent, lastUpdated, effectiveFrom, draftNotice}
ko.legal.terms.{title, subtitle, sections.<12조>.{title, body}}
ko.legal.privacy.{title, subtitle, sections.<10조>.{title, body}}
ko.legal.manual.{title, subtitle, sections.<5섹션>.{title, body}}
ko.footer.{terms, privacy, manual, copyright, nav}
```

## 5. 푸터 (`components/layout/Footer.tsx`)

`AppLayout` / `AuthLayout` / `PublicLegalShell` 3개 셸 모두 하단에 마운트.

- 좌측: 이용약관 | 개인정보처리방침 | 매뉴얼 (`<Link to>` SPA 네비)
- 우측: © 2026 MarketCast
- 접근성: `role="contentinfo"` + `<nav aria-label="하단 푸터">`
- 반응형: 모바일 세로 스택, sm+ 한 줄.

회원가입 단계에서도 약관 본문 접근이 가능해야 동의의 의미가 성립하므로 AuthLayout 에도 동일 푸터를 마운트한다.

## 6. 접근성

- **skip-link**: `LegalLayout` 최상단에 `<a href="#legal-main">` 으로 키보드 첫 Tab 진입 시 본문으로 점프. WCAG 2.4.1 Bypass Blocks 충족.
- **TOC**: `<nav aria-label="목차">` + `<ol>` 로 순차 구조. anchor 클릭 시 해시 변경 → `useEffect` 가 해당 섹션 `scrollIntoView` + `focus`.
- **본문 섹션**: `<section id aria-labelledby>` + `<h2 id>` 의미 구조. `whitespace-pre-line` 으로 다중 단락 표시.
- **본문 가독성**: 본문 텍스트는 `text-sm md:text-base` + `leading-7 md:leading-8` — 약 1.5~1.6 줄간격으로 장문 가독성 확보.
- **focus 링**: 모든 anchor 에 `focus-visible:ring-2 focus-visible:ring-ring` 일관 적용.

## 7. 테스트

- 단위 (Vitest + RTL): 6건
  - `TermsPage.test.tsx` — 타이틀 / 12조 헤딩 / draftNotice 노출
  - `PrivacyPage.test.tsx` — 타이틀+부제 / 10조 헤딩 / Supabase·Sentry 위탁 명시
  - `ManualPage.test.tsx` — 5섹션 / TOC 5항목 / skip-link 존재
  - `Footer.test.tsx` — 3링크 라우트 / 저작권 / contentinfo·nav 랜드마크
  - `legal-routing.test.tsx` — `/legal/terms`·`/legal/privacy`·`/manual` 3 라우트 마운트 + 푸터 동반
- E2E (Playwright + axe): `tests/e2e/a11y.spec.ts` 의 `ROUTES` 배열에 3 라우트 추가 — axe `violations.length === 0`.

## 8. 미포함 / v2 백로그

- 베타 셀러 매뉴얼 동영상 (별도 작업)
- 마켓별 가이드 분리 페이지
- 매뉴얼 검색 / FAQ 카테고라이즈
- 약관 버전 이력 추적 + 동의 재요청 플로우

## 9. 운영 전 확정 필요

- **법률 검토**: 약관 12조 / 개인정보처리방침 10조 본문은 SaaS 표준 구조 기반 초안. 변호사 검토 후 최종본 교체.
- **개인정보 보호책임자**: `PrivacyPage` 의 제10조 본문 placeholder (`privacy@marketcast.example`) 를 운영 도메인·담당자로 교체.
- **시행일**: 현재 2026-06-01 가정. 출시 일정 확정 시 `ko.legal.common.effectiveFrom` 갱신.

## 10. 동기화 관계

- 설계문서: 본 파일 (`docs/architecture/v1/features/legal.md`)
- HTML 프로토타입: 본 문서 작성 시점에는 신설하지 않음 — 정식 React 컴포넌트가 단일 소스이며, 디자인 변경이 발생하면 그 시점에 `docs/frontend_html_design/v1/legal/` 신설.
- 실제 구현: `apps/web/src/features/legal/` + `apps/web/src/components/layout/Footer.tsx` + `apps/web/src/app/router.tsx` + `apps/web/src/locales/ko.ts` + `apps/web/src/app/layouts/{AppLayout,AuthLayout}.tsx`
