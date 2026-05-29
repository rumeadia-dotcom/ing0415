import type { MarketId } from '@/lib/schemas/common'

/**
 * 안심번호(가상번호, 050…) 정책이 적용되는 마켓 목록.
 *
 * 배경:
 *  - 쿠팡 v5 OpenAPI (2026 도입) 부터 셀러에게 수취인의 실 전화번호 대신
 *    `safeNumber` (050 시작 가상번호) 만 내려준다.
 *    `apps/web/src/lib/markets/real/coupang/orders.ts` 의 hybrid mapping 참고
 *    (`receiver.safeNumber > receiver.receiverNumber > v4 receiverPhoneNumber`).
 *  - UI 측에서는 셀러가 "수취인 전화로 보이는데 통화 시 050 으로 연결되는" 혼동을
 *    피하도록 안심번호 배지/툴팁으로 안내한다.
 *
 * 확장 시 주의:
 *  - 다른 마켓 (네이버 / 11번가 / G마켓 / 옥션) 도 동일 정책을 도입하면
 *    이 배열에 추가하면 자동으로 OrderDetailPage 에서 SafeNumberBadge 가 노출된다.
 *  - 단순 lookup 이므로 hot path 영향 없음.
 */
const SAFE_NUMBER_MARKETS: readonly MarketId[] = ['coupang']

/**
 * 주어진 마켓이 안심번호(가상번호) 정책을 사용하는지 여부.
 *
 * @example
 *   isSafeNumberMarket('coupang') // → true
 *   isSafeNumberMarket('naver')   // → false
 */
export function isSafeNumberMarket(market: MarketId): boolean {
  return SAFE_NUMBER_MARKETS.includes(market)
}
