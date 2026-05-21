import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * SettingsShippingSenderPage — /settings/shipping/sender (s9 n60).
 * 마스터: docs/architecture/v2/features/settings-shipping.md §5.3.
 * PR1 (foundation): placeholder. PR10 가 발송인명/주소/연락처/fareTy/dlvFare 폼으로 교체.
 */
export function SettingsShippingSenderPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title={ko.settingsShipping.sender.title}
        subtitle={ko.settingsShipping.sender.subtitle}
      />
      <V2Placeholder message={ko.settingsShipping.placeholder} />
    </div>
  )
}

export default SettingsShippingSenderPage
