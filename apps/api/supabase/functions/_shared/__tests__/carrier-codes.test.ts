import { describe, expect, it } from 'vitest'
import {
  CARRIER_CODES,
  ELEVEN_ST_CARRIER_CODES,
  ESM_CARRIER_CODES,
  normalizeCarrierCode,
  toElevenStCarrierCode,
  toEsmCarrierCode,
} from '../carrier-codes'

/**
 * Cross-market 택배사 코드 단일 소스 — Edge 미러 (PR-6, §8-3).
 * Web `apps/web/src/lib/markets/__tests__/carrier-codes.test.ts` 와 동일 시나리오 (FE↔BE parity).
 * 순수 모듈 (Deno specifier 없음) → vitest 직접 import (C8).
 */

describe('carrier-codes (Edge) — round-trip', () => {
  it('전 내부 CarrierCode → 11번가 dlvEtprsCd 매핑 (5자리)', () => {
    for (const code of CARRIER_CODES) {
      expect(toElevenStCarrierCode(code)).toBe(ELEVEN_ST_CARRIER_CODES[code])
      expect(ELEVEN_ST_CARRIER_CODES[code]).toMatch(/^\d{5}$/)
    }
  })

  it('LOGEN/CJ 11번가 코드 + 소문자 정규화', () => {
    expect(toElevenStCarrierCode('LOGEN')).toBe('00002')
    expect(toElevenStCarrierCode('cj')).toBe('00034')
    expect(normalizeCarrierCode('hanjin')).toBe('HANJIN')
  })

  it('미지원 택배사는 undefined (코드 날조 금지)', () => {
    expect(toElevenStCarrierCode('UNKNOWN')).toBeUndefined()
  })

  it('ESM LOGEN → 10003, 미확보는 undefined', () => {
    expect(toEsmCarrierCode('LOGEN')).toBe(10003)
    expect(ESM_CARRIER_CODES.LOGEN).toBe(10003)
    expect(toEsmCarrierCode('CJ')).toBeUndefined()
  })
})
