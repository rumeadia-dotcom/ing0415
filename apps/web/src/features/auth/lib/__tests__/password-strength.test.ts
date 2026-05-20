import { describe, it, expect } from 'vitest'
import { evaluatePasswordStrength } from '../password-strength'

describe('evaluatePasswordStrength', () => {
  it('빈 문자열은 score 0 + 길이/종류 경고', () => {
    const r = evaluatePasswordStrength('')
    expect(r.score).toBe(0)
    expect(r.warnings.length).toBeGreaterThanOrEqual(2)
  })

  it('정책 충족 최소 (10자 + 3종) 은 score 2 이상', () => {
    const r = evaluatePasswordStrength('Pqrstu12!@')
    expect(r.score).toBeGreaterThanOrEqual(2)
    expect(r.warnings).toHaveLength(0)
  })

  it('14자 + 3종 은 강함 (3) 이상', () => {
    const r = evaluatePasswordStrength('Pqrstu12!@xyz#')
    expect(r.score).toBeGreaterThanOrEqual(3)
  })

  it('14자 + 4종 + 비반복 은 매우 강함 (4)', () => {
    const r = evaluatePasswordStrength('PqRstu12!@xyZ#$')
    expect(r.score).toBe(4)
  })

  it('동일 문자 4회+ 반복은 감점 + 경고', () => {
    const r = evaluatePasswordStrength('aaaaBcd12!#')
    expect(r.warnings).toContain('같은 문자가 4번 이상 반복됩니다')
  })

  it('자주 쓰이는 순열 prefix (abc / 1234) 도 감점', () => {
    const r1 = evaluatePasswordStrength('abcD12!@xy')
    expect(r1.warnings).toContain('자주 쓰이는 단어/순열을 피해주세요')
    const r2 = evaluatePasswordStrength('1234abCD!@')
    expect(r2.warnings).toContain('자주 쓰이는 단어/순열을 피해주세요')
  })
})
