import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * ShippingHistoryPage — /shipping/history (s8 n57).
 * 마스터: docs/architecture/v2/features/shipping.md §7.4.
 * PR1 (foundation): placeholder. PR9 가 ShippingJob 목록 + 행 클릭으로 result 재진입으로 교체.
 */
export function ShippingHistoryPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader title={ko.shipping.history.title} subtitle={ko.shipping.history.subtitle} />
      <V2Placeholder message={ko.shipping.placeholder} />
    </div>
  )
}

export default ShippingHistoryPage
