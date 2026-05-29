import { formatAbsoluteKst, formatRelativeTime } from '@/lib/format-time'

/**
 * RelativeTime — ISO 시각을 한국어 상대시간으로 렌더 + hover tooltip 에 절대시각.
 *
 * - <time dateTime={iso}> 시맨틱 element
 * - title 속성 = 절대 KST ("2026-05-25 14:32") — 브라우저 native tooltip
 * - 내용 = formatRelativeTime ("3분 전")
 *
 * cycle 59 — 셀러가 상대 시간만 보고는 정확한 발생 시점을 모름. hover 시 절대 시각 노출.
 */
export interface RelativeTimeProps {
  /** ISO 8601 시각 문자열 */
  iso: string
  className?: string
  /** 추가 prefix (예: "주문일: ") */
  prefix?: string
}

export function RelativeTime({ iso, className, prefix }: RelativeTimeProps): JSX.Element {
  const relative = formatRelativeTime(iso)
  const absolute = formatAbsoluteKst(iso)
  return (
    <time dateTime={iso} title={absolute} className={className}>
      {prefix ?? ''}
      {relative}
    </time>
  )
}
