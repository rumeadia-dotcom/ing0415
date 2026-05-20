import { LegalLayout, type LegalSection } from '../components/LegalLayout'
import { ko } from '@/locales/ko'

/**
 * PrivacyPage — /legal/privacy.
 *
 * v1 출시 사전조건. 「개인정보 보호법」 표준 10조 구조의 초안.
 * - Supabase / Sentry / GitHub Pages 위탁 사항 명시 (실 운영 처리자 기준)
 * - 마켓 OAuth 토큰의 pgcrypto 암호화 + RLS 격리 + Sentry 마스킹 정책 노출
 * - 보호책임자·연락처는 운영 전 사용자 본인 정보로 교체 필요 → 본 초안에는 placeholder
 */
export function PrivacyPage(): JSX.Element {
  const s = ko.legal.privacy.sections
  const sections: LegalSection[] = [
    { id: 'items', title: s.items.title, body: s.items.body },
    { id: 'method', title: s.method.title, body: s.method.body },
    { id: 'purpose', title: s.purpose.title, body: s.purpose.body },
    { id: 'retention', title: s.retention.title, body: s.retention.body },
    { id: 'third-party', title: s.thirdParty.title, body: s.thirdParty.body },
    { id: 'delegation', title: s.delegation.title, body: s.delegation.body },
    { id: 'destruction', title: s.destruction.title, body: s.destruction.body },
    { id: 'rights', title: s.rights.title, body: s.rights.body },
    { id: 'safety', title: s.safety.title, body: s.safety.body },
    { id: 'officer', title: s.officer.title, body: s.officer.body },
  ]

  return (
    <LegalLayout
      title={ko.legal.privacy.title}
      subtitle={ko.legal.privacy.subtitle}
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

export default PrivacyPage
