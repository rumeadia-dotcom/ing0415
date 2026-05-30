import { describe, expect, it } from 'vitest'
import {
  CARRIER_CODES,
  DEFAULT_CARRIER_CODE,
  ELEVEN_ST_CARRIER_CODES,
  ESM_CARRIER_CODES,
  isCarrierCode,
  normalizeCarrierCode,
  toElevenStCarrierCode,
  toEsmCarrierCode,
  type CarrierCode,
} from '@/lib/markets/carrier-codes'

/**
 * Cross-market 택배사 코드 단일 소스 (PR-6, §8-3).
 *
 * R-001: pass + fail. 마켓별 round-trip (내부 CarrierCode → 마켓 코드) 검증.
 * 11번가(`dlvEtprsCd`)·ESM(`DeliveryCompanyCode`) 매핑이 단일 소스에서 일관.
 */

describe('carrier-codes — 내부 enum / 정규화', () => {
  it('CARRIER_CODES 는 LOGEN 을 포함하고 default 가 LOGEN', () => {
    expect(CARRIER_CODES).toContain('LOGEN')
    expect(DEFAULT_CARRIER_CODE).toBe('LOGEN')
    expect(isCarrierCode('LOGEN')).toBe(true)
  })

  it('isCarrierCode — 미지원/소문자/빈문자열은 false', () => {
    expect(isCarrierCode('logen')).toBe(false) // case-sensitive 게이트
    expect(isCarrierCode('AMAZON')).toBe(false)
    expect(isCarrierCode('')).toBe(false)
  })

  it('normalizeCarrierCode — 대소문자/공백 무관 정규화, 미지원은 undefined', () => {
    expect(normalizeCarrierCode('cj')).toBe<CarrierCode>('CJ')
    expect(normalizeCarrierCode('  hanjin ')).toBe<CarrierCode>('HANJIN')
    expect(normalizeCarrierCode('UNKNOWN')).toBeUndefined()
  })
})

describe('carrier-codes — 11번가 dlvEtprsCd 매핑 (round-trip)', () => {
  it('모든 내부 CarrierCode 가 11번가 코드로 매핑된다 (전수)', () => {
    for (const code of CARRIER_CODES) {
      expect(toElevenStCarrierCode(code)).toBe(ELEVEN_ST_CARRIER_CODES[code])
      expect(ELEVEN_ST_CARRIER_CODES[code]).toMatch(/^\d{5}$/)
    }
  })

  it('spec dispatch-1888 의 핵심 코드 (LOGEN/CJ/한진/롯데/우체국)', () => {
    expect(toElevenStCarrierCode('LOGEN')).toBe('00002')
    expect(toElevenStCarrierCode('CJ')).toBe('00034')
    expect(toElevenStCarrierCode('HANJIN')).toBe('00011')
    expect(toElevenStCarrierCode('LOTTE')).toBe('00012')
    expect(toElevenStCarrierCode('EPOST')).toBe('00007')
  })

  it('소문자 입력도 정규화 후 매핑', () => {
    expect(toElevenStCarrierCode('cj')).toBe('00034')
  })

  it('미지원 택배사는 undefined (코드 날조 금지 — 호출측 validation)', () => {
    expect(toElevenStCarrierCode('UNKNOWN_CARRIER')).toBeUndefined()
    expect(toElevenStCarrierCode('')).toBeUndefined()
  })
})

describe('carrier-codes — ESM DeliveryCompanyCode 매핑', () => {
  it('LOGEN → 10003 (v2 MVP 확보 범위)', () => {
    expect(toEsmCarrierCode('LOGEN')).toBe(10003)
    expect(ESM_CARRIER_CODES.LOGEN).toBe(10003)
  })

  it('확보 안 된 택배사는 undefined (코드 날조 금지)', () => {
    // CJ 는 내부 enum 엔 있으나 ESM 확보 범위 밖.
    expect(toEsmCarrierCode('CJ')).toBeUndefined()
    expect(toEsmCarrierCode('UNKNOWN')).toBeUndefined()
  })
})
