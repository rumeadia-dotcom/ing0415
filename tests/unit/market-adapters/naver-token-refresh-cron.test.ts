/**
 * markets-token-refresh-cron Edge Function 단위 테스트 (6건).
 *
 * 파일 위치: tests/unit/market-adapters/naver-token-refresh-cron.test.ts
 * (vitest.config.ts 의 tests/unit/**\/\*.test.ts 경로에 포함됨)
 *
 * 마스터: WIP-5markets-mvp.md C-1 Phase 3
 * 근거 — PRD §2.4 자격증명 보안, credential-vault.md §6, markets.md §5.4.
 *
 * Edge Function 코드는 Deno 전용 import (npm:zod, .ts extension) 로 Vitest 에서
 * 직접 import 불가. 본 테스트는 동일 알고리즘을 인라인으로 재구현하여 검증한다:
 *   - 만료 임박 후보 필터 규칙 (status=active + credential_kind=oauth + market=naver
 *     + token_expires_at < now + windowMinutes)
 *   - refresh 결과 상태 전이 규칙 (성공 → active, invalid_grant → needs_reauth,
 *     누적 실패 ≥ threshold → needs_reauth)
 *   - SCHEDULED_BATCH_LIMIT 한도 적용
 *   - 호출자 인증 — Bearer service_role 만 허용
 *
 * 테스트 카테고리:
 *   X1. 만료 임박 필터 — windowMinutes 안 / 밖 분리
 *   X2. 필터 조건 — 다른 마켓 / 다른 kind 제외
 *   X3. SCHEDULED_BATCH_LIMIT 한도 적용 (50건 초과 → 50건만)
 *   X4. invalid_grant → needs_reauth 상태 전이
 *   X5. 누적 실패 N회 → 임계치 도달 시 needs_reauth
 *   X6. service_role 헤더 매칭 규칙
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────
// 인라인 재구현
// ─────────────────────────────────────────────

const TARGET_MARKET = 'naver' as const
const SCHEDULED_BATCH_LIMIT = 50
const REFRESH_FAILURE_THRESHOLD = 3

interface CredentialRow {
  id: string
  seller_id: string
  market_id: string
  credential_kind: string
  status: string
  token_expires_at: string
}

function filterExpiringNaverCredentials(
  rows: CredentialRow[],
  opts: { nowMs: number; windowMinutes: number; limit: number },
): CredentialRow[] {
  const horizonMs = opts.nowMs + opts.windowMinutes * 60 * 1000
  const filtered = rows.filter((r) => {
    if (r.market_id !== TARGET_MARKET) return false
    if (r.credential_kind !== 'oauth') return false
    if (r.status !== 'active') return false
    const exp = Date.parse(r.token_expires_at)
    if (Number.isNaN(exp)) return false
    return exp < horizonMs
  })
  // expires_at 오름차순 정렬 후 limit 적용
  filtered.sort((a, b) => Date.parse(a.token_expires_at) - Date.parse(b.token_expires_at))
  return filtered.slice(0, opts.limit)
}

type RefreshError = 'invalid_grant' | 'server' | 'rate_limit' | 'network' | 'unknown'

function nextStatusOnFailure(
  errorCode: RefreshError,
  prevFailureCount: number,
): { newFailureCount: number; accountStatus: 'active' | 'needs_reauth' } {
  if (errorCode === 'invalid_grant') {
    return { newFailureCount: prevFailureCount + 1, accountStatus: 'needs_reauth' }
  }
  const next = prevFailureCount + 1
  if (next >= REFRESH_FAILURE_THRESHOLD) {
    return { newFailureCount: next, accountStatus: 'needs_reauth' }
  }
  return { newFailureCount: next, accountStatus: 'active' }
}

function isServiceRoleAuth(authHeader: string | null, serviceRoleKey: string): boolean {
  if (!authHeader) return false
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false
  return authHeader.slice('bearer '.length).trim() === serviceRoleKey
}

// ─────────────────────────────────────────────
// 픽스처
// ─────────────────────────────────────────────

const NOW_MS = Date.parse('2026-05-20T12:00:00Z')
const WINDOW_MIN = 60

const ROWS: CredentialRow[] = [
  // 만료 30분 후 — 갱신 대상
  {
    id: 'c1',
    seller_id: 's1',
    market_id: 'naver',
    credential_kind: 'oauth',
    status: 'active',
    token_expires_at: new Date(NOW_MS + 30 * 60 * 1000).toISOString(),
  },
  // 만료 90분 후 — window 밖
  {
    id: 'c2',
    seller_id: 's2',
    market_id: 'naver',
    credential_kind: 'oauth',
    status: 'active',
    token_expires_at: new Date(NOW_MS + 90 * 60 * 1000).toISOString(),
  },
  // 다른 마켓 (coupang) — 제외
  {
    id: 'c3',
    seller_id: 's3',
    market_id: 'coupang',
    credential_kind: 'hmac',
    status: 'active',
    token_expires_at: new Date(NOW_MS + 30 * 60 * 1000).toISOString(),
  },
  // 네이버지만 hmac kind — 제외 (논리적으로 발생 안 하지만 방어)
  {
    id: 'c4',
    seller_id: 's4',
    market_id: 'naver',
    credential_kind: 'hmac',
    status: 'active',
    token_expires_at: new Date(NOW_MS + 30 * 60 * 1000).toISOString(),
  },
  // revoked 상태 — 제외
  {
    id: 'c5',
    seller_id: 's5',
    market_id: 'naver',
    credential_kind: 'oauth',
    status: 'revoked',
    token_expires_at: new Date(NOW_MS + 30 * 60 * 1000).toISOString(),
  },
]

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe('X1: 만료 임박 필터 — window 안 / 밖 분리', () => {
  it('window 60분 안 1건만 선정', () => {
    const result = filterExpiringNaverCredentials(ROWS, {
      nowMs: NOW_MS,
      windowMinutes: WINDOW_MIN,
      limit: SCHEDULED_BATCH_LIMIT,
    })
    expect(result.length).toBe(1)
    expect(result[0]?.id).toBe('c1')
  })

  it('window 120분으로 확장 시 c1 + c2 (만료 90분) 까지 포함', () => {
    const result = filterExpiringNaverCredentials(ROWS, {
      nowMs: NOW_MS,
      windowMinutes: 120,
      limit: SCHEDULED_BATCH_LIMIT,
    })
    expect(result.length).toBe(2)
    expect(result.map((r) => r.id)).toEqual(['c1', 'c2'])
  })
})

describe('X2: 다른 마켓 / 다른 kind / 비활성 제외', () => {
  it('coupang/hmac/revoked 모두 결과에 미포함', () => {
    const result = filterExpiringNaverCredentials(ROWS, {
      nowMs: NOW_MS,
      windowMinutes: 240,
      limit: SCHEDULED_BATCH_LIMIT,
    })
    const ids = result.map((r) => r.id)
    expect(ids).not.toContain('c3') // coupang
    expect(ids).not.toContain('c4') // hmac kind
    expect(ids).not.toContain('c5') // revoked
  })
})

describe('X3: SCHEDULED_BATCH_LIMIT 한도', () => {
  it('60건 후보 + limit=50 → 50건만 반환 (오래된 순)', () => {
    const many: CredentialRow[] = Array.from({ length: 60 }, (_, i) => ({
      id: `cm${i}`,
      seller_id: `sm${i}`,
      market_id: 'naver',
      credential_kind: 'oauth',
      status: 'active',
      // 만료가 가까운 순 (i 클수록 늦게 만료)
      token_expires_at: new Date(NOW_MS + (10 + i) * 60 * 1000).toISOString(),
    }))
    const result = filterExpiringNaverCredentials(many, {
      nowMs: NOW_MS,
      windowMinutes: 120, // 120분 안 = 60건 모두 후보
      limit: SCHEDULED_BATCH_LIMIT,
    })
    expect(result.length).toBe(50)
    // 정렬 검증 — 첫 항목은 가장 빨리 만료 (cm0)
    expect(result[0]?.id).toBe('cm0')
    expect(result[49]?.id).toBe('cm49')
  })
})

describe('X4: invalid_grant → needs_reauth 즉시 전이', () => {
  it('errorCode=invalid_grant 첫 실패에 needs_reauth', () => {
    const { newFailureCount, accountStatus } = nextStatusOnFailure('invalid_grant', 0)
    expect(newFailureCount).toBe(1)
    expect(accountStatus).toBe('needs_reauth')
  })
})

describe('X5: 누적 실패 ≥ 임계치 → needs_reauth', () => {
  it('일시 오류 1회 (count=1) → active 유지', () => {
    const r = nextStatusOnFailure('server', 0)
    expect(r.newFailureCount).toBe(1)
    expect(r.accountStatus).toBe('active')
  })
  it('일시 오류 누적 2회 (count=2) → 아직 active', () => {
    const r = nextStatusOnFailure('rate_limit', 1)
    expect(r.newFailureCount).toBe(2)
    expect(r.accountStatus).toBe('active')
  })
  it('일시 오류 누적 3회 (count=3) → needs_reauth', () => {
    const r = nextStatusOnFailure('network', 2)
    expect(r.newFailureCount).toBe(3)
    expect(r.accountStatus).toBe('needs_reauth')
  })
})

describe('X6: service_role 헤더 매칭', () => {
  it('정확히 일치하는 Bearer service_role → true', () => {
    expect(isServiceRoleAuth('Bearer sr-key-xyz', 'sr-key-xyz')).toBe(true)
  })
  it('스킴 누락 → false', () => {
    expect(isServiceRoleAuth('sr-key-xyz', 'sr-key-xyz')).toBe(false)
  })
  it('잘못된 키 → false', () => {
    expect(isServiceRoleAuth('Bearer wrong-key', 'sr-key-xyz')).toBe(false)
  })
  it('null 헤더 → false', () => {
    expect(isServiceRoleAuth(null, 'sr-key-xyz')).toBe(false)
  })
})
