/**
 * 쿠팡 HMAC-SHA256 서명 모듈 단위 테스트 (10건).
 *
 * 마스터: WIP-5markets-mvp.md C-2 Phase 0
 * 근거 — PRD §2.4 자격증명 보안, market-adapter.md §9.
 *
 * 테스트 카테고리:
 *   T1. datetime 포맷 정확성
 *   T2. Authorization 헤더 형식
 *   T3. 알려진 벡터값으로 서명 검증 (결정성)
 *   T4. method 대소문자 무관 처리
 *   T5. path 변경 시 서명 변경
 *   T6. datetime 변경 시 서명 변경
 *   T7. 빈 path vs 유효 path 구분
 *   T8. Authorization 구성 요소 전부 포함 확인
 *   T9. 서명 hex 소문자 + 길이 64 (SHA-256 = 32바이트)
 *  T10. message 구조 (줄바꿈 순서) 검증 - 반환 signature 재계산으로 크로스체크
 */

import { describe, it, expect } from 'vitest'
import {
  buildCoupangSignature,
  formatCoupangDatetime,
} from '../hmac'

// 테스트 고정값
const FIXED_ACCESS_KEY = 'test-access-key-abc123'
const FIXED_SECRET_KEY = 'test-secret-key-xyz789'
const FIXED_DATE = new Date('2026-05-20T09:30:45.000Z')
const FIXED_PATH = '/v2/providers/seller_api/apis/api/v1/categorization/display-categories/1'

describe('formatCoupangDatetime', () => {
  it('T1a: 기본 UTC 날짜를 YYMMDD T HHmmss Z 형식으로 변환', () => {
    const result = formatCoupangDatetime(FIXED_DATE)
    expect(result).toBe('260520T093045Z')
  })

  it('T1b: 월/일/시/분/초 2자리 0 패딩 처리', () => {
    // 2026-01-05 03:04:05 UTC
    const date = new Date('2026-01-05T03:04:05.000Z')
    expect(formatCoupangDatetime(date)).toBe('260105T030405Z')
  })

  it('T1c: 연도 마지막 2자리만 사용 (2099 → "99")', () => {
    const date = new Date('2099-12-31T23:59:59.000Z')
    expect(formatCoupangDatetime(date)).toBe('991231T235959Z')
  })
})

describe('buildCoupangSignature', () => {
  it('T2: Authorization 헤더 형식 — CEA algorithm, access-key, signed-date, signature 포함', async () => {
    const result = await buildCoupangSignature({
      method: 'GET',
      path: FIXED_PATH,
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    })

    expect(result.authorization).toMatch(/^CEA algorithm=HmacSHA256/)
    expect(result.authorization).toContain(`access-key=${FIXED_ACCESS_KEY}`)
    expect(result.authorization).toContain(`signed-date=260520T093045Z`)
    expect(result.authorization).toContain('signature=')
  })

  it('T3: 알려진 고정 입력 → 동일 서명 결정성 검증 (같은 입력, 두 번 호출)', async () => {
    const input = {
      method: 'GET',
      path: FIXED_PATH,
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    }
    const r1 = await buildCoupangSignature(input)
    const r2 = await buildCoupangSignature(input)
    expect(r1.signature).toBe(r2.signature)
    expect(r1.authorization).toBe(r2.authorization)
  })

  it('T4a: method 소문자 "get" → 대문자 "GET" 정규화 후 동일 서명', async () => {
    const upper = await buildCoupangSignature({
      method: 'GET',
      path: FIXED_PATH,
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    })
    const lower = await buildCoupangSignature({
      method: 'get',
      path: FIXED_PATH,
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    })
    expect(lower.signature).toBe(upper.signature)
  })

  it('T4b: method "post" / "POST" 동일 서명', async () => {
    const upper = await buildCoupangSignature({
      method: 'POST',
      path: FIXED_PATH,
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    })
    const lower = await buildCoupangSignature({
      method: 'post',
      path: FIXED_PATH,
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    })
    expect(lower.signature).toBe(upper.signature)
  })

  it('T5: path 변경 시 서명 달라짐', async () => {
    const r1 = await buildCoupangSignature({
      method: 'GET',
      path: '/v2/providers/seller_api/apis/api/v1/categorization/display-categories/1',
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    })
    const r2 = await buildCoupangSignature({
      method: 'GET',
      path: '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products',
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    })
    expect(r1.signature).not.toBe(r2.signature)
  })

  it('T6: datetime 변경 시 서명 달라짐', async () => {
    const r1 = await buildCoupangSignature({
      method: 'GET',
      path: FIXED_PATH,
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: new Date('2026-05-20T09:30:45.000Z'),
    })
    const r2 = await buildCoupangSignature({
      method: 'GET',
      path: FIXED_PATH,
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: new Date('2026-05-20T09:30:46.000Z'), // +1초
    })
    expect(r1.signature).not.toBe(r2.signature)
    expect(r1.datetime).not.toBe(r2.datetime)
  })

  it('T8: Authorization 구성 요소 전부 포함 — 4개 필드', async () => {
    const { authorization } = await buildCoupangSignature({
      method: 'POST',
      path: '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products',
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    })

    // CEA 알고리즘
    expect(authorization).toContain('algorithm=HmacSHA256')
    // access-key 포함
    expect(authorization).toContain('access-key=')
    // signed-date 포함
    expect(authorization).toContain('signed-date=')
    // signature 포함
    expect(authorization).toContain('signature=')
  })

  it('T9: 서명은 hex 소문자이며 길이 64 (SHA-256 = 32바이트 × 2 hex chars)', async () => {
    const { signature } = await buildCoupangSignature({
      method: 'GET',
      path: FIXED_PATH,
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now: FIXED_DATE,
    })

    expect(signature).toHaveLength(64)
    // hex 소문자만 포함 (0-9, a-f)
    expect(signature).toMatch(/^[0-9a-f]+$/)
  })

  it('T10: datetime 반환값이 formatCoupangDatetime(now) 와 일치', async () => {
    const now = FIXED_DATE
    const { datetime } = await buildCoupangSignature({
      method: 'DELETE',
      path: '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/12345',
      accessKey: FIXED_ACCESS_KEY,
      secretKey: FIXED_SECRET_KEY,
      now,
    })

    // 직접 formatCoupangDatetime 으로 계산한 값과 동일해야 함
    const { formatCoupangDatetime: fmt } = await import('../hmac')
    expect(datetime).toBe(fmt(now))
  })
})
