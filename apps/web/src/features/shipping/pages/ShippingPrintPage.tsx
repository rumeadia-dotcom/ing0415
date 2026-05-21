import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * ShippingPrintPage — /shipping/print (s8 n52).
 * 마스터: docs/architecture/v2/features/shipping.md §7.1.
 * PR1 (foundation): placeholder. PR9 가 outSlipPrintPop URL 진입 + [출력 완료] 액션으로 교체.
 */
export function ShippingPrintPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader title={ko.shipping.print.title} subtitle={ko.shipping.print.subtitle} />
      <V2Placeholder message={ko.shipping.placeholder} />
    </div>
  )
}

export default ShippingPrintPage
