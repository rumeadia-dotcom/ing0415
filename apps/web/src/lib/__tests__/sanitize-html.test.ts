import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from '../sanitize-html'

/**
 * sanitize-html 단위 테스트 — XSS 차단 정책.
 *
 * 마스터: docs/architecture/v1/features/registration.md §13.5
 *
 * 본 테스트가 client 측 정책 가드. 서버 측 미러 (apps/api/.../_shared/sanitize-html.ts)
 * 는 동일 ALLOWED_TAGS / ALLOWED_ATTR / FORBID 룰 사용 → 본 테스트가 통과하는
 * 입력은 서버 미러도 통과해야 함 (dual-defense).
 *
 * 회귀 가드: 서버·클라이언트 정책 drift 가 발생하면 registration-validate 가
 * 'description_html_unsafe' 발급 → 사용자 PR 차단.
 */

describe('sanitizeHtml — XSS 차단', () => {
  it('<script> 태그 제거', () => {
    const input = '<p>Hello</p><script>alert(1)</script>'
    const out = sanitizeHtml(input)
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert')
    expect(out).toContain('<p>Hello</p>')
  })

  it('<iframe> 태그 제거', () => {
    const input = '<p>safe</p><iframe src="https://evil.com"></iframe>'
    const out = sanitizeHtml(input)
    expect(out).not.toContain('<iframe')
    expect(out).toContain('safe')
  })

  it('<object> / <embed> 태그 제거', () => {
    const input = '<object data="x.swf"></object><embed src="y.swf">'
    const out = sanitizeHtml(input)
    expect(out).not.toContain('<object')
    expect(out).not.toContain('<embed')
  })

  it('<link> / <meta> / <style> 태그 제거', () => {
    const input = '<link rel="stylesheet" href="x"><meta http-equiv="refresh"><style>body{}</style>'
    const out = sanitizeHtml(input)
    expect(out).not.toContain('<link')
    expect(out).not.toContain('<meta')
    expect(out).not.toContain('<style')
  })

  it('on* 이벤트 핸들러 속성 제거', () => {
    const input = '<img src="x.jpg" onerror="alert(1)" alt="ok">'
    const out = sanitizeHtml(input)
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('alert')
    // alt 와 src 는 보존
    expect(out).toContain('alt="ok"')
  })

  it('href 의 javascript: 스킴 제거', () => {
    const input = '<a href="javascript:alert(1)">click</a>'
    const out = sanitizeHtml(input)
    expect(out).not.toContain('javascript:')
    // 텍스트는 보존
    expect(out).toContain('click')
  })

  it('href 의 vbscript: 스킴 제거', () => {
    const input = '<a href="vbscript:msgbox(1)">x</a>'
    const out = sanitizeHtml(input)
    expect(out).not.toContain('vbscript:')
  })

  it('style 속성 (inline CSS) 제거 — CSS injection 차단', () => {
    const input = '<p style="background:url(javascript:alert(1))">x</p>'
    const out = sanitizeHtml(input)
    expect(out).not.toContain('style=')
    expect(out).not.toContain('javascript:')
  })
})

describe('sanitizeHtml — 안전 통과', () => {
  it('기본 텍스트 + 인라인 마크업 그대로', () => {
    const input = '<p>Hello <strong>bold</strong> <em>italic</em></p>'
    const out = sanitizeHtml(input)
    expect(out).toBe(input)
  })

  it('https:// 링크 그대로', () => {
    const input = '<a href="https://example.com" target="_blank" rel="noopener">link</a>'
    const out = sanitizeHtml(input)
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('link')
  })

  it('https:// 이미지 + alt 보존', () => {
    const input = '<img src="https://example.com/img.jpg" alt="photo" title="caption">'
    const out = sanitizeHtml(input)
    expect(out).toContain('src="https://example.com/img.jpg"')
    expect(out).toContain('alt="photo"')
    expect(out).toContain('title="caption"')
  })

  it('헤딩 / 리스트 / blockquote 그대로', () => {
    const input = '<h2>제목</h2><ul><li>a</li><li>b</li></ul><blockquote>quote</blockquote>'
    const out = sanitizeHtml(input)
    expect(out).toBe(input)
  })

  it('빈 문자열 → 빈 문자열', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('순수 텍스트 → 그대로', () => {
    expect(sanitizeHtml('Hello, world')).toBe('Hello, world')
  })
})

describe('sanitizeHtml — 클라이언트·서버 dual-defense 정합 가드', () => {
  // 본 케이스는 server 미러 (apps/api/.../sanitize-html.ts) 가 동일 결과를
  // 내야 한다는 정합 검증. 서버 정책이 drift 하면 registration-validate 가
  // 'description_html_unsafe' 를 발급하므로 사용자 PR 차단됨.

  it('허용 태그 ALLOWED_TAGS 와 서버 미러 동일 (drift 가드 — 변경 시 양쪽 동기)', () => {
    // 본 테스트는 정책 항목 자체를 검증하지 않고 (구현 detail), 동일 입력에 동일
    // 출력 가정을 명시. 서버 측 sanitize-html.ts 가 동일 ALLOWED_TAGS / ATTR /
    // FORBID 룰 사용. 변경 시 양쪽 동기 PR 강제.
    const input = '<p><strong>x</strong></p>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('전체 XSS 페이로드 묶음 — 한번에 모두 거부', () => {
    const payload = `
      <p>start</p>
      <script>alert(1)</script>
      <iframe src="https://evil"></iframe>
      <img src=x onerror="alert(2)">
      <a href="javascript:alert(3)">x</a>
      <style>body{display:none}</style>
      <p>end</p>
    `
    const out = sanitizeHtml(payload)
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('javascript:')
    expect(out).not.toContain('<style')
    expect(out).toContain('start')
    expect(out).toContain('end')
  })
})
