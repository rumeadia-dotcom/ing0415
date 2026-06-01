/**
 * zod 스키마 단일 소스 barrel.
 *
 * 다른 모듈은 이 barrel 또는 개별 파일을 import 한다. 중복 export 충돌 방지 규약:
 *  - MarketId / MarketIdSchema 는 common.ts 만 소유 (market.ts 는 import 만).
 *  - MarketResultSchema (registration) ≠ JobMarketResultSchema (history-filter) — 분리.
 *  - ShippingMethodSchema 는 common.ts 에 정의, registration.ts 가 re-export — 둘 다 동일 바인딩
 *    이므로 barrel export * 에서 충돌 없음 (TypeScript re-export identity).
 *  - shipping.ts = 송장 일괄 제출(ShippingJob) 도메인.
 *    shipping-config.ts = 배송 설정 인라인(ShippingConfig) 도메인.
 */
export * from './common'
export * from './market'
export * from './esm'
export * from './registration'
export * from './auth'
export * from './markets-feature'
export * from './dashboard-summary'
export * from './history-filter'
export * from './orders'
export * from './shipping'
export * from './shipping-config'
export * from './shipping-policy'
export * from './logen'
export * from './market-orders'
