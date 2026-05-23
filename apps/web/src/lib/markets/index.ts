import type { MarketId } from '@/lib/schemas'
import type { MarketAdapter } from './types'

/**
 * 마켓 어댑터 단일 진입.
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §4.1
 *
 * v1 정식 라인업 (2026-05-22 5마켓 확장 결정, 2026-05-23 mirror 갱신):
 *   - naver   (oauth)   : 활성. useMock=true → mock, useMock=false → real.
 *   - coupang (hmac)    : 활성. useMock=true → mock, useMock=false → real (gateway 경유).
 *   - gmarket (esm_jwt) : 활성. useMock=true → mock, useMock=false → real (gateway 경유).
 *   - auction (esm_jwt) : 활성. useMock=true → mock, useMock=false → real (gateway 경유).
 *   - 11st    (api_key) : 활성. useMock=true → mock, useMock=false → 클라이언트 측 real 어댑터
 *     아직 없음 (서버 측 stub 만 — Phase 4-B-2 Wave 1, PR #111). 클라이언트 직접 호출은
 *     `markets-connect` Edge Function 경유 → 본 함수 호출 발생 안 함. 단위 테스트 / 검증
 *     시나리오 등에서 직접 호출 시 명확한 에러로 throw.
 *
 * `authenticate` 의 input 은 4-way AuthInput discriminated union — 마켓별 kind 분기.
 *
 * **빌드 타임 분기 강제 (loop 사이클 2, 2026-05-23)**:
 *   `if (import.meta.env.VITE_USE_MOCK === 'true')` 패턴 사용 — vite 가 빌드 시점에
 *   env 값을 inline 후 minifier 가 dead branch elimination. real 빌드의 dist 에
 *   mock 어댑터 chunk 가 포함되지 않도록 보장.
 *   - env.ts 의 `useMock` runtime 변수는 다른 위치 (가드 / 로깅) 에서만 사용.
 *   - 본 함수 외 위치에서 `useMock` / `import.meta.env.VITE_USE_MOCK` 로 어댑터
 *     본체를 분기하는 패턴은 PR 차단.
 */
export async function getMarketAdapter(market: MarketId): Promise<MarketAdapter> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    switch (market) {
      case 'naver': {
        const { naverDebugAdapter } = await import('./debug/NaverDebugAdapter')
        return naverDebugAdapter
      }
      case 'coupang': {
        const { coupangDebugAdapter } = await import('./debug/CoupangDebugAdapter')
        return coupangDebugAdapter
      }
      case 'gmarket': {
        const { gmarketDebugAdapter } = await import('./debug/GmarketDebugAdapter')
        return gmarketDebugAdapter
      }
      case 'auction': {
        const { auctionDebugAdapter } = await import('./debug/AuctionDebugAdapter')
        return auctionDebugAdapter
      }
      case '11st': {
        const { elevenstDebugAdapter } = await import('./debug/ElevenstDebugAdapter')
        return elevenstDebugAdapter
      }
    }
  }

  // real 모드: 구현된 마켓별 real 어댑터 dynamic import.
  switch (market) {
    case 'coupang': {
      const { coupangRealAdapter } = await import('./real/coupang')
      return coupangRealAdapter
    }
    case 'naver': {
      // C-1 Phase 1: 스켈레톤 + token exchange + refresh.
      // - authenticate(oauth_code) 는 의도적으로 차단 — 실 OAuth code exchange 는
      //   Edge Function `markets-oauth-callback/naver.ts` 가 권위.
      // - refreshToken / fetchCategoryTree / transformProduct / createProduct 는
      //   클라이언트에서 직접 호출 가능 (단위 테스트, silent refresh 시나리오).
      const { naverRealAdapter } = await import('./real/naver')
      return naverRealAdapter
    }
    case 'gmarket': {
      const { gmarketRealAdapter } = await import('./real/gmarket')
      return gmarketRealAdapter
    }
    case 'auction': {
      const { auctionRealAdapter } = await import('./real/auction')
      return auctionRealAdapter
    }
    case '11st':
      // 클라이언트 측 11번가 real 어댑터 = 서버 stub 동치 (Phase 4-B-2 Wave 2 에서 본격
      // 구현 예정). 클라이언트 직접 호출은 일반적으로 발생하지 않음 (markets-connect
      // Edge Function 경유). 단위 테스트 / 검증 시나리오 등에서 직접 호출 시 명확한 에러.
      throw new Error(
        `11번가 real 어댑터 클라이언트 미구현 — 자격증명 등록은 Edge Function (markets-connect) 사용`,
      )
    default:
      throw new Error(
        `real 모드 마켓 어댑터(${market}) 미구현`,
      )
  }
}

export type { MarketAdapter } from './types'
export { MarketError } from './errors'
export type { MarketErrorCode, MarketErrorContext } from './errors'
