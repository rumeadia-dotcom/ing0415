/**
 * orders-sync Edge Function 계약 / 시그니처 검증 (Vitest 측).
 *
 * 마스터 (예정):
 *   - PRD-v2-shipping.md §2.1
 *   - user_flow-v2-shipping.md s8 n51
 *
 * 본 파일의 위치 근거:
 *   - Edge Function 본체는 Deno + `npm:` specifier 의존 → Vitest 가 직접 import 불가.
 *   - 그러므로 본 테스트는 (1) Edge Function 디렉토리 / 핵심 파일 존재 (2) 마이그레이션 cron 등록
 *     (3) shape check 헬퍼 의미 — 외부 관찰 가능한 contract 만 검증.
 *   - Deno test 측 ./apps/api/supabase/functions/orders-sync/__tests__/sync.test.ts 가
 *     실제 어댑터 fan-out / 중복 방지 / 한 마켓 실패 격리를 검증.
 *
 * 강제:
 *   - 본 PR 의 산출물 5개 (index.ts / deno.json / README.md / lib/*.ts / __tests__/*.ts) 가 모두 존재.
 *   - 마이그레이션 파일이 pg_cron + net.http_post + 10분 스케줄 + jobname 'orders-sync-every-10min' 포함.
 *   - Edge Function 본문에 service_role 가드 + 'POST required' 가드 + 24h 윈도우 명시.
 */

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const FUNC_DIR = path.join(
  ROOT,
  'apps/api/supabase/functions/orders-sync',
)
const MIGRATION_PATH = path.join(
  ROOT,
  'apps/api/supabase/migrations/20260521000010_pg_cron_orders_sync.sql',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

describe('orders-sync: Edge Function 산출물', () => {
  it('필수 파일이 모두 존재한다', () => {
    expect(fs.existsSync(path.join(FUNC_DIR, 'index.ts'))).toBe(true)
    expect(fs.existsSync(path.join(FUNC_DIR, 'deno.json'))).toBe(true)
    expect(fs.existsSync(path.join(FUNC_DIR, 'README.md'))).toBe(true)
    expect(fs.existsSync(path.join(FUNC_DIR, 'lib/sync.ts'))).toBe(true)
    expect(fs.existsSync(path.join(FUNC_DIR, 'lib/orders-repo.ts'))).toBe(true)
    expect(fs.existsSync(path.join(FUNC_DIR, 'lib/adapter-shape.ts'))).toBe(
      true,
    )
    expect(
      fs.existsSync(path.join(FUNC_DIR, '__tests__/sync.test.ts')),
    ).toBe(true)
  })

  it('index.ts 가 service_role 가드 + POST 가드 + withRequest 진입을 사용한다', () => {
    const src = read(path.join(FUNC_DIR, 'index.ts'))
    expect(src).toMatch(/isServiceRoleCall/)
    expect(src).toMatch(/POST required/)
    expect(src).toMatch(/withRequest\(\s*'orders-sync'/)
    expect(src).toMatch(/syncOrders/)
  })

  it('sync.ts 가 24h 윈도우 + 결제완료 + 4 마켓 한정 + try/catch per market 패턴을 가진다', () => {
    const src = read(path.join(FUNC_DIR, 'lib/sync.ts'))
    expect(src).toMatch(/ORDER_SYNC_WINDOW_HOURS\s*=\s*24/)
    expect(src).toMatch(/결제완료/)
    expect(src).toMatch(/'naver'.*'coupang'.*'gmarket'.*'auction'/s)
    // 한 마켓 실패가 다른 마켓 진행 안 막음 → try/catch 또는 continue 흐름 존재.
    expect(src).toMatch(/continue/)
  })

  it('orders-repo.ts upsert 가 onConflict + ignoreDuplicates: true 를 사용', () => {
    const src = read(path.join(FUNC_DIR, 'lib/orders-repo.ts'))
    expect(src).toMatch(/onConflict:\s*'seller_id,market_id,external_order_id'/)
    expect(src).toMatch(/ignoreDuplicates:\s*true/)
  })

  it('adapter-shape.ts 가 fetchOrders 시그니처와 hasFetchOrders 가드를 정의', () => {
    const src = read(path.join(FUNC_DIR, 'lib/adapter-shape.ts'))
    expect(src).toMatch(/fetchOrders\s*\(/)
    expect(src).toMatch(/hasFetchOrders/)
    expect(src).toMatch(/OrderSyncAdapter/)
  })
})

describe('orders-sync: pg_cron 마이그레이션', () => {
  it('마이그레이션 파일이 존재하고 10분 cron + net.http_post + jobname 을 등록한다', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true)
    const sql = read(MIGRATION_PATH)
    expect(sql).toMatch(/create extension if not exists pg_cron/)
    expect(sql).toMatch(/create extension if not exists pg_net/)
    expect(sql).toMatch(/orders-sync-every-10min/)
    expect(sql).toMatch(/\*\/10 \* \* \* \*/)
    expect(sql).toMatch(/net\.http_post/)
    expect(sql).toMatch(/\/orders-sync/)
    // vault 경유 — 평문 service_role 노출 금지.
    expect(sql).toMatch(/vault\.decrypted_secrets/)
  })

  it('이전 동명 cron 이 있으면 unschedule → re-schedule (멱등)', () => {
    const sql = read(MIGRATION_PATH)
    expect(sql).toMatch(/cron\.unschedule\('orders-sync-every-10min'\)/)
    expect(sql).toMatch(/cron\.schedule\(\s*\n?\s*'orders-sync-every-10min'/)
  })
})

describe('orders-sync: README 메타', () => {
  it('의존 PR 머지 순서 + OUT OF SCOPE 명시', () => {
    const md = read(path.join(FUNC_DIR, 'README.md'))
    expect(md).toMatch(/PR2/)
    expect(md).toMatch(/PR4/)
    expect(md).toMatch(/PR6/)
    expect(md).toMatch(/OUT OF SCOPE/)
    expect(md).toMatch(/로젠 등록/)
  })
})
