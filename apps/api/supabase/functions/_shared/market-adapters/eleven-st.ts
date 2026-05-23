/**
 * 11번가 Open API real 어댑터 (Edge Function / Deno 측) — **Stub**.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9
 *   - WIP-5markets-mvp.md C-5 Phase 4-B-2 (2026-05-23 신설)
 *
 * 인증 방식: API Key (credential kind = 'api_key').
 *   - refreshToken 없음 (영구 키).
 *   - authenticate = 클라이언트가 입력한 API Key 를 StoredCredential 로 저장
 *     (실 검증 호출 없음. 정식 spec 정의 시점에 ping endpoint 로 보강 예정).
 *
 * **현재 상태 (Stub)**:
 *   - 11번가 Open API 정식 spec / endpoint / 응답 schema 미확보.
 *   - authenticate 만 동작 (자격증명 저장). 그 외 모든 메서드는 명확한
 *     MarketError 로 즉시 throw → markets-connect 의 category_ping_failed
 *     단계에서 사용자에게 "11번가 어댑터는 정식 API 문서 확보 후 활성화"
 *     안내 표시.
 *
 * **본격 구현 (별도 PR / Phase 4-B-2 후속)**:
 *   - 11번가 Open API 공식 문서 + 정식 발급 API Key 확보
 *   - 5메서드 본체 구현 (authenticate ping / fetchCategoryTree / transformProduct /
 *     createProduct)
 *   - 호출 URL = `https://api.11st.co.kr/...` (gateway 화이트리스트 등록 완료)
 *   - 단위 테스트 (인터페이스 정합) + 통합 검증 (IP 등록 + 정식 키 발급 후)
 */

import { MarketError } from '../errors.ts'
import type {
  AuthInput,
  CategoryNode,
  CreateProductResult,
  MarketMapping,
  MarketPayload,
  Product,
  StoredCredential,
} from '../schemas.ts'
import type { MarketAdapter } from '../market-adapter.ts'

const MARKET = '11st' as const

/** v1 stub — 본격 구현 시 endpoint 확정 */
export const ELEVEN_ST_API_BASE = 'https://api.11st.co.kr'

interface ApiKeyCred {
  apiKey: string
}

function stubError(method: string): MarketError {
  return new MarketError(
    'unauthorized',
    `11번가 어댑터 stub — ${method} 는 정식 API spec 확보 후 별도 PR 에서 구현 예정`,
    { market: MARKET, marketErrorCode: 'adapter_stub' },
  )
}

export function createElevenStAdapter(): MarketAdapter {
  let cred: ApiKeyCred | null = null

  return {
    market: MARKET,
    credentialKind: 'api_key',

    // ───────────────────────────────────────────
    // authenticate — API Key 저장만 (실 ping 미구현)
    // ───────────────────────────────────────────
    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (input.kind !== 'api_key') {
        throw new MarketError(
          'validation',
          `11번가: api_key 입력 필요 (받은 kind: ${input.kind})`,
          { market: MARKET },
        )
      }
      cred = { apiKey: input.apiKey }
      // StoredCredential 반환 — markets-connect 가 credential_payload jsonb 로 저장.
      return {
        kind: 'api_key',
        payload: { apiKey: input.apiKey },
        expiresAt: null,
      }
    },

    // ───────────────────────────────────────────
    // refreshToken — 영구 키라 미사용
    // ───────────────────────────────────────────
    // (인터페이스 optional. 본 stub 에서는 정의 자체 생략 — MarketAdapter optional)

    // ───────────────────────────────────────────
    // fetchCategoryTree — stub throw
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      // 호출 시 markets-connect 의 category_ping_failed → 사용자 UI 에서
      // [11번가] 자격증명은 확인되었지만 카테고리 조회에 실패했습니다 — 운영팀에 자동 알림
      // 으로 표시. 정식 spec 확보 후 본격 구현.
      void cred
      throw stubError('fetchCategoryTree')
    },

    // ───────────────────────────────────────────
    // transformProduct — stub throw
    // ───────────────────────────────────────────
    transformProduct(_product: Product, _mapping: MarketMapping): MarketPayload {
      throw stubError('transformProduct')
    },

    // ───────────────────────────────────────────
    // createProduct — stub throw
    // ───────────────────────────────────────────
    async createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
      throw stubError('createProduct')
    },
  }
}
