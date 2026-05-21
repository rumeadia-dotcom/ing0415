/**
 * shipping (s8) 도메인 barrel — 본 PR (FE) 진입점.
 *
 * 라우터 등록은 PR1 (라우트 + 사이드바) 가 본 export 를 import 하여 수행한다.
 */

export { default as ShippingPrintPage } from './pages/ShippingPrintPage'
export { default as ShippingDispatchPage } from './pages/ShippingDispatchPage'
export { default as ShippingDispatchResultPage } from './pages/ShippingDispatchResultPage'
export { default as ShippingHistoryPage } from './pages/ShippingHistoryPage'

export { useShippingPrintList } from './hooks/useShippingPrintList'
export { useShippingDispatchPreview } from './hooks/useShippingDispatchPreview'
export { useShippingDispatchStart } from './hooks/useShippingDispatchStart'
export { useShippingJob } from './hooks/useShippingJob'
export { useShippingJobs } from './hooks/useShippingJobs'
export { useShippingJobRetry } from './hooks/useShippingJobRetry'
export { useMarkWaybillPrinted } from './hooks/useMarkWaybillPrinted'

export { ShippingApiError } from './api/shipping-api'
