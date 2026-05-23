/**
 * 클라이언트 / 서버 sanitize parity 회귀 매트릭스.
 *
 * 출처 / 근거:
 *   - PR #118 (HTML 상세 XSS sanitize dual-defense 도입)
 *   - 마스터: docs/architecture/v1/features/registration.md §13.5 (description_html 정책)
 *   - CLAUDE.md "Rules → 보안 sanitize 단일 정책" + security.md §6.3
 *
 * 목적:
 *   클라이언트 (`apps/web/src/lib/sanitize-html.ts` — `dompurify`) 와
 *   서버    (`apps/api/supabase/functions/_shared/sanitize-html.ts` — `isomorphic-dompurify`)
 *   두 sanitize 가 동일 입력에 대해 동일 출력을 내는지 잠근다. 한쪽이 더 엄격하면
 *   "프론트 미리보기 통과 → 서버 거부 (description_html_unsafe)" drift 가 발생.
 *
 * 회귀 가드 정책:
 *   - 본 매트릭스 14건 모두에 대해 두 결과가 의미 동등 (whitespace 정규화 후 byte 일치).
 *   - 모든 결과에서 공격 표면 (<script>, on*=, javascript:, vbscript:, <iframe>, <base>,
 *     <meta>, <object>, <embed>, <link>, <style>) 부재.
 *   - ALLOWED_TAGS / ALLOWED_ATTR / FORBID 구성도 동일해야 함 (정책 probe 케이스).
 *
 * Vitest / Deno 브리지:
 *   서버 sanitize-html.ts 는 Deno specifier `npm:isomorphic-dompurify@2.20.0` 사용.
 *   vitest.config.ts 의 resolve.alias 에서 동일 버전 devDep 으로 매핑 (Node 환경).
 *
 * 본 테스트가 fail 하면:
 *   - 정책 drift 발생. 클라이언트/서버 sanitize-html.ts 의 ALLOWED_* / FORBID_* / 옵션을
 *     양쪽 동기화 + sanitize-html 의 단위 테스트 (apps/web/src/lib/__tests__) 도 함께 갱신.
 *   - DOMPurify / isomorphic-dompurify 메이저 버전 업도 동일 절차.
 */

import { describe, it, expect } from 'vitest'

import { sanitizeHtml as sanitizeHtmlClient } from '../../../apps/web/src/lib/sanitize-html'
import { sanitizeHtmlServer } from '../../../apps/api/supabase/functions/_shared/sanitize-html'

/**
 * 공격 표면 — 두 sanitizer 결과 모두에서 부재해야 하는 substring 목록.
 * 대소문자 무시 비교.
 */
const ATTACK_SURFACE = [
  '<script',
  '<iframe',
  '<object',
  '<embed',
  '<link',
  '<meta',
  '<style',
  '<base',
  'onerror=',
  'onload=',
  'onclick=',
  'javascript:',
  'vbscript:',
] as const

/**
 * payload 매트릭스. 각 항목은 두 sanitizer 의 의미 동등 출력이 기대됨.
 *
 * description 은 it.each 의 표시명. `mustContain` 은 (있다면) safe 마크업이 살아남는지
 * 확인. `mustNotContain` 은 추가로 검증할 약점 substring (ATTACK_SURFACE 외).
 */
interface Payload {
  readonly name: string
  readonly input: string
  readonly mustContain?: readonly string[]
  readonly mustNotContain?: readonly string[]
}

const PAYLOADS: readonly Payload[] = [
  {
    name: 'P01 순수 안전 HTML — <p><strong> 통과',
    input: '<p>안녕 <strong>가나다</strong></p>',
    mustContain: ['<p>', '<strong>', '안녕', '가나다'],
  },
  {
    name: 'P02 script tag 제거',
    input: '<p>before</p><script>alert(1)</script><p>after</p>',
    mustContain: ['before', 'after'],
    mustNotContain: ['alert'],
  },
  {
    name: 'P03 event handler (onerror) 속성 제거 — img 자체는 유지',
    input: '<img src="x" onerror="alert(1)" alt="ok">',
    mustContain: ['<img', 'alt="ok"'],
    mustNotContain: ['alert'],
  },
  {
    name: 'P04 data: URL (script) — href 제거',
    input: '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    mustContain: ['x'],
    mustNotContain: ['alert', 'data:text/html'],
  },
  {
    name: 'P05 javascript: URL — href 제거',
    input: '<a href="javascript:alert(1)">x</a>',
    mustContain: ['x'],
    mustNotContain: ['alert'],
  },
  {
    name: 'P06 SVG XSS — <svg><script> 제거',
    input: '<svg><script>alert(1)</script></svg>',
    mustNotContain: ['alert'],
  },
  {
    name: 'P07 SVG onload 속성 제거',
    input: '<svg onload="alert(1)"></svg>',
    mustNotContain: ['alert'],
  },
  {
    name: 'P08 iframe 제거',
    input: '<p>safe</p><iframe src="https://evil.com"></iframe>',
    mustContain: ['safe'],
  },
  {
    name: 'P09 style 안의 expression — javascript URL 제거 (style 속성도 차단)',
    input: '<div style="background:url(javascript:alert(1))">x</div>',
    mustContain: ['x'],
    mustNotContain: ['alert', 'style='],
  },
  {
    name: 'P10 mXSS — noscript 안의 mutation onerror 제거',
    input:
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    mustNotContain: ['alert'],
  },
  {
    name: 'P11 한글 + 안전 태그 혼합 통과',
    input: '<p>가나다 <em>강조</em> 라마</p>',
    mustContain: ['가나다', '<em>', '강조', '라마'],
  },
  {
    name: 'P12 중첩 의도 (<<SCRIPT>...) — script 제거',
    input: '<<SCRIPT>alert(1);//<</SCRIPT>',
    mustNotContain: ['alert'],
  },
  {
    name: 'P13 base tag (XSS via base href) 제거',
    input: '<base href="//evil.com/"><p>x</p>',
    mustContain: ['x'],
    mustNotContain: ['evil.com'],
  },
  {
    name: 'P14 meta refresh (javascript URL) 제거',
    input: '<meta http-equiv="refresh" content="0;url=javascript:alert(1)"><p>x</p>',
    mustContain: ['x'],
    mustNotContain: ['alert'],
  },
] as const

/**
 * whitespace 정규화 — DOMPurify / isomorphic-dompurify 구현이 인접 whitespace 를
 * 미세하게 다르게 다룰 가능성에 대비 (현재는 동일하지만 회귀 가드 안전 margin).
 * - 연속 공백 1칸으로 압축
 * - 줄바꿈 → 공백
 * - 양끝 trim
 */
function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function containsCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

describe('XSS sanitize parity (client DOMPurify vs server isomorphic-dompurify)', () => {
  it.each(PAYLOADS.map((p) => [p.name, p]))(
    '%s — 두 sanitizer 출력 동등 + 공격 표면 부재',
    (_name, payload) => {
      const clientOut = sanitizeHtmlClient(payload.input)
      const serverOut = sanitizeHtmlServer(payload.input)

      // 1. parity — whitespace 정규화 후 byte-for-byte 동일
      expect(normalizeWs(serverOut)).toBe(normalizeWs(clientOut))

      // 2. 공격 표면 부재 — 두 결과 모두에서 검증 (한쪽만 통과하는 회귀 차단)
      for (const surface of ATTACK_SURFACE) {
        expect(
          containsCaseInsensitive(clientOut, surface),
          `client 결과에 공격 표면 "${surface}" 가 남음: ${clientOut}`,
        ).toBe(false)
        expect(
          containsCaseInsensitive(serverOut, surface),
          `server 결과에 공격 표면 "${surface}" 가 남음: ${serverOut}`,
        ).toBe(false)
      }

      // 3. payload 별 추가 mustContain / mustNotContain
      for (const s of payload.mustContain ?? []) {
        expect(clientOut, `client 결과에 "${s}" 가 보존되어야 함`).toContain(s)
        expect(serverOut, `server 결과에 "${s}" 가 보존되어야 함`).toContain(s)
      }
      for (const s of payload.mustNotContain ?? []) {
        expect(
          containsCaseInsensitive(clientOut, s),
          `client 결과에 "${s}" 가 남음: ${clientOut}`,
        ).toBe(false)
        expect(
          containsCaseInsensitive(serverOut, s),
          `server 결과에 "${s}" 가 남음: ${serverOut}`,
        ).toBe(false)
      }
    },
  )

  it('빈 문자열 / 순수 텍스트도 동일', () => {
    expect(sanitizeHtmlClient('')).toBe(sanitizeHtmlServer(''))
    const text = 'Hello, 가나다 world'
    expect(sanitizeHtmlClient(text)).toBe(sanitizeHtmlServer(text))
  })

  it('idempotent — sanitize(sanitize(x)) === sanitize(x) (양쪽 모두)', () => {
    for (const payload of PAYLOADS) {
      const c1 = sanitizeHtmlClient(payload.input)
      const c2 = sanitizeHtmlClient(c1)
      expect(normalizeWs(c2)).toBe(normalizeWs(c1))

      const s1 = sanitizeHtmlServer(payload.input)
      const s2 = sanitizeHtmlServer(s1)
      expect(normalizeWs(s2)).toBe(normalizeWs(s1))
    }
  })
})

describe('XSS sanitize parity — config (ALLOWED_TAGS / ALLOWED_ATTR / FORBID) 동기 가드', () => {
  /**
   * 두 모듈의 정책 상수는 export 되지 않음 (내부 const). 정책 drift 가드를
   * 직접 비교 대신 "정책으로부터 도출되는 행동" 으로 잠근다 — 즉, 다음 보조
   * 입력 세트의 결과가 클라이언트·서버 모두 동일하다는 것을 명시적으로 잠가
   * 정책 항목 자체의 변동을 회귀로 감지한다.
   *
   * 변경이 합법적인 경우 (예: 정책에 <table> 추가) 본 테스트도 함께 갱신.
   */

  const POLICY_PROBES: readonly { name: string; input: string }[] = [
    // ALLOWED_TAGS probe — 정책에 있는 태그면 보존, 없으면 제거
    { name: 'allow: p strong em u s code pre blockquote', input: '<p><strong>a</strong><em>b</em><u>c</u><s>d</s><code>e</code><pre>f</pre><blockquote>g</blockquote></p>' },
    { name: 'allow: h1-h6', input: '<h1>1</h1><h2>2</h2><h3>3</h3><h4>4</h4><h5>5</h5><h6>6</h6>' },
    { name: 'allow: ul ol li', input: '<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>' },
    { name: 'allow: a img span div hr br', input: '<div><span>x</span><br><hr><a href="https://x">y</a><img src="https://x/i.png" alt=""></div>' },
    // FORBID_TAGS probe
    { name: 'forbid: script iframe object embed link meta style', input: '<script>1</script><iframe></iframe><object></object><embed><link><meta><style>x</style>' },
    // FORBID_ATTR probe — style 속성 차단
    { name: 'forbid attr: style', input: '<p style="color:red">x</p>' },
    // ALLOWED_ATTR probe — href / target / rel / src / alt / title / class 유지
    { name: 'allow attr: href target rel', input: '<a href="https://example.com" target="_blank" rel="noopener">x</a>' },
    { name: 'allow attr: src alt title', input: '<img src="https://x/i.png" alt="alt" title="title">' },
    { name: 'allow attr: class', input: '<p class="foo">x</p>' },
    // ALLOW_DATA_ATTR=false probe
    { name: 'forbid: data-* attr', input: '<p data-foo="bar">x</p>' },
  ]

  it.each(POLICY_PROBES.map((p) => [p.name, p.input]))(
    '%s — client / server 동일 출력',
    (_name, input) => {
      const clientOut = sanitizeHtmlClient(input)
      const serverOut = sanitizeHtmlServer(input)
      expect(normalizeWs(serverOut)).toBe(normalizeWs(clientOut))
    },
  )
})
