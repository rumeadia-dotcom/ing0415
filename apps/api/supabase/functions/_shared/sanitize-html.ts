/**
 * 서버 측 HTML sanitize — Edge Function (Deno) 의 description_html 등 사용자 입력 HTML 의 XSS 차단.
 *
 * 마스터:
 *   - docs/architecture/v1/features/registration.md §13.5
 *   - 클라이언트 미러: apps/web/src/lib/sanitize-html.ts (동일 정책)
 *
 * 강제:
 *   - dual-defense — 클라이언트 DOMPurify 통과 후 서버에서 동등 sanitize.
 *   - 결과가 다르면 registration-validate 가 `description_html_unsafe` 발급으로 거부.
 *   - 허용 태그·속성·forbid 룰은 client 미러와 정확히 동일하게 유지 (drift 시 PR 차단).
 */

import DOMPurify from 'npm:isomorphic-dompurify@2.20.0'

/** client 미러와 정확히 동일. 변경 시 양쪽 동기. */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'code',
  'pre',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'span',
  'div',
  'hr',
]

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class']

/**
 * 서버 측 sanitize. 클라이언트 DOMPurify 와 동등 정책.
 *
 * @param input  클라이언트가 보낸 (또는 사용자가 직접 보낸) HTML 문자열
 * @returns      sanitize 통과한 안전한 HTML
 */
export function sanitizeHtmlServer(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style'],
    FORBID_ATTR: ['style'],
  })
}

/**
 * 입력이 sanitize 결과와 동일한지 확인 — 클라이언트 측 sanitize 가 통과시킨 HTML 이
 * 서버 측 sanitize 와 동일한지 검증 (dual-defense).
 *
 * @returns  { safe: boolean, sanitized: string }
 *   - safe=true: 입력이 이미 sanitize 통과 상태 (클라이언트와 정합).
 *   - safe=false: 서버 sanitize 가 일부 제거 — 클라이언트가 우회 시도 또는 정책 차이.
 *     registration-validate 가 `description_html_unsafe` validation 에러로 거부.
 */
export function checkHtmlSafe(input: string): { safe: boolean; sanitized: string } {
  const sanitized = sanitizeHtmlServer(input)
  return {
    safe: sanitized === input,
    sanitized,
  }
}
