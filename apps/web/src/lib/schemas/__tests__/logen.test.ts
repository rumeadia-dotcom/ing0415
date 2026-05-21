import { describe, it, expect } from 'vitest'
import {
  LogenCredentialsInputSchema,
  LogenSenderInfoSchema,
  LogenVerifyRequestSchema,
  LogenApiErrorSchema,
  SetLogenCredentialsArgsSchema,
  ShippingAutoDispatchSettingSchema,
  LogenCredentialsStatusSchema,
} from '../logen'

/**
 * logen.ts zod 스키마 — pass / fail 양쪽 검증 (testing.md §6.1).
 */

describe('LogenCredentialsInputSchema', () => {
  it('정상 입력 통과', () => {
    expect(
      LogenCredentialsInputSchema.parse({ userId: 'LGN_12345', custCd: 'CUST_67890' }),
    ).toMatchObject({ userId: 'LGN_12345', custCd: 'CUST_67890' })
  })

  it('한글이 섞이면 실패', () => {
    const r = LogenCredentialsInputSchema.safeParse({ userId: '한글', custCd: 'CUST_1' })
    expect(r.success).toBe(false)
  })

  it('빈 값 실패', () => {
    const r = LogenCredentialsInputSchema.safeParse({ userId: '', custCd: '' })
    expect(r.success).toBe(false)
  })
})

describe('LogenSenderInfoSchema', () => {
  const valid = {
    senderName: '홍길동 스토어',
    senderAddress: '서울특별시 강남구 테헤란로 123',
    senderPhone: '010-1234-5678',
    fareTy: 'C' as const,
    dlvFare: 2500,
  }
  it('정상 입력 통과', () => {
    expect(LogenSenderInfoSchema.parse(valid)).toMatchObject(valid)
  })
  it('dlvFare 음수 실패', () => {
    expect(
      LogenSenderInfoSchema.safeParse({ ...valid, dlvFare: -1 }).success,
    ).toBe(false)
  })
  it('senderPhone 비숫자 실패', () => {
    expect(
      LogenSenderInfoSchema.safeParse({ ...valid, senderPhone: 'abc-def' }).success,
    ).toBe(false)
  })
  it('fareTy 잘못된 값 실패', () => {
    expect(
      LogenSenderInfoSchema.safeParse({ ...valid, fareTy: 'X' }).success,
    ).toBe(false)
  })
})

describe('LogenVerifyRequestSchema', () => {
  it('source=stored: credentials 없이도 통과', () => {
    expect(LogenVerifyRequestSchema.parse({ source: 'stored' }).source).toBe('stored')
  })
  it('source=inline: credentials 없으면 실패', () => {
    expect(LogenVerifyRequestSchema.safeParse({ source: 'inline' }).success).toBe(false)
  })
  it('source=inline + credentials 통과', () => {
    expect(
      LogenVerifyRequestSchema.parse({
        source: 'inline',
        credentials: { userId: 'LGN_1', custCd: 'CUST_1' },
      }).source,
    ).toBe('inline')
  })
})

describe('SetLogenCredentialsArgsSchema', () => {
  it('credentials 단독 통과', () => {
    expect(
      SetLogenCredentialsArgsSchema.parse({
        credentials: { userId: 'LGN_1', custCd: 'CUST_1' },
      }).credentials,
    ).toBeDefined()
  })
  it('senderInfo 단독 통과', () => {
    expect(
      SetLogenCredentialsArgsSchema.parse({
        senderInfo: {
          senderName: 'A',
          senderAddress: '서울특별시 강남구 1',
          senderPhone: '010-1234-5678',
          fareTy: 'C',
          dlvFare: 2500,
        },
      }).senderInfo,
    ).toBeDefined()
  })
  it('둘 다 없으면 실패', () => {
    expect(SetLogenCredentialsArgsSchema.safeParse({}).success).toBe(false)
  })
})

describe('LogenApiErrorSchema', () => {
  it('알려진 코드 통과', () => {
    expect(
      LogenApiErrorSchema.parse({ code: 'invalid_credentials', message: '잘못됨' }).code,
    ).toBe('invalid_credentials')
  })
  it('알려지지 않은 코드 실패', () => {
    expect(
      LogenApiErrorSchema.safeParse({ code: 'unknown_code', message: 'x' }).success,
    ).toBe(false)
  })
})

describe('ShippingAutoDispatchSettingSchema', () => {
  it('true 통과', () => {
    expect(
      ShippingAutoDispatchSettingSchema.parse({ autoDispatchAfterPrint: true })
        .autoDispatchAfterPrint,
    ).toBe(true)
  })
  it('boolean 아니면 실패', () => {
    expect(
      ShippingAutoDispatchSettingSchema.safeParse({ autoDispatchAfterPrint: 'yes' })
        .success,
    ).toBe(false)
  })
})

describe('LogenCredentialsStatusSchema', () => {
  it('필수 필드 모두 있을 때 통과', () => {
    expect(
      LogenCredentialsStatusSchema.parse({
        hasCredentials: true,
        hasSenderInfo: false,
        lastVerifiedAt: '2026-05-20T00:00:00.000Z',
        lastErrorAt: null,
        lastErrorCode: null,
        senderInfo: null,
      }).hasCredentials,
    ).toBe(true)
  })
  it('hasCredentials boolean 누락 실패', () => {
    expect(
      LogenCredentialsStatusSchema.safeParse({
        hasSenderInfo: false,
        lastVerifiedAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        senderInfo: null,
      }).success,
    ).toBe(false)
  })
})
