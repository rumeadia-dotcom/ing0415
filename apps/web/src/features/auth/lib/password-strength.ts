/**
 * 비밀번호 강도 계산 — auth.md §6.3 (5단계 인디케이터).
 *
 * v1 기준: 길이 + 문자 종류 + 반복 패턴 검사로 0~4 점수.
 * (zxcvbn 의 dictionary 검사는 번들 부담으로 v2 백로그.)
 */

export type PasswordStrength = 0 | 1 | 2 | 3 | 4

export interface PasswordStrengthInfo {
  score: PasswordStrength
  label: string
  /** Tailwind bg class 5단계 (인디케이터 바 색상) */
  toneClass: string
  /** 사용자에게 보여줄 미충족 사유 (auth.md §4.1) */
  warnings: string[]
}

const LABELS: Record<PasswordStrength, string> = {
  0: '매우 약함',
  1: '약함',
  2: '보통',
  3: '강함',
  4: '매우 강함',
}

const TONES: Record<PasswordStrength, string> = {
  0: 'bg-danger',
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-success',
  4: 'bg-success',
}

export function evaluatePasswordStrength(password: string): PasswordStrengthInfo {
  const warnings: string[] = []
  let score = 0

  if (password.length >= 10) score += 1
  else warnings.push('10자 이상으로 입력해주세요')

  const kinds = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  if (kinds >= 3) score += 1
  else warnings.push('영문 대소문자 / 숫자 / 특수문자 중 3종 이상 혼합해주세요')

  if (password.length >= 14) score += 1
  if (kinds === 4) score += 1

  // 단순 반복 패턴 감점
  if (/(.)\1{3,}/.test(password)) {
    score = Math.max(0, score - 1)
    warnings.push('같은 문자가 4번 이상 반복됩니다')
  }
  if (/^(abc|qwer|1234|password|aaaa)/i.test(password)) {
    score = Math.max(0, score - 1)
    warnings.push('자주 쓰이는 단어/순열을 피해주세요')
  }

  const clamped = Math.min(4, Math.max(0, score)) as PasswordStrength

  return {
    score: clamped,
    label: LABELS[clamped],
    toneClass: TONES[clamped],
    warnings,
  }
}
