/**
 * MarketAdapter mock ↔ real 시그니처 parity 회귀 (testing.md §6.2 R-006).
 *
 * 목적: v2 확장 (fetchOrders + submitTracking) 추가 후에도 모든 활성 마켓의
 *       mock 어댑터와 real 어댑터가 동일 시그니처를 노출하는지 검증.
 *
 * 검증 항목:
 *   - 인터페이스 7 메서드 모두 존재 (createProduct 부터 submitTracking 까지).
 *   - market / credentialKind 필드 일치.
 *   - refreshToken 은 OAuth(네이버) 한정.
 *
 * 본 spec 은 코드 시그니처(메서드 존재 여부)만 검증한다. 동작 자체는 마켓별
 * real-adapter.test.ts / debug-adapter.test.ts 에서 다룬다.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - docs/architecture/v1/testing.md §6.2 R-006
 */

import { describe, it, expect } from 'vitest'
import { createMockAdapter } from '../debug/createMockAdapter'
import { naverRealAdapter } from '../real/naver'
import { coupangRealAdapter } from '../real/coupang'
import { gmarketRealAdapter } from '../real/gmarket'
import { auctionRealAdapter } from '../real/auction'
import { elevenstRealAdapter } from '../real/11st'
import type { MarketAdapter } from '../types'
import type { MarketCredentialKind, MarketId } from '@/lib/schemas'

const ACTIVE_MARKETS: readonly {
  market: MarketId
  kind: MarketCredentialKind
  real: MarketAdapter
}[] = [
  { market: 'naver', kind: 'oauth', real: naverRealAdapter },
  { market: 'coupang', kind: 'hmac', real: coupangRealAdapter },
  { market: 'gmarket', kind: 'esm_jwt', real: gmarketRealAdapter },
  { market: 'auction', kind: 'esm_jwt', real: auctionRealAdapter },
  // 11번가 (api_key) — PR-5 에서 fetchOrders/submitTracking real 본체 동작 → parity 편입.
  { market: '11st', kind: 'api_key', real: elevenstRealAdapter },
]

describe('MarketAdapter mock ↔ real parity (v2 확장 후 7메서드)', () => {
  for (const { market, kind, real } of ACTIVE_MARKETS) {
    describe(market, () => {
      const mock = createMockAdapter(market)

      it('market 식별자 일치', () => {
        expect(mock.market).toBe(market)
        expect(real.market).toBe(market)
      })

      it('credentialKind 일치', () => {
        expect(mock.credentialKind).toBe(kind)
        expect(real.credentialKind).toBe(kind)
      })

      it('5 메서드 (v1) 양쪽 모두 함수로 노출', () => {
        for (const adapter of [mock, real]) {
          expect(typeof adapter.authenticate).toBe('function')
          expect(typeof adapter.fetchCategoryTree).toBe('function')
          expect(typeof adapter.transformProduct).toBe('function')
          expect(typeof adapter.createProduct).toBe('function')
        }
      })

      it('2 메서드 (v2 Extension) 양쪽 모두 함수로 노출', () => {
        for (const adapter of [mock, real]) {
          expect(typeof adapter.fetchOrders).toBe('function')
          expect(typeof adapter.submitTracking).toBe('function')
        }
      })

      it('refreshToken 정책 일치 — OAuth 한정', () => {
        if (kind === 'oauth') {
          expect(typeof mock.refreshToken).toBe('function')
          expect(typeof real.refreshToken).toBe('function')
        } else {
          expect(mock.refreshToken).toBeUndefined()
          // real 어댑터는 refreshToken 을 정의하지 않거나 undefined.
          expect(real.refreshToken === undefined).toBe(true)
        }
      })

      it('getRegistrationFields 정책 일치 — ESM(PR-E2 조회형) / 11번가(PR-2) / 그 외 미정의', () => {
        const isEsm = market === 'gmarket' || market === 'auction'
        const isElevenSt = market === '11st'
        if (isEsm) {
          // mock ↔ real 동형: 둘 다 함수로 노출 + [출하지, 발송정책, 상품정보고시] 3필드 (조회형 PR-E2).
          //   생성형 shippingProfile → 조회형 출하지(select)+발송정책(select)로 전환.
          expect(typeof mock.getRegistrationFields).toBe('function')
          expect(typeof real.getRegistrationFields).toBe('function')
          const mockFields = mock.getRegistrationFields?.() ?? []
          const realFields = real.getRegistrationFields?.() ?? []
          expect(mockFields).toEqual(realFields)
          expect(mockFields.map((f) => f.key)).toEqual([
            'shippingPlaceNo',
            'dispatchPolicyNo',
            'officialNotice',
          ])
          expect(mockFields[0]?.kind).toBe('select')
          expect(mockFields[0]?.optionsSource).toBe('esmShippingPlace')
          expect(mockFields[1]?.kind).toBe('select')
          expect(mockFields[1]?.optionsSource).toBe('esmDispatchPolicy')
          expect(mockFields[2]?.kind).toBe('officialNotice')
          // 생성형 잔존 제거 검증 — shippingProfile kind 미노출.
          expect(mockFields.some((f) => f.kind === 'shippingProfile')).toBe(false)
        } else if (isElevenSt) {
          // mock ↔ real 동형: 둘 다 함수로 노출 + [출고지, 반품/교환지] select 2필드 (11st.md §4.6 / PR-2).
          //   officialNotice 는 PR-4 — 본 PR 미포함.
          expect(typeof mock.getRegistrationFields).toBe('function')
          expect(typeof real.getRegistrationFields).toBe('function')
          const mockFields = mock.getRegistrationFields?.() ?? []
          const realFields = real.getRegistrationFields?.() ?? []
          expect(mockFields).toEqual(realFields)
          expect(mockFields.map((f) => f.key)).toEqual([
            'outboundAddrSeq',
            'returnAddrSeq',
          ])
          expect(mockFields.every((f) => f.kind === 'select')).toBe(true)
          expect(mockFields.some((f) => f.kind === 'officialNotice')).toBe(false)
        } else {
          // 하위호환: naver/coupang 은 메서드 미정의 → 헬퍼 통해 [] 취급.
          expect(mock.getRegistrationFields).toBeUndefined()
          expect(real.getRegistrationFields === undefined).toBe(true)
        }
      })
    })
  }
})
