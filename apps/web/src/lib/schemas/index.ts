/**
 * zod 스키마 단일 소스 barrel.
 *
 * 다른 모듈은 이 barrel 또는 개별 파일을 import 한다. 중복 export 충돌 방지 규약:
 *  - MarketId / MarketIdSchema 는 common.ts 만 소유 (market.ts 는 import 만).
 *  - MarketResultSchema (registration) ≠ JobMarketResultSchema (history-filter) — 분리.
 */
export * from './common'
export * from './market'
export * from './registration'
export * from './auth'
export * from './markets-feature'
export * from './dashboard-summary'
export * from './history-filter'
export * from './orders'
