/**
 * ESM JWT (HS256) 서명 모듈 단위 테스트.
 *
 * 마스터: WIP-5markets-mvp.md C-3 Phase 0, esm.md §7 PR-1
 * 근거 — PRD §2.4 자격증명 보안, market-adapter.md §9, esm-api/README.md 인증 섹션.
 *
 * 스펙 정합 (PR-1): payload 는 `iss`(발행자) / `sub`='sell' / `aud`='sa.esmplus.com'
 *   / `ssi`='{site}:{sellerId}' (사이트별 분리 — 단일 사이트). `site` flat 키 제거.
 *
 * 테스트 카테고리:
 *   T1.  JWT 구조 — 3-segment (header.payload.signature)
 *   T2.  header 디코드 — alg=HS256, typ=JWT, kid=MasterID
 *   T3.  payload 디코드 — iss(기본)/sub/aud 고정값 + ssi=site:sellerId
 *   T4.  iat 주입 시 결정성 (동일 입력 → 동일 토큰)
 *   T5.  exp = iat + ttlSec (기본 300)
 *   T6.  site 변경 시 payload.ssi 변경 → token 변경
 *   T7.  masterId 변경 시 header.kid 변경 → token 변경
 *   T8.  secretKey 변경 시 signature 변경 → token 변경
 *   T9.  base64url 인코딩 형식 — '+', '/', '=' 미포함
 *  T10.  ttlSec 커스텀 — exp = iat + 60 검증
 *  T11.  iss 커스텀 주입 시 payload.iss 반영
 *  T12.  ssi 는 옥션/지마켓 단일 사이트만 — 콤마 결합·다중 사이트 없음
 *  T13.  (fail) sellerId 빈 문자열 → ssi 가 'G:' 형태로 깨짐 (잘못된 입력 방어 단언)
 *  T14.  (fail) site 가 'G'|'A' 외 값이면 ssi prefix 가 규약 위반
 *  T15.  (fail) payload 에 구(舊) flat `site` 키가 남아있지 않음 (회귀 가드)
 */

import { describe, it, expect } from 'vitest'
import { buildEsmJwt } from '../jwt'

// 테스트 고정값
const FIXED_MASTER_ID = 'esmplus-master-abc123'
const FIXED_SECRET_KEY = 'esmplus-secret-xyz789'
const FIXED_SELLER_ID = 'esmplus-seller-001'
const FIXED_IAT = 1747734645 // 2026-05-20T09:30:45Z

// ─────────────────────────────────────────────
// 헬퍼: base64url 디코드 (테스트 검증용)
// ─────────────────────────────────────────────
function base64UrlDecode(input: string): string {
  // padding 복원
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  return atob(base64)
}

function decodeJsonSegment(segment: string): unknown {
  return JSON.parse(base64UrlDecode(segment))
}

/** JWT 의 3-segment 중 한 segment 를 안전하게 꺼낸다 (lint: no-non-null-assertion 우회). */
function segmentAt(token: string, idx: 0 | 1 | 2): string {
  const parts = token.split('.')
  const part = parts[idx]
  if (part === undefined) throw new Error(`JWT segment ${idx} missing`)
  return part
}

describe('buildEsmJwt — JWT 구조 & 결정성', () => {
  it('T1: JWT 는 3-segment (header.payload.signature) 구조', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    })
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    expect(parts[0]?.length).toBeGreaterThan(0)
    expect(parts[1]?.length).toBeGreaterThan(0)
    expect(parts[2]?.length).toBeGreaterThan(0)
  })

  it('T2: header 디코드 → alg=HS256, typ=JWT, kid=masterId', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'A',
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    })
    const header = decodeJsonSegment(segmentAt(token, 0)) as Record<string, unknown>
    expect(header.alg).toBe('HS256')
    expect(header.typ).toBe('JWT')
    expect(header.kid).toBe(FIXED_MASTER_ID)
  })

  it('T3: payload 디코드 → iss(기본)/sub/aud 고정값 + ssi=G:sellerId', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    })
    const payload = decodeJsonSegment(segmentAt(token, 1)) as Record<string, unknown>
    expect(payload.iss).toBe('www.esmplus.com') // 기본 발행자
    expect(payload.sub).toBe('sell')
    expect(payload.aud).toBe('sa.esmplus.com')
    expect(payload.iat).toBe(FIXED_IAT)
    expect(payload.ssi).toBe(`G:${FIXED_SELLER_ID}`)
  })

  it('T4: 같은 입력 두 번 호출 → 동일 토큰 (결정성)', async () => {
    const input = {
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G' as const,
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    }
    const r1 = await buildEsmJwt(input)
    const r2 = await buildEsmJwt(input)
    expect(r1.token).toBe(r2.token)
    expect(r1.exp).toBe(r2.exp)
  })

  it('T5: exp = iat + ttlSec (기본 300 = 5분)', async () => {
    const { exp } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    })
    expect(exp).toBe(FIXED_IAT + 300)
  })
})

describe('buildEsmJwt — 입력 변화 시 토큰 변화', () => {
  it('T6: site 변경 시 payload.ssi + token 달라짐', async () => {
    const baseInput = {
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    }
    const gMarket = await buildEsmJwt({ ...baseInput, site: 'G' })
    const auction = await buildEsmJwt({ ...baseInput, site: 'A' })
    expect(gMarket.token).not.toBe(auction.token)

    const gPayload = decodeJsonSegment(segmentAt(gMarket.token, 1)) as { ssi: string }
    const aPayload = decodeJsonSegment(segmentAt(auction.token, 1)) as { ssi: string }
    expect(gPayload.ssi).toBe(`G:${FIXED_SELLER_ID}`)
    expect(aPayload.ssi).toBe(`A:${FIXED_SELLER_ID}`)
  })

  it('T7: masterId 변경 시 header.kid + token 달라짐', async () => {
    const baseInput = {
      secretKey: FIXED_SECRET_KEY,
      site: 'G' as const,
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    }
    const r1 = await buildEsmJwt({ ...baseInput, masterId: 'master-A' })
    const r2 = await buildEsmJwt({ ...baseInput, masterId: 'master-B' })
    expect(r1.token).not.toBe(r2.token)

    const h1 = decodeJsonSegment(segmentAt(r1.token, 0)) as { kid: string }
    const h2 = decodeJsonSegment(segmentAt(r2.token, 0)) as { kid: string }
    expect(h1.kid).toBe('master-A')
    expect(h2.kid).toBe('master-B')
  })

  it('T8: secretKey 변경 시 signature 부분만 달라짐 (header/payload 동일)', async () => {
    const baseInput = {
      masterId: FIXED_MASTER_ID,
      site: 'G' as const,
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    }
    const r1 = await buildEsmJwt({ ...baseInput, secretKey: 'secret-X' })
    const r2 = await buildEsmJwt({ ...baseInput, secretKey: 'secret-Y' })

    const [h1, p1, s1] = r1.token.split('.')
    const [h2, p2, s2] = r2.token.split('.')
    expect(h1).toBe(h2) // header 동일
    expect(p1).toBe(p2) // payload 동일
    expect(s1).not.toBe(s2) // signature 만 다름
  })
})

describe('buildEsmJwt — 인코딩 & 옵션', () => {
  it('T9: base64url 인코딩 — "+", "/", "=" 미포함', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    })
    expect(token).not.toMatch(/[+/=]/)
    // base64url 허용 문자만 + 구분자 점(.)
    expect(token).toMatch(/^[A-Za-z0-9_\-.]+$/)
  })

  it('T10: ttlSec 커스텀 (60초) → exp = iat + 60', async () => {
    const { exp } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'A',
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
      ttlSec: 60,
    })
    expect(exp).toBe(FIXED_IAT + 60)
  })

  it('T11: iss 커스텀 주입 시 payload.iss 반영', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      sellerId: FIXED_SELLER_ID,
      iss: 'www.playauto.com',
      iat: FIXED_IAT,
    })
    const payload = decodeJsonSegment(segmentAt(token, 1)) as { iss: string }
    expect(payload.iss).toBe('www.playauto.com')
  })

  it('T12: ssi 는 단일 사이트만 — 콤마/다중 사이트 결합 없음', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'A',
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    })
    const payload = decodeJsonSegment(segmentAt(token, 1)) as { ssi: string }
    expect(payload.ssi).toBe(`A:${FIXED_SELLER_ID}`)
    expect(payload.ssi).not.toContain(',') // 사이트별 분리 — 단일 사이트 prefix 만
    expect(payload.ssi.split(':')).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────
// 실패 / 회귀 가드
// ─────────────────────────────────────────────

describe('buildEsmJwt — 실패 케이스 & 회귀 가드', () => {
  it('T13 (fail): sellerId 빈 문자열이면 ssi 가 규약 위반 (site prefix 만 남음)', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      sellerId: '',
      iat: FIXED_IAT,
    })
    const payload = decodeJsonSegment(segmentAt(token, 1)) as { ssi: string }
    // 정상 규약은 'G:<sellerId>' — sellerId 누락 시 'G:' 로 깨진다.
    // 호출측(어댑터 connect)에서 sellerId 필수 검증을 통과시켜야 함을 보장하는 가드.
    expect(payload.ssi).toBe('G:')
    expect(payload.ssi.endsWith(':')).toBe(true)
  })

  it('T14 (fail): 잘못된 site 값은 ssi prefix 가 G/A 규약을 벗어남', async () => {
    // 런타임에 타입을 우회한 잘못된 site 주입 — 타입 가드 밖의 입력 방어 단언.
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'X' as unknown as 'G' | 'A',
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    })
    const payload = decodeJsonSegment(segmentAt(token, 1)) as { ssi: string }
    const prefix = payload.ssi.split(':')[0]
    expect(['G', 'A']).not.toContain(prefix) // 규약 위반 — 'X' prefix
  })

  it('T15 (회귀): payload 에 구(舊) flat `site` 키가 남아있지 않음', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      sellerId: FIXED_SELLER_ID,
      iat: FIXED_IAT,
    })
    const payload = decodeJsonSegment(segmentAt(token, 1)) as Record<string, unknown>
    expect(payload.site).toBeUndefined() // ssi 로 대체됨
    expect(payload).toHaveProperty('ssi')
  })
})
