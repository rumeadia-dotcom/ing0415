/**
 * Cycle 48 — console 사용 audit + robots.txt 추가.
 *
 * 점검 결과:
 *  console.* 직접 호출 4건 — 모두 인프라/dev 디버그 영역으로 정상:
 *   - lib/mock/createMockSupabase.ts: mock dev 디버그
 *   - lib/logen/client.ts: 자체 logger wrapper
 *   - address-search-input.tsx (cycle 47): dev 디버그
 *
 *  public/ 자산:
 *   ⚠ robots.txt 부재 — 셀러 전용 SaaS 페이지가 검색 결과에 노출될 가능성.
 *   → 본 PR 에서 추가.
 *
 * 본 PR 의 수정:
 *  - apps/web/public/robots.txt 신규:
 *    인증 / 셀러 전용 페이지 (dashboard, markets, register, history, orders, shipping,
 *    settings, login, signup, forgot/reset-password) → Disallow
 *    법적 페이지 (legal/*, manual) → Allow (외부 사용자가 검색 도달 가능해야 함)
 */
import { mkdir } from 'node:fs/promises'
const OUT = './verify-out/cycle-48'
await mkdir(OUT, { recursive: true })

const BASE = process.env.BASE_URL ?? 'http://localhost:5174'
const res = await fetch(`${BASE}/robots.txt`)
const text = await res.text()
console.log(`GET /robots.txt → ${res.status}`)
console.log(text.slice(0, 200))
