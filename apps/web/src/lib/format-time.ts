/**
 * ISO 시각 → 한국어 상대 시간 ("방금", "2분 전", "3일 전").
 * 1주일 이후는 절대 날짜 (yyyy-mm-dd).
 *
 * 본 앱의 모든 상대시간 표시는 이 함수로 통일 (cycle 28).
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const diffSec = Math.floor((now.getTime() - t) / 1000)

  if (diffSec < 60) return '방금'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`

  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * ISO → KST 절대 시각 ("2026-05-25 14:32"). cycle 59 — tooltip / title 용.
 */
export function formatAbsoluteKst(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

/**
 * 초 단위 → 한국어 듀레이션 ("28초", "1분 32초").
 */
export function formatDurationSec(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}초`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (r === 0) return `${m}분`
  return `${m}분 ${r}초`
}
