/**
 * 네이버 Commerce API submitTracking (v2 확장).
 *
 * 본 파일은 `./orders.ts` 의 `naverSubmitTracking` 을 그대로 re-export 한다.
 * fetchOrders / submitTracking 은 같은 OAuth 인증 + 같은 fetch wrapper 를 공유하므로
 * orders.ts 단일 모듈에 본문이 있고, tracking.ts 는 호출측 import 경로 일관성을 위한
 * thin wrapper.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.4
 */

export { naverSubmitTracking } from './orders'
