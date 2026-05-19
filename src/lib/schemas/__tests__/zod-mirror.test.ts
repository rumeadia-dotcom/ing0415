import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  JOB_STATUSES as CLIENT_JOB_STATUSES,
  MARKET_RESULT_STATUSES as CLIENT_MARKET_RESULT_STATUSES,
} from '@/lib/schemas/registration'
import { MARKET_IDS as CLIENT_MARKET_IDS } from '@/lib/schemas/common'

/**
 * 클라이언트 ↔ Edge Function zod 미러 동기화 검증 (testing.md §12, R-006).
 *
 * 배경:
 *   - `src/lib/schemas/*` 는 클라이언트 단일 진실 (Vite/Node ESM).
 *   - `supabase/functions/_shared/schemas.ts` 는 Deno 측 미러 (`npm:zod@...` import).
 *   - 두 파일이 같은 ENUM 값을 가지지 않으면 클라이언트가 보내는 값과 Edge Function 이
 *     기대하는 값 사이에 격차 → 마켓 등록 실패 회귀가 production 에서만 발견되는 최악.
 *
 * 검증 전략:
 *   - Deno 의 `npm:zod` 임포트 때문에 Node 에서 직접 import 불가.
 *   - 대신 Edge Function 파일을 **텍스트로 읽고 ENUM 배열을 정규식으로 추출** → 클라이언트와 비교.
 *   - 미러가 깨지면 본 테스트 fail → CI 차단 (Stage H 의 GH Actions 가 게이트).
 *
 * 본 테스트가 통과한다는 것은 ENUM 의 "값 집합" 이 일치한다는 보증.
 * 시그니처 (필드/제약/refine) 일치는 별도 schema-drift 스크립트 영역 (Phase 2~3 도입 검토).
 */

const SHARED_SCHEMA_PATH = path.resolve(
  process.cwd(),
  'supabase/functions/_shared/schemas.ts',
)

/**
 * `as const` 배열 리터럴에서 string 요소 목록 추출.
 * `export const X = ['a', 'b'] as const` 형태 가정.
 */
function extractEnumValues(source: string, name: string): string[] {
  // export const NAME = [ ... ] as const
  const re = new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*\\[(?<body>[\\s\\S]*?)\\]\\s*as\\s+const`,
    'm',
  )
  const m = re.exec(source)
  if (!m?.groups?.body) {
    throw new Error(`Edge Function schemas.ts 에서 ${name} 을(를) 찾지 못함`)
  }
  // 'a', "b", `c` 모두 매치.
  const itemRe = /['"`]([^'"`]+)['"`]/g
  const out: string[] = []
  let item: RegExpExecArray | null
  while ((item = itemRe.exec(m.groups.body)) !== null) {
    if (item[1] !== undefined) out.push(item[1])
  }
  return out
}

describe('zod 미러 동기화 (클라이언트 ↔ Edge Function)', () => {
  const shared = fs.readFileSync(SHARED_SCHEMA_PATH, 'utf-8')

  it('JOB_STATUSES 값 집합 일치 (7개)', () => {
    const remote = extractEnumValues(shared, 'JOB_STATUSES')
    expect(remote.sort()).toEqual([...CLIENT_JOB_STATUSES].sort())
    expect(CLIENT_JOB_STATUSES).toHaveLength(7)
  })

  it('MARKET_RESULT_STATUSES 값 집합 일치 (5개)', () => {
    const remote = extractEnumValues(shared, 'MARKET_RESULT_STATUSES')
    expect(remote.sort()).toEqual([...CLIENT_MARKET_RESULT_STATUSES].sort())
    expect(CLIENT_MARKET_RESULT_STATUSES).toHaveLength(5)
  })

  it('MARKET_IDS 값 집합 일치 (5개 — naver/coupang/11st/gmarket/auction)', () => {
    const remote = extractEnumValues(shared, 'MARKET_IDS')
    expect(remote.sort()).toEqual([...CLIENT_MARKET_IDS].sort())
    expect(CLIENT_MARKET_IDS).toHaveLength(5)
  })

  it('JOB_MARKET_ERROR_CODES Edge Function 측에서 추출 가능 (재시도 정책 §6.2 표 미러)', () => {
    // 클라이언트는 현재 해당 ENUM 을 export 하지 않음 (Edge Function 전용).
    // 본 테스트는 미러 파일 자체에 해당 ENUM 이 존재하는지 회귀 방지.
    const remote = extractEnumValues(shared, 'JOB_MARKET_ERROR_CODES')
    expect(remote).toContain('rate_limit')
    expect(remote).toContain('oauth_expired')
    expect(remote).toContain('oauth_revoked')
    expect(remote).toContain('validation')
    expect(remote.length).toBeGreaterThanOrEqual(10)
  })

  it('잘못된 ENUM 이름 추출 시 명확한 에러', () => {
    expect(() => extractEnumValues(shared, 'NON_EXISTENT_ENUM_XYZ')).toThrow(
      /찾지 못함/,
    )
  })
})
