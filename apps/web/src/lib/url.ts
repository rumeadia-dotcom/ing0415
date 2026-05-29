/**
 * URL 빌더 유틸 — Vite base path (GitHub Pages subpath) 처리.
 *
 * 마스터: `apps/web/src/app/router.tsx` 의 resolveBasename 동일 로직 추출.
 *
 * 운영 환경 (`VITE_BASE_PATH=/ing0415/`) 과 로컬 dev/preview (`base: './'`)
 * 모두에서 일관된 absolute URL 을 만들기 위함. Supabase Auth 의
 * `emailRedirectTo` / `redirectTo` 는 절대 URL 필요 — `${origin}/login` 같은
 * naive 결합은 subpath 누락으로 GitHub Pages 404 유발 (실제 사고: 신규
 * 회원가입 이메일 인증 후 https://rumeadia-dotcom.github.io/login 으로 redirect →
 * 루트에 /login 라우트 없어 404).
 */

/**
 * Vite `import.meta.env.BASE_URL` 을 React Router basename 또는 URL prefix
 * 로 정규화. router.tsx 와 동일 규칙.
 *
 *  - `''` / `'/'` / `'./'` / `'.'` 으로 시작하는 상대 base → `'/'`
 *  - `'/ing0415/'` 같은 absolute subpath → trailing slash 제거한 `'/ing0415'`
 */
export function resolveBasename(rawBase: string | undefined): string {
  if (!rawBase || rawBase === '/' || rawBase === './' || rawBase.startsWith('.')) {
    return '/'
  }
  return rawBase.replace(/\/$/, '')
}

/**
 * origin + base path + route path 를 합쳐 redirect 용 absolute URL 을 만든다.
 *
 *  - dev (`BASE_URL='./'`)        : origin + '/login'      = 'http://localhost:5173/login'
 *  - 운영 (`BASE_URL='/ing0415/'`) : origin + '/ing0415/login' = 'https://rumeadia-dotcom.github.io/ing0415/login'
 *
 * @param origin window.location.origin 등 (예: 'https://example.com')
 * @param routePath router 내부 path. 항상 `/` 로 시작해야 함 (예: '/login').
 * @param baseUrl Vite base. 기본값은 `import.meta.env.BASE_URL` — 호출측이 명시 전달 가능 (테스트용).
 */
export function buildAppUrl(
  origin: string,
  routePath: string,
  baseUrl: string | undefined = (
    typeof import.meta !== 'undefined' ? import.meta.env?.BASE_URL : undefined
  ) as string | undefined,
): string {
  if (!routePath.startsWith('/')) {
    throw new Error(`buildAppUrl: routePath must start with '/' (got: ${routePath})`)
  }
  const basename = resolveBasename(baseUrl)
  const prefix = basename === '/' ? '' : basename
  return `${origin}${prefix}${routePath}`
}
