import { LegalLayout, type LegalSection } from '../components/LegalLayout'
import { ko } from '@/locales/ko'

/**
 * ManualPage — /manual.
 *
 * v1 출시 사전조건. 5섹션 가이드 (회원가입 → 마켓 연결 → 5단계 위저드 → 결과 확인 → 이력 → FAQ).
 * 비인증 접근 가능 (라우터에서 RequireAuth 그룹 밖에 배치).
 *
 * v2 백로그: 베타 셀러용 동영상 매뉴얼, 마켓별 가이드 분리, 검색.
 */
export function ManualPage(): JSX.Element {
  const s = ko.legal.manual.sections
  const sections: LegalSection[] = [
    { id: 'signup', title: s.signup.title, body: s.signup.body },
    { id: 'register', title: s.register.title, body: s.register.body },
    { id: 'result', title: s.result.title, body: s.result.body },
    { id: 'history', title: s.history.title, body: s.history.body },
    { id: 'faq', title: s.faq.title, body: s.faq.body },
  ]

  return (
    <LegalLayout
      title={ko.legal.manual.title}
      subtitle={ko.legal.manual.subtitle}
      sections={sections}
      meta={
        <div className="space-y-1 rounded-md border border-info-soft bg-info-soft/40 px-3 py-2 text-xs text-info-on-soft">
          <p>{ko.legal.common.lastUpdated}</p>
        </div>
      }
    />
  )
}

export default ManualPage
