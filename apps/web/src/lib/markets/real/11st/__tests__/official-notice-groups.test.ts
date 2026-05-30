/**
 * 11번가 상품정보고시 상품군 마스터(ELEVEN_ST_NOTICE_GROUPS) 단위 테스트 (PR-4).
 *
 * 마스터: docs/architecture/v1/features/11st.md §4.1 / §7 PR-4 / §9(C4 backlog).
 * 검증 (R-001 pass + fail):
 *   - 확보 군은 spec 예시 1개(891011)뿐 + docVerified.
 *   - 코드 날조 없음(미확보 군 정적 추가 금지) — free-form 허용 플래그 true.
 *   - select 옵션 / by-type 조회 정합.
 */

import { describe, it, expect } from 'vitest'
import {
  ELEVEN_ST_NOTICE_GROUPS,
  ELEVEN_ST_NOTICE_GROUP_BY_TYPE,
  ELEVEN_ST_NOTICE_ALLOW_FREEFORM,
  getElevenStNoticeOptions,
} from '../official-notice-groups'

describe('ELEVEN_ST_NOTICE_GROUPS — 마스터 (C4 확보 범위)', () => {
  it('spec 예시로 확보된 군 891011 1개만 정적 정의한다 (코드 날조 금지)', () => {
    expect(ELEVEN_ST_NOTICE_GROUPS).toHaveLength(1)
    const g = ELEVEN_ST_NOTICE_GROUPS[0]
    expect(g?.type).toBe('891011')
    expect(g?.docVerified).toBe(true)
  })

  it('미확보 41군은 free-form 으로 처리 — allowFreeform=true', () => {
    expect(ELEVEN_ST_NOTICE_ALLOW_FREEFORM).toBe(true)
  })

  it('by-type 조회가 정적 군과 정합한다 (pass)', () => {
    expect(ELEVEN_ST_NOTICE_GROUP_BY_TYPE['891011']?.type).toBe('891011')
  })

  it('fail: 마스터에 없는 type 조회는 undefined (코드 날조 없음)', () => {
    // 41군 중 미확보 군(예: 임의 코드)은 마스터에 없다 — free-form 으로만 입력.
    expect(ELEVEN_ST_NOTICE_GROUP_BY_TYPE['999999']).toBeUndefined()
  })

  it('select 옵션 = { value(type), label(name) }[]', () => {
    expect(getElevenStNoticeOptions()).toEqual([
      { value: '891011', label: '일반 상품 (예시 군 · 891011)' },
    ])
  })
})
