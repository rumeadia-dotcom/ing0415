/**
 * orders-sync Edge Function 계약 / 시그니처 검증 (Vitest 측).
 *
 * 마스터:
 *   - docs/spec/PRD-v2-shipping.md §2.1 (자동 처리 트리거)
 *   - docs/spec/PRD-v2-shipping.md §4 (orders 테이블 컬럼 ground truth)
 *   - apps/web/src/lib/schemas/market-orders.ts (PR4 어댑터 시그니처 — 머지 후)
 *
 * 본 파일의 위치 근거:
 *   - Edge Function 본체는 Deno + `npm:` specifier 의존 → Vitest 가 직접 import 불가.
 *   - 그러므로 본 테스트는 (1) Edge Function 디렉토리 / 핵심 파일 존재 (2) 마이그레이션 cron 등록
 *     (3) PRD §4 컬럼 매핑 / PR4 시그니처 정합 — 외부 관찰 가능한 contract 만 검증.
 *   - Deno test 측 ./apps/api/supabase/functions/orders-sync/__tests__/sync.test.ts 가
 *     실제 어댑터 fan-out / 중복 방지 / 한 마켓 실패 격리 / status 필터를 검증.
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

  it('sync.ts 가 24h 윈도우 + 4 마켓 한정 + try/catch per market 패턴', () => {
    const src = read(path.join(FUNC_DIR, 'lib/sync.ts'))
    expect(src).toMatch(/ORDER_SYNC_WINDOW_HOURS\s*=\s*24/)
    expect(src).toMatch(/'naver'.*'coupang'.*'gmarket'.*'auction'/s)
    // 한 마켓 실패가 다른 마켓 진행 안 막음 → continue 분기.
    expect(src).toMatch(/continue/)
    // PR4 fetchOrders 시그니처 — sellerId + statuses 배열.
    expect(src).toMatch(/sellerId:\s*account\.sellerId/)
    expect(src).toMatch(/statuses:\s*\[\.\.\.ORDER_SYNC_TARGET_STATUSES\]/)
    // 한글 raw status 직접 다루지 않음 — 어댑터 정규화 enum 만.
    expect(src).not.toMatch(/'결제완료'/)
    expect(src).not.toMatch(/'배송대기'/)
  })

  it('adapter-shape.ts 가 PR4 시그니처와 1:1 매핑', () => {
    const src = read(path.join(FUNC_DIR, 'lib/adapter-shape.ts'))
    // 정규화 status enum 7종 (PR4 MarketOrderStatusSchema).
    expect(src).toMatch(/'new_pay'/)
    expect(src).toMatch(/'dispatched'/)
    expect(src).toMatch(/'delivering'/)
    expect(src).toMatch(/'delivered'/)
    expect(src).toMatch(/'cancelled'/)
    expect(src).toMatch(/'returned'/)
    expect(src).toMatch(/'unknown'/)
    // MarketOrder 필드 (PR4 = PRD §4 매핑).
    expect(src).toMatch(/buyerName/)
    expect(src).toMatch(/receiverName/)
    expect(src).toMatch(/receiverAddress/)
    expect(src).toMatch(/receiverPhone/)
    expect(src).toMatch(/productName/)
    expect(src).toMatch(/quantity/)
    expect(src).toMatch(/orderAmount/)
    expect(src).toMatch(/paidAt/)
    // 폴링 대상 = new_pay (결제완료/배송대기 흡수).
    expect(src).toMatch(/ORDER_SYNC_TARGET_STATUSES/)
    // 어댑터 contract.
    expect(src).toMatch(/fetchOrders\s*\(/)
    expect(src).toMatch(/hasFetchOrders/)
    expect(src).toMatch(/OrderSyncAdapter/)
  })

  it('orders-repo.ts 가 PRD §4 컬럼으로 매핑 + onConflict + ignoreDuplicates', () => {
    const src = read(path.join(FUNC_DIR, 'lib/orders-repo.ts'))
    // PRD §4 UNIQUE 키.
    expect(src).toMatch(
      /onConflict:\s*'market_id,external_order_id,seller_id'/,
    )
    expect(src).toMatch(/ignoreDuplicates:\s*true/)
    // PRD §4 컬럼 매핑.
    expect(src).toMatch(/buyer_name/)
    expect(src).toMatch(/receiver_name/)
    expect(src).toMatch(/receiver_address/)
    expect(src).toMatch(/receiver_phone/)
    expect(src).toMatch(/product_name/)
    expect(src).toMatch(/order_amount/)
    expect(src).toMatch(/collected_at/)
    // DB status 는 영문 ENUM 'collected' 로 정규화 (PRD §4).
    expect(src).toMatch(/status:\s*'collected'/)
    // payload jsonb 의존 제거.
    expect(src).not.toMatch(/payload:/)
    expect(src).not.toMatch(/ordered_at/)
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
