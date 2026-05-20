import { test as base, type Page } from '@playwright/test'

/**
 * 인증 fixture — 시드 셀러 세션 주입 (D-A axe 회귀 spec 전용).
 *
 * **현재 한계 (2026-05-20 WIP):**
 *   골든 패스 spec (`tests/e2e/golden-path.spec.ts`) 와 동일한 사전 조건 (a)(b)(c)
 *   를 그대로 상속한다 —
 *     (a) 시드 셀러 (`qa@marketcast.test` / `Qa!12345`) 가 debug/real Supabase 양쪽에
 *         생성되어 있어야 한다 — 현재 미생성.
 *     (b) Supabase Auth URL Configuration 등록.
 *     (c) MSW oauth handler 또는 동등한 mock.
 *   세 조건 중 하나라도 빠지면 본 fixture 는 실제 로그인을 수행할 수 없다.
 *
 * **본 PR 의 결정:**
 *   1) fixture 인터페이스 (`loginAsSeller(page)`) 는 지금 확정한다 — 추후 시드/세션
 *      주입 방식만 본 함수 안에서 바꾸면 모든 a11y spec 이 자동 활성화되도록 한다.
 *   2) 현재 구현은 placeholder 로 `throw new Error(...)` 하며, 호출하는 케이스는
 *      `test.fixme()` 로 보류한다 (WIP-5markets-mvp.md D 섹션 참조).
 *   3) 비인증 라우트 (`/login` /`/signup` /`/forgot-password` /`/reset-password`)
 *      는 본 fixture 없이도 검증 가능하므로 그쪽부터 즉시 활성화한다.
 *
 * **향후 본 함수 본구현 시나리오 (예상):**
 *   A. Supabase Auth `signInWithPassword` 를 evaluate 로 호출 → storage 에 세션 적재
 *      → reload. AuthContext 의 `getSession()` 이 hydrate 해 RequireAuth 통과.
 *   B. 또는 미리 발급한 JWT 를 localStorage `mc.auth` 키에 직접 inject (page.addInitScript).
 *      이 경로는 mock 시점에 가장 안정적이며 골든 패스가 G1 활성화될 때 같이 정착.
 *
 * 결정 (B 경로): platform.md / auth.md §3.5 의 storageKey `mc.auth` 를 사용하므로
 * Supabase 세션 객체를 그대로 직렬화 → addInitScript 로 주입하면 첫 페이지 로드 시
 * AuthContext 가 storage 에서 정상 hydrate 한다. 단, JWT 가 만료되지 않은 유효한
 * 시드값이 있어야 하며 이는 시드 셀러 생성과 동시에 결정될 사안이다.
 */

export const SEED_SELLER = {
  email: 'qa@marketcast.test',
  password: 'Qa!12345',
} as const

/**
 * 페이지에 시드 셀러 세션을 주입한다. 호출 후 인증 가드(`RequireAuth`) 가 통과되어야 함.
 *
 * 본 함수는 WIP 단계에서 throw 한다 — 호출부는 반드시 `test.fixme()` 로 감싸야 한다.
 * 시드 셀러 + JWT 가 확보되는 시점에 본 함수 내부만 구현하고 fixme 해제.
 */
export async function loginAsSeller(_page: Page): Promise<void> {
  // TODO(D-A 후속): 아래 분기 중 하나 채워 활성화.
  //
  // 옵션 A — Supabase JS 로 실 로그인 (가장 단순, MSW 가 supabase auth 엔드포인트
  //   까지 가짜화해야 함):
  //   await _page.goto('/login')
  //   await _page.getByRole('textbox', { name: '이메일' }).fill(SEED_SELLER.email)
  //   await _page.getByLabel('비밀번호').fill(SEED_SELLER.password)
  //   await _page.getByRole('button', { name: '로그인' }).click()
  //   await _page.waitForURL(/\/dashboard$/)
  //
  // 옵션 B — addInitScript 로 mc.auth storage 키에 세션 객체 직접 주입.
  //   (storageKey 는 lib/supabase.ts auth.storageKey === 'mc.auth')
  //   await _page.addInitScript((session) => {
  //     window.localStorage.setItem('mc.auth', JSON.stringify(session))
  //   }, MOCK_SESSION)
  //
  // 옵션 C — Playwright storageState 파일 (`playwright.config.ts` 의 use.storageState)
  //   을 글로벌로 채택하고 본 함수는 no-op.

  throw new Error(
    'loginAsSeller: 시드 셀러 (qa@marketcast.test) 미구현. WIP-5markets-mvp.md D 섹션 참조 후 본 함수 구현 + 호출부 test.fixme 해제.',
  )
}

/**
 * Playwright 의 test extend — fixture 형태로 더 자연스럽게 사용하고 싶을 때.
 * `import { test }` 가 본 모듈을 향하면 모든 케이스가 인증 후 시작.
 *
 * 본 인터페이스는 옵션. 직접 spec 안에서 `await loginAsSeller(page)` 를 호출해도 동등.
 */
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, runWith) => {
    await loginAsSeller(page)
    await runWith(page)
  },
})

export { expect } from '@playwright/test'
