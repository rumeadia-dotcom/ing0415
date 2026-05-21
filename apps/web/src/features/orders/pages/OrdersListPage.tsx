import { PageHeader } from '@/components/layout/PageHeader'
import { ko } from '@/locales/ko'
import { V2Placeholder } from '../components/V2Placeholder'

/**
 * OrdersListPage — /orders/list (s7 n48).
 * 마스터: docs/architecture/v2/features/orders.md §6.2.
 * PR1 (foundation): placeholder. PR8 가 필터 + 페이지네이션 + 행 클릭 → n49 navigate 로 교체.
 */
export function OrdersListPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader title={ko.orders.list.title} subtitle={ko.orders.list.subtitle} />
      <V2Placeholder message={ko.orders.placeholder} />
    </div>
  )
}

export default OrdersListPage
