import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * ShippingDispatchResultPage — /shipping/dispatch/:jobId/result (s8 n55 + n56).
 * 마스터: docs/architecture/v2/features/shipping.md §7.3.
 * PR1 (foundation): placeholder. PR9 가 마켓별 결과 카드 + [재시도] 액션으로 교체.
 */
export function ShippingDispatchResultPage(): JSX.Element {
  const { jobId } = useParams<{ jobId: string }>()
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      {jobId ? (
        <PageHeader title={ko.shipping.result.title} subtitle={`Job ID: ${jobId}`} />
      ) : (
        <PageHeader title={ko.shipping.result.title} />
      )}
      <V2Placeholder message={ko.shipping.placeholder} />
    </div>
  )
}

export default ShippingDispatchResultPage
