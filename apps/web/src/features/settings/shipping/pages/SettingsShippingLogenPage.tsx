import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * SettingsShippingLogenPage — /settings/shipping/logen (s9 n59).
 * 마스터: docs/architecture/v2/features/settings-shipping.md §5.2.
 * PR1 (foundation): placeholder. PR10 가 userId/custCd 폼 + [연결 테스트] 액션으로 교체.
 */
export function SettingsShippingLogenPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title={ko.settingsShipping.logen.title}
        subtitle={ko.settingsShipping.logen.subtitle}
      />
      <V2Placeholder message={ko.settingsShipping.placeholder} />
    </div>
  )
}

export default SettingsShippingLogenPage
