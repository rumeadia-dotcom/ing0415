import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * OrderDetailPage — /orders/:orderId (s7 n49 + n50 다이얼로그 진입).
 * 마스터: docs/architecture/v2/features/orders.md §6.3 / §6.4.
 * PR1 (foundation): placeholder. PR8 가 타임라인 + 로젠 등록 상태 + 수동 처리 다이얼로그로 교체.
 */
export function OrderDetailPage(): JSX.Element {
  const { orderId } = useParams<{ orderId: string }>()
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      {orderId ? (
        <PageHeader title={ko.orders.detail.title} subtitle={`ID: ${orderId}`} />
      ) : (
        <PageHeader title={ko.orders.detail.title} />
      )}
      <V2Placeholder message={ko.orders.placeholder} />
    </div>
  )
}

export default OrderDetailPage
