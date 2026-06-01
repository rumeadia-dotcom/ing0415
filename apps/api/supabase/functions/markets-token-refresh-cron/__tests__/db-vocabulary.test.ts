import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * M1 회귀 가드 — cron 이 market_accounts.status / market_account_audit.event 에 쓰는 값은
 * 반드시 DB CHECK 제약 안의 값이어야 한다.
 *
 * 실제 DB 제약 (마이그 20260519000004 / market_account_audit):
 *   market_accounts.status      ∈ active | expired | revoked | error
 *   market_account_audit.event  ∈ connect_initiated | connect_succeeded | connect_failed
 *                                 | verify_succeeded | verify_failed | disconnected
 *                                 | auto_expired | auto_revoked
 *
 * cron 이 과거 'needs_reauth'(제약에 없는 값) 를 status/event 로 써서 토큰갱신 실패
 * 처리가 통째로 무음 실패(23514)하던 버그를 막는다. 'needs_reauth' 는 함수 내부
 * RefreshOutcome 의 의미적 라벨로만 허용(DB 컬럼에는 쓰지 않음).
 */
const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'index.ts'),
  'utf-8',
)

describe('markets-token-refresh-cron DB 어휘 정합 (M1)', () => {
  it("status 컬럼에 'needs_reauth' 를 쓰지 않는다 (market_accounts CHECK 위반)", () => {
    // market_accounts.status ∈ active|expired|revoked|error. 'needs_reauth' 는 제약 밖 → 23514.
    expect(SOURCE).not.toMatch(/status:\s*'needs_reauth'/)
  })

  it("market_account_audit.event 에 'needs_reauth' 를 쓰지 않는다 (event CHECK 위반)", () => {
    // event ∈ connect_*/verify_*/disconnected/auto_expired/auto_revoked. 'needs_reauth' 는 제약 밖.
    expect(SOURCE).not.toMatch(/event:\s*'needs_reauth'/)
  })

  it('토큰 무효/임계초과 실패 경로가 status=expired 로 계정을 만료 처리한다', () => {
    // 재인증 필요 상태 = 'expired' (markets-token-refresh / markets-verify 와 동일 어휘).
    expect(SOURCE).toMatch(/status:\s*'expired'/)
    expect(SOURCE).toMatch(/event:\s*'auto_expired'/)
  })
})
