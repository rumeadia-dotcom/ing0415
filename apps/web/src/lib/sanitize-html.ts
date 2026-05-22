import DOMPurify from 'dompurify'

/**
 * sanitizeHtml — WYSIWYG/사용자 입력 HTML 의 XSS 차단.
 * 마스터: docs/architecture/v1/features/registration.md §3.6.2
 *
 * 정책:
 *  - script / iframe / object / embed / link / meta / style 태그 제거
 *  - on* 이벤트 핸들러 속성 제거
 *  - href / src 의 javascript: vbscript: data: 스킴 차단 (DOMPurify 기본 동작)
 *  - 허용 태그: 본문 텍스트 + 인라인 마크업 + 리스트 + 이미지 + 링크
 *
 * 마켓 상세 HTML 로 그대로 전송되므로 server-side (Edge Function) 에서도 동일 정책 재검증 권장.
 */
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

export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style'],
    FORBID_ATTR: ['style'],
  })
}
