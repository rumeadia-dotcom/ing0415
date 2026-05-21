import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * OrdersDashboardPage — /orders (s7 n47).
 * 마스터: docs/architecture/v2/features/orders.md §6.1.
 *
 * PR1 (foundation): placeholder. PR8 가 실제 요약 카드 + 최근 주문 테이블 + Realtime 으로 교체.
 */
export function OrdersDashboardPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title={ko.orders.dashboard.title}
        subtitle={ko.orders.dashboard.subtitle}
      />
      <V2Placeholder message={ko.orders.placeholder} />
    </div>
  )
}

export default OrdersDashboardPage
