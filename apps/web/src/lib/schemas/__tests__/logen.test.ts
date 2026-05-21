import { describe, it, expect } from 'vitest'
import {
  LogenCredentialsInputSchema,
  LogenSenderInfoSchema,
  LogenVerifyResponseSchema,
} from '@/lib/schemas/logen'

/**
 * 로젠 자격증명 / 발송인 / verify 응답 단위 테스트.
 *
 * 마스터:
 *  - docs/spec/PRD-v2-shipping.md §2.2 / §3 / §4
 *  - testing.md §6.1
 */

describe('LogenSenderInfoSchema', () => {
  const valid = {
    name: '셀러홍길동',
    address: '서울시 강남구 테헤란로 1',
    phone: '02-1234-5678',
  }

  it('필수 필드만 + default 적용 통과 (fareTy=C / dlvFare=0)', () => {
    const res = LogenSenderInfoSchema.safeParse(valid)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.fareTy).toBe('C')
      expect(res.data.dlvFare).toBe(0)
    }
  })

  it('이름이 빈 문자열이면 parse 실패', () => {
    expect(
      LogenSenderInfoSchema.safeParse({ ...valid, name: '' }).success,
    ).toBe(false)
  })

  it('정의되지 않은 fareTy 거부 (C/P/M 만)', () => {
    expect(
      LogenSenderInfoSchema.safeParse({
        ...valid,
        fareTy: 'X' as unknown as 'C',
      }).success,
    ).toBe(false)
  })

  it('dlvFare 음수면 parse 실패', () => {
    expect(
      LogenSenderInfoSchema.safeParse({ ...valid, dlvFare: -1 }).success,
    ).toBe(false)
  })

  it('주소 501자면 parse 실패', () => {
    expect(
      LogenSenderInfoSchema.safeParse({
        ...valid,
        address: 'a'.repeat(501),
      }).success,
    ).toBe(false)
  })
})

describe('LogenCredentialsInputSchema', () => {
  const sender = {
    name: '셀러',
    address: '서울시 강남구',
    phone: '010-1234-5678',
    fareTy: 'C' as const,
    dlvFare: 0,
  }
  const valid = {
    userId: 'LOGEN-USR-001',
    custCd: 'CUST-001',
    sender,
  }

  it('유효 입력 parse 통과', () => {
    expect(LogenCredentialsInputSchema.safeParse(valid).success).toBe(true)
  })

  it('userId 가 빈 문자열이면 parse 실패', () => {
    expect(
      LogenCredentialsInputSchema.safeParse({ ...valid, userId: '' }).success,
    ).toBe(false)
  })

  it('custCd 가 빈 문자열이면 parse 실패', () => {
    expect(
      LogenCredentialsInputSchema.safeParse({ ...valid, custCd: '' }).success,
    ).toBe(false)
  })

  it('알 수 없는 추가 키가 들어오면 strict 로 거부', () => {
    expect(
      LogenCredentialsInputSchema.safeParse({
        ...valid,
        extraKey: 'leak',
      }).success,
    ).toBe(false)
  })

  it('sender 누락이면 parse 실패', () => {
    expect(
      LogenCredentialsInputSchema.safeParse({
        userId: 'a',
        custCd: 'b',
      }).success,
    ).toBe(false)
  })
})

describe('LogenVerifyResponseSchema (discriminated union)', () => {
  it('성공 응답 parse 통과', () => {
    const res = LogenVerifyResponseSchema.safeParse({
      ok: true,
      verifiedAt: '2026-05-21T03:00:00.000Z',
    })
    expect(res.success).toBe(true)
  })

  it('실패 응답 parse 통과 (code + message)', () => {
    const res = LogenVerifyResponseSchema.safeParse({
      ok: false,
      error: {
        code: 'logen_invalid_credentials',
        message: '자격증명이 올바르지 않습니다',
      },
    })
    expect(res.success).toBe(true)
  })

  it('성공 + error 동시 노출은 parse 실패 (union 의 schema가 분리)', () => {
    expect(
      LogenVerifyResponseSchema.safeParse({
        ok: true,
        error: { code: 'logen_unknown', message: 'x' },
      }).success,
    ).toBe(false)
  })

  it('실패 응답에 정의되지 않은 code 거부', () => {
    expect(
      LogenVerifyResponseSchema.safeParse({
        ok: false,
        error: { code: 'unknown_error_code', message: 'x' },
      }).success,
    ).toBe(false)
  })
})
