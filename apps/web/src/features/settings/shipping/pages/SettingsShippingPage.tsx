import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * SettingsShippingPage — /settings/shipping (s9 n58).
 * 마스터: docs/architecture/v2/features/settings-shipping.md §5.1.
 * PR1 (foundation): placeholder. PR10 가 로젠 상태 카드 + 발송인 카드 + 동작 설정으로 교체.
 */
export function SettingsShippingPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title={ko.settingsShipping.hub.title}
        subtitle={ko.settingsShipping.hub.subtitle}
      />
      <V2Placeholder message={ko.settingsShipping.placeholder} />
    </div>
  )
}

export default SettingsShippingPage
