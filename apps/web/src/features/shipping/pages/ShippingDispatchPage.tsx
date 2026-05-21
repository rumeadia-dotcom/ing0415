import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * ShippingDispatchPage — /shipping/dispatch (s8 n53 + n54).
 * 마스터: docs/architecture/v2/features/shipping.md §7.2.
 * PR1 (foundation): placeholder. PR9 가 미리보기 + 진행률 + Realtime 으로 교체.
 */
export function ShippingDispatchPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader title={ko.shipping.dispatch.title} subtitle={ko.shipping.dispatch.subtitle} />
      <V2Placeholder message={ko.shipping.placeholder} />
    </div>
  )
}

export default ShippingDispatchPage
