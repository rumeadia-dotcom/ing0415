import { LegalLayout, type LegalSection } from '../components/LegalLayout'
import { ko } from '@/locales/ko'

/**
 * TermsPage — /legal/terms.
 *
 * v1 출시 사전조건 (WIP Phase 5). 본문은 SaaS 표준 12조 구조의 초안.
 * 법률 검토 후 운영 전 최종본으로 교체 — `ko.legal.common.draftNotice` 로 사용자에게 명시.
 *
 * 콘텐츠는 모두 `ko.legal.terms.sections.*` 사전 참조 (i18n 하드코딩 금지 규칙).
 */
export function TermsPage(): JSX.Element {
  const s = ko.legal.terms.sections
  const sections: LegalSection[] = [
    { id: 'purpose', title: s.purpose.title, body: s.purpose.body },
    { id: 'definitions', title: s.definitions.title, body: s.definitions.body },
    { id: 'effect', title: s.effect.title, body: s.effect.body },
    { id: 'service', title: s.service.title, body: s.service.body },
    { id: 'signup', title: s.signup.title, body: s.signup.body },
    { id: 'obligations', title: s.obligations.title, body: s.obligations.body },
    { id: 'change', title: s.change.title, body: s.change.body },
    { id: 'information', title: s.information.title, body: s.information.body },
    { id: 'disclaimer', title: s.disclaimer.title, body: s.disclaimer.body },
    { id: 'dispute', title: s.dispute.title, body: s.dispute.body },
    { id: 'governing', title: s.governing.title, body: s.governing.body },
    { id: 'addendum', title: s.addendum.title, body: s.addendum.body },
  ]

  return (
    <LegalLayout
      title={ko.legal.terms.title}
      subtitle={ko.legal.terms.subtitle}
      sections={sections}
      meta={
        <div className="space-y-1 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning-on-soft">
          <p>{ko.legal.common.lastUpdated} · {ko.legal.common.effectiveFrom}</p>
          <p>{ko.legal.common.draftNotice}</p>
        </div>
      }
    />
  )
}

export default TermsPage
