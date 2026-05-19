/**
 * 한국어 사전 (i18n 진입점).
 * 마스터: docs/architecture/v1/frontend.md §14
 *
 * - 모든 사용자 노출 텍스트는 본 객체의 path 로 참조한다 (하드코딩 금지).
 * - `t()` 헬퍼는 Stage 후속에서 도입. 본 Stage 는 객체 path 직접 접근.
 * - 1000줄 초과 시 도메인별 분할 (`src/locales/ko/<domain>.ts`).
 */

export const ko = {
  app: {
    name: 'MarketCast',
  },
  nav: {
    main: '메인',
    aux: '보조',
    dashboard: '대시보드',
    register: '상품 등록',
    markets: '마켓 계정',
    history: '등록 이력',
    settings: '설정',
    help: '도움말',
  },
  status: {
    pending: '대기',
    running: '진행 중',
    partial: '일부 성공',
    succeeded: '성공',
    failed: '실패',
    retrying: '재시도',
    cancelled: '취소',
  },
  market: {
    naver: '네이버 스마트스토어',
    coupang: '쿠팡',
    '11st': '11번가',
    gmarket: 'G마켓',
    auction: '옥션',
  },
  marketStatus: {
    ready: '연결 가능',
    coming_soon: '오픈 준비중',
  },
} as const

export type Locale = typeof ko
