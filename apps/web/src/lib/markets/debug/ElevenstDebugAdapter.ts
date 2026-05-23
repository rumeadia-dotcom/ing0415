import { MarketError } from '../errors'
import type { MarketAdapter } from '../types'
import type {
  AuthInput,
  CategoryNode,
  CreateProductResult,
  FetchOrdersInput,
  MarketMapping,
  MarketOrder,
  MarketPayload,
  MarketSubmitTrackingResult,
  Product,
  StoredCredential,
  SubmitTrackingInput,
} from '@/lib/schemas'

/**
 * 11번가 debug 어댑터 — Phase 4-B-2 Wave 2 본격 구현 대기 중 stub (2026-05-23 갱신).
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §9
 *
 * 2026-05-22 5마켓 정식 결정. Lightsail Gateway 고정 IP 도입으로 IP 화이트리스트
 * 정책 해결. 다만 11번가 Open API 정식 spec / endpoint / 응답 schema 확보가
 * 별도 작업 (Phase 4-B-2 Wave 2 후속 PR) — 본 stub 은 그 작업 전까지 5메서드
 * 인터페이스 호환만 보존.
 *
 * 서버 측: apps/api/supabase/functions/_shared/market-adapters/eleven-st.ts (PR #111).
 * credentialKind = 'api_key'. 5개 메서드 모두 즉시 throw.
 */

const MARKET = '11st' as const
const STUB_MESSAGE =
  '11번가 어댑터 stub — 정식 API spec 확보 후 별도 PR (Phase 4-B-2 Wave 2) 에서 본격 구현 예정'

export const elevenstDebugAdapter: MarketAdapter = {
  market: MARKET,
  credentialKind: 'api_key',
  authenticate(_input: AuthInput): Promise<StoredCredential> {
    throw new MarketError('validation', STUB_MESSAGE, { market: MARKET })
  },
  fetchCategoryTree(): Promise<CategoryNode[]> {
    throw new MarketError('validation', STUB_MESSAGE, { market: MARKET })
  },
  transformProduct(_product: Product, _mapping: MarketMapping): MarketPayload {
    throw new MarketError('validation', STUB_MESSAGE, { market: MARKET })
  },
  createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
    throw new MarketError('validation', STUB_MESSAGE, { market: MARKET })
  },
  fetchOrders(
    _input: FetchOrdersInput,
    _credential?: StoredCredential,
  ): Promise<MarketOrder[]> {
    throw new MarketError('validation', STUB_MESSAGE, { market: MARKET })
  },
  submitTracking(
    _input: SubmitTrackingInput,
    _credential?: StoredCredential,
  ): Promise<MarketSubmitTrackingResult> {
    throw new MarketError('validation', STUB_MESSAGE, { market: MARKET })
  },
}
