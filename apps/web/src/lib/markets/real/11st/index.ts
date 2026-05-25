/**
 * 11번가 Open API real 어댑터 (프론트엔드 / Vite 환경) — **scaffold**.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (5마켓 매트릭스)
 *   - docs/architecture/v1/features/markets.md §3 (활성 마켓)
 *   - apps/api/supabase/functions/_shared/market-adapters/eleven-st.ts (Edge Function 측)
 *
 * 인증 방식: API Key (credential kind = 'api_key').
 *   - refreshToken 없음 (영구 키).
 *   - authenticate = 자격증명 검증 후 StoredCredential 저장 (API 호출 없이).
 *
 * API 기반:
 *   - ELEVEN_ST_API_BASE = https://openapi.11st.co.kr/openapi/OpenApiService.tmall
 *   - 호출 형식: ?key=<API_KEY>&apiCode=<CODE>&<params> (또는 `openapikey` 헤더)
 *   - 응답 format: XML (CP949 인코딩)
 *   - 모든 호출은 AWS Lightsail Market Gateway 경유 (고정 IP 등록 필수)
 *
 * **현재 상태 (scaffold, 2026-05-25)**:
 *   - authenticate 만 동작 (자격증명 검증 + 저장. 네트워크 호출 없음).
 *   - 5메서드 인터페이스 정합 — `getMarketAdapter('11st')` 에서 throw 하지 않음.
 *   - fetchCategoryTree / transformProduct / createProduct 는 spec 부족으로
 *     명시적 MarketError throw → markets-connect 의 category_ping_failed
 *     단계에서 "11번가 어댑터는 정식 API 문서 확보 후 활성화" 안내 표시.
 *
 * **본격 구현 (별도 PR, spec 입수 후)**:
 *   - 11번가 Seller API 의 정확한 apiCode 이름 확보 (상품 등록 / 수정 / 카테고리 /
 *     주문 / 송장)
 *   - 요청 query string + 응답 XML root element 매핑
 *   - CP949 → UTF-8 디코딩 + XML 파싱 (DOMParser 또는 fast-xml-parser)
 *   - 에러 코드 → MarketErrorCode 매핑
 *   - 단위 테스트 (fetch mock) + 통합 검증 (실 키 + Lightsail Gateway 경유)
 */

import { MarketError } from '../../errors'
import type { MarketAdapter } from '../../types'
import {
  ApiKeyAuthInputSchema,
  StoredCredentialSchema,
  type AuthInput,
  type CategoryNode,
  type CreateProductResult,
  type FetchOrdersInput,
  type MarketMapping,
  type MarketOrder,
  type MarketPayload,
  type MarketSubmitTrackingResult,
  type Product,
  type StoredCredential,
  type SubmitTrackingInput,
} from '@/lib/schemas'

const MARKET = '11st' as const

/** 11번가 OpenAPI 정식 endpoint base — gateway 화이트리스트 정합. */
export const ELEVEN_ST_API_BASE =
  'https://openapi.11st.co.kr/openapi/OpenApiService.tmall'

/** 본 어댑터의 5메서드 중 spec 미확보 부분이 throw 하는 표준 에러. */
function specPendingError(method: string): MarketError {
  return new MarketError(
    'unknown',
    `11번가 어댑터 ${method} — 정식 API spec 확보 후 별도 PR 에서 구현 예정 (markets.md §3 / WIP §1)`,
    { market: MARKET, marketErrorCode: 'adapter_spec_pending' },
  )
}

interface ApiKeyCred {
  apiKey: string
}

function createElevenStRealAdapter(): MarketAdapter {
  let cred: ApiKeyCred | null = null

  return {
    market: MARKET,
    credentialKind: 'api_key',

    // ───────────────────────────────────────────
    // authenticate — API 호출 없이 자격증명 검증 + 저장
    // ───────────────────────────────────────────
    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (input.kind !== 'api_key') {
        throw new MarketError(
          'validation',
          `11번가: api_key 입력 필요 (받은 kind: ${input.kind})`,
          { market: MARKET },
        )
      }

      const parsed = ApiKeyAuthInputSchema.safeParse(input)
      if (!parsed.success) {
        throw new MarketError(
          'validation',
          `11번가: 자격증명 형식 오류 — ${parsed.error.message}`,
          { market: MARKET, cause: parsed.error },
        )
      }

      cred = { apiKey: parsed.data.apiKey }

      return StoredCredentialSchema.parse({
        kind: 'api_key',
        payload: { apiKey: parsed.data.apiKey },
      })
    },

    // ───────────────────────────────────────────
    // refreshToken 없음 (영구 키) — 인터페이스 optional 준수
    // ───────────────────────────────────────────

    // ───────────────────────────────────────────
    // fetchCategoryTree — spec 미확보 (Seller API 카테고리 apiCode 확인 필요)
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      void cred
      throw specPendingError('fetchCategoryTree')
    },

    // ───────────────────────────────────────────
    // transformProduct — spec 미확보 (상품 등록 XML payload schema 필요)
    // ───────────────────────────────────────────
    transformProduct(_product: Product, _mapping: MarketMapping): MarketPayload {
      throw specPendingError('transformProduct')
    },

    // ───────────────────────────────────────────
    // createProduct — spec 미확보 (apiCode + endpoint 확정 후)
    // ───────────────────────────────────────────
    async createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
      throw specPendingError('createProduct')
    },

    // ───────────────────────────────────────────
    // v2 Extension — fetchOrders / submitTracking (spec 미확보)
    // ───────────────────────────────────────────
    async fetchOrders(
      _input: FetchOrdersInput,
      _credential?: StoredCredential,
    ): Promise<MarketOrder[]> {
      throw specPendingError('fetchOrders')
    },

    async submitTracking(
      _input: SubmitTrackingInput,
      _credential?: StoredCredential,
    ): Promise<MarketSubmitTrackingResult> {
      throw specPendingError('submitTracking')
    },
  }
}

export const elevenstRealAdapter: MarketAdapter = createElevenStRealAdapter()
