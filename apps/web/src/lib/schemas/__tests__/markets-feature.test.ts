import { describe, expect, it } from 'vitest'
import {
  ConnectRequestSchema,
  toConnectRequest,
  type EsmJwtConnectForm,
  type HmacConnectForm,
} from '../markets-feature'

/**
 * markets-connect Edge Function (apps/api/supabase/functions/markets-connect/index.ts)
 * 의 RequestSchema 와 클라이언트 ConnectRequestSchema 정합 회귀 가드.
 *
 * 배경: hotfix/v0.9.2 이전엔 클라이언트가 flat {market, accessKey, ...} 를 보내고
 * 서버는 {marketId, credentials: {...}} 를 기대 → 400 validation 실패.
 * 운영 첫 등록 시도가 한 번도 통과 못한 상태였음.
 */
describe('toConnectRequest — form → server payload', () => {
  it('쿠팡 폼 → marketId=coupang + credentials.kind=hmac_key', () => {
    const form: HmacConnectForm = {
      market: 'coupang',
      accountLabel: '메인계정',
      accessKey: 'AK_abc',
      secretKey: 'SK_xyz',
      vendorId: 'A00012345',
    }
    expect(toConnectRequest(form)).toEqual({
      marketId: 'coupang',
      accountLabel: '메인계정',
      credentials: {
        kind: 'hmac_key',
        accessKey: 'AK_abc',
        secretKey: 'SK_xyz',
        vendorId: 'A00012345',
      },
    })
  })

  it('G마켓 폼 → marketId=gmarket + credentials.kind=esm_jwt + site=G', () => {
    const form: EsmJwtConnectForm = {
      market: 'gmarket',
      accountLabel: 'G마켓본점',
      masterId: 'master_g',
      secretKey: 'esm_secret_g',
      sellerId: 'seller_g',
    }
    expect(toConnectRequest(form)).toEqual({
      marketId: 'gmarket',
      accountLabel: 'G마켓본점',
      credentials: {
        kind: 'esm_jwt',
        masterId: 'master_g',
        secretKey: 'esm_secret_g',
        sellerId: 'seller_g',
        site: 'G',
      },
    })
  })

  it('옥션 폼 → marketId=auction + credentials.kind=esm_jwt + site=A', () => {
    const form: EsmJwtConnectForm = {
      market: 'auction',
      accountLabel: '옥션본점',
      masterId: 'master_a',
      secretKey: 'esm_secret_a',
      sellerId: 'seller_a',
    }
    expect(toConnectRequest(form)).toEqual({
      marketId: 'auction',
      accountLabel: '옥션본점',
      credentials: {
        kind: 'esm_jwt',
        masterId: 'master_a',
        secretKey: 'esm_secret_a',
        sellerId: 'seller_a',
        site: 'A',
      },
    })
  })

  it('변환 결과가 ConnectRequestSchema.parse 에 통과한다 (서버 정합)', () => {
    const form: HmacConnectForm = {
      market: 'coupang',
      accountLabel: '메인',
      accessKey: 'AK',
      secretKey: 'SK',
      vendorId: 'V123',
    }
    const payload = toConnectRequest(form)
    expect(() => ConnectRequestSchema.parse(payload)).not.toThrow()
  })
})

describe('ConnectRequestSchema — 서버 정합 가드', () => {
  it('성공: marketId=coupang + credentials.kind=hmac_key', () => {
    const parsed = ConnectRequestSchema.parse({
      marketId: 'coupang',
      accountLabel: '본점',
      credentials: {
        kind: 'hmac_key',
        accessKey: 'AK',
        secretKey: 'SK',
        vendorId: 'V',
      },
    })
    expect(parsed.marketId).toBe('coupang')
    if (parsed.credentials.kind !== 'hmac_key') {
      throw new Error('expected hmac_key')
    }
    expect(parsed.credentials.vendorId).toBe('V')
  })

  it('실패: flat 형식 (옛 클라이언트 폼) 은 거부 — marketId 누락', () => {
    const result = ConnectRequestSchema.safeParse({
      market: 'coupang',
      accountLabel: '본점',
      accessKey: 'AK',
      secretKey: 'SK',
      vendorId: 'V',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('marketId')
      expect(paths).toContain('credentials')
    }
  })

  it('실패: credentials.kind 가 union 에 없는 값 → 거부', () => {
    const result = ConnectRequestSchema.safeParse({
      marketId: 'coupang',
      accountLabel: '본점',
      credentials: {
        kind: 'oauth_code',
        code: 'abc',
      },
    })
    expect(result.success).toBe(false)
  })

  it('실패: ESM site 가 G/A 외 값 → 거부', () => {
    const result = ConnectRequestSchema.safeParse({
      marketId: 'gmarket',
      accountLabel: '본점',
      credentials: {
        kind: 'esm_jwt',
        masterId: 'm',
        secretKey: 's',
        sellerId: 'sid',
        site: 'X',
      },
    })
    expect(result.success).toBe(false)
  })
})
