import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * W1·W2 회귀 가드 (소스 레벨 — Edge 모듈은 Deno 런타임 import 라 vitest 직접 실행 불가).
 * DB 사실은 supabase-dev MCP 로 교차검증:
 *   - product_image_transforms 는 image_id 만 가지고 product_id 컬럼이 없다(FK: image_id→product_images.id).
 *   - fn_registration_job_transition 전이표는 retrying→terminal 을 거부(retrying→running|cancelled 만 합법).
 *   - rpc_recompute_job_status 는 전이표를 우회해 직접 UPDATE → retrying 에서도 terminal 전이 가능.
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const dataLoad = readFileSync(join(HERE, '..', 'lib', 'data-load.ts'), 'utf-8')
const jmrUpdate = readFileSync(join(HERE, '..', 'lib', 'jmr-update.ts'), 'utf-8')

describe('W2 — product_image_transforms 조회 (data-load.ts)', () => {
  it("transforms 를 없는 컬럼 product_id 로 필터하지 않는다", () => {
    // product_image_transforms 쿼리 직후 .eq('product_id', ...) 가 오면 안 됨 (42703).
    expect(dataLoad).not.toMatch(/product_image_transforms[\s\S]{0,200}\.eq\('product_id'/)
  })

  it('image_id 조인으로 변환본을 조회한다', () => {
    expect(dataLoad).toMatch(/\.in\('image_id'/)
    expect(dataLoad).toMatch(/\.from\('product_images'\)/)
  })

  it('product_images 조회에 seller_id cross-tenant 가드가 있다', () => {
    // product_images 쿼리에 product_id + seller_id 둘 다 필터.
    expect(dataLoad).toMatch(/\.from\('product_images'\)[\s\S]{0,200}\.eq\('seller_id'/)
  })
})

describe('W1 — 잡 상태 재계산 (jmr-update.ts)', () => {
  it('종결 판정을 rpc_recompute_job_status 에 위임한다', () => {
    expect(jmrUpdate).toMatch(/rpc_recompute_job_status/)
  })

  it("fn_registration_job_transition 으로 terminal(succeeded/partial/failed) 직접 전이를 시도하지 않는다", () => {
    // 과거 버그: p_to_status: next (next ∈ terminal) 를 retrying 상태에서 호출 → illegal_transition.
    expect(jmrUpdate).not.toMatch(/p_to_status:\s*next/)
    // fn_registration_job_transition 에 넘기는 target 은 'running' 뿐이어야 한다.
    const transitionTargets = [...jmrUpdate.matchAll(/p_to_status:\s*'([a-z]+)'/g)].map((m) => m[1])
    expect(transitionTargets.every((t) => t === 'running')).toBe(true)
  })
})
