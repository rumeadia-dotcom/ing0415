import { QueryClient } from '@tanstack/react-query'

/**
 * TanStack Query 클라이언트 팩토리 (frontend.md §4).
 *
 * 기본 정책:
 *  - staleTime 30s — 대시보드 등 비교적 정적인 데이터 기본값
 *  - gcTime 5분 — 페이지 전환 후에도 캐시 유지
 *  - retry 1 — 일시 장애 한 번만 재시도. 마켓 API 재시도는 Edge Function 책임
 *  - refetchOnWindowFocus false — 포커스마다 refetch 는 등록 화면에 부적합
 *  - mutations retry 0 — mutation 은 사용자 의도, 자동 재시도 금지
 *
 * 도메인별 세부 staleTime (frontend.md §4.3) 은 각 hook 에서 override.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
