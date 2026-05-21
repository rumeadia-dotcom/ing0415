/**
 * orders 도메인 barrel (s7 — n47/n48/n49/n50).
 *
 * 라우터(`app/router.tsx`) 가 lazy import 로 page 만 참조.
 * 본 PR(v2-fe-orders) 은 라우트 wiring 을 포함하지 않는다 — PR1(v2-fe-shell) 에서 진행.
 */

export { OrdersDashboardPage } from './pages/OrdersDashboardPage'
export { OrdersListPage } from './pages/OrdersListPage'
export { OrderDetailPage } from './pages/OrderDetailPage'
export { OrderManualResolveDialog } from './components/OrderManualResolveDialog'

export { useOrders } from './hooks/useOrders'
export { useOrderDetail } from './hooks/useOrderDetail'
export { useOrdersSummary } from './hooks/useOrdersSummary'
export { useManualResolveWaybill } from './hooks/useManualResolveWaybill'

export { ordersQueryKeys } from './api/orders-api'
