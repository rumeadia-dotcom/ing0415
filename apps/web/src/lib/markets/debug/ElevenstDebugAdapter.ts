import { MarketError } from '../errors'
import type { MarketAdapter } from '../types'
import type {
  AuthInput,
  CategoryNode,
  CreateProductResult,
  MarketMapping,
  MarketPayload,
  Product,
  StoredCredential,
} from '@/lib/schemas'

/**
 * 11번가 debug 어댑터 — 11번가는 v1 미사용 (오픈 준비중) (인터페이스 호환 stub).
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §9
 *
 * 11번가는 API Key + IP 화이트리스트 정책. Supabase Edge Function 의 outbound IP 가
 * 동적이라 IP 화이트리스트 등록 경로 미해결 → 호출 불가. v2 이관 (2026-05-19 결정).
 *
 * v1 운영 경로에서는 UI 가 disabled 라 호출 자체가 차단되지만, 어댑터 인터페이스 호환
 * 보존을 위해 본 파일 유지. credentialKind = 'api_key'. 5개 메서드 모두 즉시 throw.
 */

const MARKET = '11st' as const
const NOT_IN_V1 =
  '11번가는 v1 미사용 (오픈 준비중) — v2 IP 화이트리스트 정책 해결 후'

export const elevenstDebugAdapter: MarketAdapter = {
  market: MARKET,
  credentialKind: 'api_key',
  authenticate(_input: AuthInput): Promise<StoredCredential> {
    throw new MarketError('validation', NOT_IN_V1, { market: MARKET })
  },
  fetchCategoryTree(): Promise<CategoryNode[]> {
    throw new MarketError('validation', NOT_IN_V1, { market: MARKET })
  },
  transformProduct(_product: Product, _mapping: MarketMapping): MarketPayload {
    throw new MarketError('validation', NOT_IN_V1, { market: MARKET })
  },
  createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
    throw new MarketError('validation', NOT_IN_V1, { market: MARKET })
  },
}
