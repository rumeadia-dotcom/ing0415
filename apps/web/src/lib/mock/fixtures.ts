/**
 * dev + useMock=true 시 사용되는 in-memory 데이터.
 *
 * 모든 화면이 빈 상태가 아닌 "데이터가 채워진" UI 를 노출할 수 있도록 셀러 1명 +
 * 4 마켓 연결 + 상품 5개 + 등록잡 3개 + 주문 8개 + 배송잡 2개 + 로젠 자격증명 등록 상태.
 *
 * fixtures 는 mutable. 가입/연결/등록 액션이 일어나면 in-place 로 수정 (mock client 가 처리).
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

const NOW = new Date('2026-05-22T09:00:00+09:00')
const ISO = (d: Date) => d.toISOString()
const minutesAgo = (m: number) => ISO(new Date(NOW.getTime() - m * 60_000))
const daysAgo = (d: number) => ISO(new Date(NOW.getTime() - d * 86_400_000))

export const MOCK_SELLER_ID = '00000000-0000-4000-8000-000000000001'
export const MOCK_SELLER_EMAIL = 'mock@local'
export const MOCK_SELLER_DISPLAY_NAME = 'Mock Seller'

export const mockSellerUser = {
  id: MOCK_SELLER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: MOCK_SELLER_EMAIL,
  email_confirmed_at: daysAgo(30),
  phone: '',
  confirmed_at: daysAgo(30),
  last_sign_in_at: minutesAgo(2),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {
    display_name: MOCK_SELLER_DISPLAY_NAME,
    marketing_consent: false,
  },
  identities: [],
  created_at: daysAgo(30),
  updated_at: minutesAgo(2),
}

export const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(NOW.getTime() / 1000) + 3600,
  user: mockSellerUser,
}

// 마켓 계정 4개 (네이버 / 쿠팡 / G마켓 / 옥션 모두 active)
export const mockMarketAccounts = [
  {
    id: '00000000-0000-4000-8000-000000001001',
    seller_id: MOCK_SELLER_ID,
    market_id: 'naver',
    account_label: '네이버 스마트스토어 — 메인',
    external_account_id: 'mock-naver-seller-001',
    status: 'active',
    connected_at: daysAgo(20),
    last_verified_at: minutesAgo(15),
    last_error_code: null,
    last_error_at: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001002',
    seller_id: MOCK_SELLER_ID,
    market_id: 'coupang',
    account_label: '쿠팡 윙 — 본사',
    external_account_id: 'A00001234',
    status: 'active',
    connected_at: daysAgo(18),
    last_verified_at: minutesAgo(30),
    last_error_code: null,
    last_error_at: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001003',
    seller_id: MOCK_SELLER_ID,
    market_id: 'gmarket',
    account_label: 'G마켓 ESM',
    external_account_id: 'gmarket-master-007',
    status: 'active',
    connected_at: daysAgo(15),
    last_verified_at: minutesAgo(60),
    last_error_code: null,
    last_error_at: null,
  },
  {
    id: '00000000-0000-4000-8000-000000001004',
    seller_id: MOCK_SELLER_ID,
    market_id: 'auction',
    account_label: '옥션 ESM',
    external_account_id: 'auction-master-007',
    status: 'active',
    connected_at: daysAgo(15),
    last_verified_at: minutesAgo(60),
    last_error_code: null,
    last_error_at: null,
  },
]

// 상품 5개
export const mockProducts = [
  {
    id: '00000000-0000-4000-8000-000000002001',
    seller_id: MOCK_SELLER_ID,
    name: '프리미엄 스테인리스 텀블러 500ml',
    price: 18900,
    category: 'kitchen',
    created_at: daysAgo(12),
    updated_at: daysAgo(2),
  },
  {
    id: '00000000-0000-4000-8000-000000002002',
    seller_id: MOCK_SELLER_ID,
    name: '무선 블루투스 이어버드 Pro',
    price: 49000,
    category: 'electronics',
    created_at: daysAgo(10),
    updated_at: daysAgo(1),
  },
  {
    id: '00000000-0000-4000-8000-000000002003',
    seller_id: MOCK_SELLER_ID,
    name: '오가닉 코튼 베이비 블랭킷',
    price: 32000,
    category: 'baby',
    created_at: daysAgo(8),
    updated_at: daysAgo(8),
  },
  {
    id: '00000000-0000-4000-8000-000000002004',
    seller_id: MOCK_SELLER_ID,
    name: '미니멀 가죽 카드 지갑',
    price: 25000,
    category: 'fashion',
    created_at: daysAgo(5),
    updated_at: daysAgo(3),
  },
  {
    id: '00000000-0000-4000-8000-000000002005',
    seller_id: MOCK_SELLER_ID,
    name: '아로마 디퓨저 + 리필 세트',
    price: 39800,
    category: 'lifestyle',
    created_at: daysAgo(3),
    updated_at: minutesAgo(180),
  },
]

// 등록잡 3개 (각각 different status)
export const mockRegistrationJobs = [
  {
    id: '00000000-0000-4000-8000-000000003001',
    seller_id: MOCK_SELLER_ID,
    product_id: mockProducts[0]!.id,
    product_name: mockProducts[0]!.name,
    status: 'succeeded',
    target_markets: ['naver', 'coupang', 'gmarket', 'auction'],
    total_count: 4,
    succeeded_count: 4,
    failed_count: 0,
    created_at: daysAgo(2),
    completed_at: daysAgo(2),
  },
  {
    id: '00000000-0000-4000-8000-000000003002',
    seller_id: MOCK_SELLER_ID,
    product_id: mockProducts[1]!.id,
    product_name: mockProducts[1]!.name,
    status: 'partial',
    target_markets: ['naver', 'coupang', 'gmarket'],
    total_count: 3,
    succeeded_count: 2,
    failed_count: 1,
    created_at: daysAgo(1),
    completed_at: daysAgo(1),
  },
  {
    id: '00000000-0000-4000-8000-000000003003',
    seller_id: MOCK_SELLER_ID,
    product_id: mockProducts[4]!.id,
    product_name: mockProducts[4]!.name,
    status: 'running',
    target_markets: ['naver', 'coupang', 'gmarket', 'auction'],
    total_count: 4,
    succeeded_count: 1,
    failed_count: 0,
    created_at: minutesAgo(10),
    completed_at: null,
  },
]

// 등록잡 마켓별 결과 (1:N)
export const mockRegistrationJobMarketResults = [
  // job 1 — all succeeded
  ...['naver', 'coupang', 'gmarket', 'auction'].map((m, i) => ({
    id: `00000000-0000-4000-8000-00000000400${i + 1}`,
    job_id: mockRegistrationJobs[0]!.id,
    market_id: m,
    status: 'succeeded',
    external_product_id: `${m}-product-${1000 + i}`,
    error_code: null,
    error_message: null,
    started_at: daysAgo(2),
    completed_at: daysAgo(2),
  })),
  // job 2 — partial (1 failed)
  {
    id: '00000000-0000-4000-8000-000000004005',
    job_id: mockRegistrationJobs[1]!.id,
    market_id: 'naver',
    status: 'succeeded',
    external_product_id: 'naver-product-1004',
    error_code: null,
    error_message: null,
    started_at: daysAgo(1),
    completed_at: daysAgo(1),
  },
  {
    id: '00000000-0000-4000-8000-000000004006',
    job_id: mockRegistrationJobs[1]!.id,
    market_id: 'coupang',
    status: 'succeeded',
    external_product_id: 'A00001234-product-1005',
    error_code: null,
    error_message: null,
    started_at: daysAgo(1),
    completed_at: daysAgo(1),
  },
  {
    id: '00000000-0000-4000-8000-000000004007',
    job_id: mockRegistrationJobs[1]!.id,
    market_id: 'gmarket',
    status: 'failed',
    external_product_id: null,
    error_code: 'CATEGORY_INVALID',
    error_message: 'G마켓 카테고리 코드가 유효하지 않습니다 (mock)',
    started_at: daysAgo(1),
    completed_at: daysAgo(1),
  },
  // job 3 — running (1 succeeded, others pending)
  {
    id: '00000000-0000-4000-8000-000000004008',
    job_id: mockRegistrationJobs[2]!.id,
    market_id: 'naver',
    status: 'succeeded',
    external_product_id: 'naver-product-1006',
    error_code: null,
    error_message: null,
    started_at: minutesAgo(10),
    completed_at: minutesAgo(5),
  },
  ...['coupang', 'gmarket', 'auction'].map((m, i) => ({
    id: `00000000-0000-4000-8000-00000000400${9 + i}`,
    job_id: mockRegistrationJobs[2]!.id,
    market_id: m,
    status: 'running',
    external_product_id: null,
    error_code: null,
    error_message: null,
    started_at: minutesAgo(10),
    completed_at: null,
  })),
]

// 주문 8개 (다양한 status)
export const mockOrders = [
  {
    id: '00000000-0000-4000-8000-000000005001',
    seller_id: MOCK_SELLER_ID,
    market_id: 'naver',
    external_order_id: 'NV20260520-001',
    buyer_name: '김민준',
    product_name: mockProducts[0]!.name,
    quantity: 2,
    total_price: 37800,
    status: 'collected',
    waybill_number: null,
    collected_at: minutesAgo(120),
    created_at: minutesAgo(120),
  },
  {
    id: '00000000-0000-4000-8000-000000005002',
    seller_id: MOCK_SELLER_ID,
    market_id: 'coupang',
    external_order_id: 'CP20260520-001',
    buyer_name: '이서연',
    product_name: mockProducts[1]!.name,
    quantity: 1,
    total_price: 49000,
    status: 'logen_registered',
    waybill_number: '5612-3412-9923',
    collected_at: minutesAgo(180),
    logen_registered_at: minutesAgo(150),
    created_at: minutesAgo(180),
  },
  {
    id: '00000000-0000-4000-8000-000000005003',
    seller_id: MOCK_SELLER_ID,
    market_id: 'gmarket',
    external_order_id: 'GM20260520-001',
    buyer_name: '박지호',
    product_name: mockProducts[2]!.name,
    quantity: 1,
    total_price: 32000,
    status: 'waybill_printed',
    waybill_number: '5612-3412-9924',
    collected_at: minutesAgo(240),
    logen_registered_at: minutesAgo(210),
    created_at: minutesAgo(240),
  },
  {
    id: '00000000-0000-4000-8000-000000005004',
    seller_id: MOCK_SELLER_ID,
    market_id: 'auction',
    external_order_id: 'AU20260520-001',
    buyer_name: '최예원',
    product_name: mockProducts[3]!.name,
    quantity: 3,
    total_price: 75000,
    status: 'tracking_submitted',
    waybill_number: '5612-3412-9925',
    collected_at: daysAgo(1),
    logen_registered_at: daysAgo(1),
    created_at: daysAgo(1),
  },
  {
    id: '00000000-0000-4000-8000-000000005005',
    seller_id: MOCK_SELLER_ID,
    market_id: 'naver',
    external_order_id: 'NV20260519-007',
    buyer_name: '정하윤',
    product_name: mockProducts[4]!.name,
    quantity: 1,
    total_price: 39800,
    status: 'tracking_submitted',
    waybill_number: '5612-3412-9926',
    collected_at: daysAgo(2),
    logen_registered_at: daysAgo(2),
    created_at: daysAgo(2),
  },
  {
    id: '00000000-0000-4000-8000-000000005006',
    seller_id: MOCK_SELLER_ID,
    market_id: 'coupang',
    external_order_id: 'CP20260518-022',
    buyer_name: '강도윤',
    product_name: mockProducts[0]!.name,
    quantity: 1,
    total_price: 18900,
    status: 'logen_failed',
    waybill_number: null,
    collected_at: daysAgo(3),
    created_at: daysAgo(3),
  },
  {
    id: '00000000-0000-4000-8000-000000005007',
    seller_id: MOCK_SELLER_ID,
    market_id: 'gmarket',
    external_order_id: 'GM20260518-014',
    buyer_name: '윤서아',
    product_name: mockProducts[2]!.name,
    quantity: 2,
    total_price: 64000,
    status: 'collected',
    waybill_number: null,
    collected_at: minutesAgo(45),
    created_at: minutesAgo(45),
  },
  {
    id: '00000000-0000-4000-8000-000000005008',
    seller_id: MOCK_SELLER_ID,
    market_id: 'auction',
    external_order_id: 'AU20260520-003',
    buyer_name: '홍준우',
    product_name: mockProducts[4]!.name,
    quantity: 1,
    total_price: 39800,
    status: 'collected',
    waybill_number: null,
    collected_at: minutesAgo(20),
    created_at: minutesAgo(20),
  },
]

// 배송잡 2개 — shipping_jobs_with_summary view 형태 (view 컬럼 포함)
interface MockShippingJob {
  id: string
  seller_id: string
  order_ids: string[]
  status: string
  order_count: number
  total_orders: number
  retry_count: number
  parent_job_id: string | null
  success_count: number
  failed_count: number
  market_ids: string[]
  error_summary: string | null
  started_at: string | null
  created_at: string
  completed_at: string | null
}

export const mockShippingJobs: MockShippingJob[] = [
  {
    id: '00000000-0000-4000-8000-000000006001',
    seller_id: MOCK_SELLER_ID,
    order_ids: [mockOrders[1]!.id, mockOrders[2]!.id, mockOrders[3]!.id],
    status: 'succeeded',
    order_count: 3,
    total_orders: 3,
    retry_count: 0,
    parent_job_id: null,
    success_count: 3,
    failed_count: 0,
    market_ids: ['coupang', 'gmarket', 'auction'],
    error_summary: null,
    started_at: daysAgo(1),
    created_at: daysAgo(1),
    completed_at: daysAgo(1),
  },
  {
    id: '00000000-0000-4000-8000-000000006002',
    seller_id: MOCK_SELLER_ID,
    order_ids: [mockOrders[4]!.id],
    status: 'running',
    order_count: 1,
    total_orders: 1,
    retry_count: 0,
    parent_job_id: null,
    success_count: 0,
    failed_count: 0,
    market_ids: ['naver'],
    error_summary: null,
    started_at: minutesAgo(5),
    created_at: minutesAgo(5),
    completed_at: null,
  },
]

export const mockShippingJobMarketResults = [
  // job 1 — 3 orders, all succeeded
  ...mockShippingJobs[0]!.order_ids.map((oid, i) => {
    const order = mockOrders.find((o) => o.id === oid)!
    return {
      id: `00000000-0000-4000-8000-00000000700${i + 1}`,
      job_id: mockShippingJobs[0]!.id,
      order_id: oid,
      market_id: order.market_id,
      status: 'succeeded',
      submitted_at: daysAgo(1),
      error_code: null,
      error_message: null,
    }
  }),
  // job 2 — running
  {
    id: '00000000-0000-4000-8000-000000007004',
    job_id: mockShippingJobs[1]!.id,
    order_id: mockShippingJobs[1]!.order_ids[0],
    market_id: 'naver',
    status: 'running',
    submitted_at: null,
    error_code: null,
    error_message: null,
  },
]

// 배송 정책 (상품 등록 시 선택하는 fee preset)
export const mockShippingPolicies = [
  {
    id: '00000000-0000-4000-8000-000000008001',
    seller_id: MOCK_SELLER_ID,
    name: '무료배송',
    fee: 0,
    method: 'parcel',
    eta_days: 2,
    is_default: true,
    created_at: daysAgo(30),
  },
  {
    id: '00000000-0000-4000-8000-000000008002',
    seller_id: MOCK_SELLER_ID,
    name: '기본 택배 (2,500원)',
    fee: 2500,
    method: 'parcel',
    eta_days: 2,
    is_default: false,
    created_at: daysAgo(30),
  },
  {
    id: '00000000-0000-4000-8000-000000008003',
    seller_id: MOCK_SELLER_ID,
    name: '빠른 배송 (4,500원)',
    fee: 4500,
    method: 'parcel',
    eta_days: 1,
    is_default: false,
    created_at: daysAgo(20),
  },
]

// 셀러 자동 송장 제출 토글 + 발송인 정보 (별도 hook 으로 노출)
export const mockSellerShippingSettings = {
  seller_id: MOCK_SELLER_ID,
  auto_dispatch_enabled: true,
  sender_name: '목 셀러',
  sender_phone: '010-1234-5678',
  sender_address: '서울특별시 강남구 테헤란로 123, 4층',
  default_courier: 'logen',
  updated_at: daysAgo(10),
}

// 로젠 자격증명 등록 상태 (LogenCredentialsStatusSchema 매핑)
// 평문 자격증명은 절대 포함 X — hasCredentials 등 메타만.
export const mockLogenCredentials = {
  hasCredentials: true,
  hasSenderInfo: true,
  lastVerifiedAt: daysAgo(5),
  lastErrorAt: null as string | null,
  lastErrorCode: null as string | null,
  senderInfo: {
    name: '목 셀러',
    address: '서울특별시 강남구 테헤란로 123, 4층',
    phone: '010-1234-5678',
    fareTy: 'C' as const,
    dlvFare: 0,
  },
}

// 대시보드 요약 — DashboardSummarySchema 매핑
export const mockDashboardSummary = {
  seller_id: MOCK_SELLER_ID,
  jobs_today_count: 3,
  jobs_in_progress_count: 1,
  jobs_24h_count: 4,
  jobs_24h_succeeded: 2,
  jobs_24h_partial: 1,
  jobs_24h_failed: 0,
  jobs_7d_count: 12,
  jobs_7d_succeeded: 9,
  jobs_7d_partial: 2,
  jobs_7d_failed: 1,
  jobs_30d_count: 38,
  avg_duration_sec_7d: 42,
  last_job_at: minutesAgo(10),
}
