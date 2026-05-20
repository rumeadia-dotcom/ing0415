// Mock data for the app
window.AppData = {
  user: {
    name: '김민지',
    email: 'minji.kim@konai.com',
    initials: 'KM',
    company: '코나이 커머스',
  },

  markets: [
    { id: 'naver',   name: '네이버 스마트스토어', short: 'N',  color: '#03C75A', accounts: 2, status: 'connected' },
    { id: '11st',    name: '11번가',          short: '11', color: '#FF0038', accounts: 1, status: 'connected' },
    { id: 'gmarket', name: 'G마켓',           short: 'G',  color: '#00B147', accounts: 1, status: 'connected' },
    { id: 'auction', name: '옥션',            short: 'A',  color: '#E73936', accounts: 1, status: 'expired'   },
    { id: 'coupang', name: '쿠팡',            short: 'C',  color: '#F11F44', accounts: 0, status: 'disconnected' },
  ],

  // Dashboard stats
  stats: {
    totalProducts: 1284,
    monthlyRegistered: 142,
    successRate: 96.4,
    pendingErrors: 5,
  },

  // Recent registrations
  recent: [
    { id: 'p-201', name: '오가닉 코튼 라운드 티셔츠 (네이비)', sku: 'OCT-NV-001', markets: ['naver','11st','gmarket','coupang'], time: '방금 전', status: 'success', count: 4 },
    { id: 'p-200', name: '프리미엄 스테인리스 텀블러 500ml', sku: 'PST-500', markets: ['naver','11st','auction'], time: '4분 전', status: 'partial', count: 2, fail: 1 },
    { id: 'p-199', name: '미니멀 가죽 카드지갑 - 브라운', sku: 'MLW-BR', markets: ['naver','gmarket'], time: '23분 전', status: 'success', count: 2 },
    { id: 'p-198', name: '무선 블루투스 이어버드 Pro X', sku: 'WBE-PRO', markets: ['naver','11st','coupang','gmarket'], time: '1시간 전', status: 'success', count: 4 },
    { id: 'p-197', name: '데일리 백팩 15L (그레이)', sku: 'DBP-GR', markets: ['naver','11st'], time: '2시간 전', status: 'pending', count: 0 },
    { id: 'p-196', name: '아로마 디퓨저 베이직 100ml', sku: 'AD-100', markets: ['naver','coupang','gmarket','auction'], time: '3시간 전', status: 'failed', count: 0, fail: 4 },
  ],

  // History
  history: [
    { id: 'h-3201', date: '2026-05-18 14:32', name: '오가닉 코튼 라운드 티셔츠', markets: 4, success: 4, fail: 0, by: '김민지' },
    { id: 'h-3200', date: '2026-05-18 14:28', name: '프리미엄 스테인리스 텀블러', markets: 3, success: 2, fail: 1, by: '김민지' },
    { id: 'h-3199', date: '2026-05-18 14:09', name: '미니멀 가죽 카드지갑', markets: 2, success: 2, fail: 0, by: '박지훈' },
    { id: 'h-3198', date: '2026-05-18 13:32', name: '무선 블루투스 이어버드', markets: 4, success: 4, fail: 0, by: '김민지' },
    { id: 'h-3197', date: '2026-05-18 12:30', name: '데일리 백팩 15L', markets: 2, success: 0, fail: 0, by: '김민지' },
    { id: 'h-3196', date: '2026-05-18 11:08', name: '아로마 디퓨저 베이직', markets: 4, success: 0, fail: 4, by: '박지훈' },
    { id: 'h-3195', date: '2026-05-17 18:22', name: '실리콘 주방 도구 세트', markets: 3, success: 3, fail: 0, by: '김민지' },
    { id: 'h-3194', date: '2026-05-17 17:15', name: '캠핑 머그 350ml', markets: 5, success: 5, fail: 0, by: '이수영' },
    { id: 'h-3193', date: '2026-05-17 16:40', name: '겨울 패딩 자켓 (블랙)', markets: 4, success: 3, fail: 1, by: '이수영' },
    { id: 'h-3192', date: '2026-05-17 15:08', name: '아쿠아 핸드크림 50ml', markets: 3, success: 3, fail: 0, by: '김민지' },
  ],

  // Templates
  templates: [
    { id: 't1', name: '의류 - 봄/여름 기본형',     items: 12, markets: ['naver','11st','gmarket','coupang'], updated: '2일 전', cat: '의류',     thumb: 'v2' },
    { id: 't2', name: '주방용품 - 프리미엄 라인',  items: 8,  markets: ['naver','coupang'],                  updated: '1주 전', cat: '주방',     thumb: 'v1' },
    { id: 't3', name: '디지털 가전 - 이어폰/스피커', items: 6,  markets: ['naver','11st','gmarket','coupang','auction'], updated: '3주 전', cat: '디지털', thumb: 'v4' },
    { id: 't4', name: '뷰티 - 스킨케어 베이직',    items: 15, markets: ['naver','11st','coupang'],           updated: '1개월 전', cat: '뷰티',     thumb: 'v3' },
    { id: 't5', name: '식품 - 프리미엄 선물세트',   items: 4,  markets: ['naver','gmarket','coupang'],         updated: '1개월 전', cat: '식품',     thumb: 'v5' },
  ],
};
