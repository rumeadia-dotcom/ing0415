/**
 * ISO 시각 → 한국어 상대 시간 ("방금", "2분 전", "3일 전").
 * 1주일 이후는 절대 날짜 (yyyy-mm-dd).
 *
 * 동일 로직이 markets/utils/format-relative-time.ts 에 존재 — Phase 4 sync 시점에 통합 예정.
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
