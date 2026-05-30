import { describe, expect, it } from 'vitest'
import { resolveShippingFee } from '../shipping-fee'

/**
 * resolveShippingFee 단위 테스트.
 *
 * 배경: 워커(data-load.ts)·validate(check.ts) 가 product 의 shipping_policy_id 를
 * SELECT 하면서도 배송비로 해소(resolve)하지 않고 shippingFeeKrw 를 0 으로
 * 하드코딩하던 버그 (cross-cutting/shipping-fee-model.md §3-1). 본 헬퍼가
 * shipping_policies.fee 를 조회해 배송비를 채운다.
 *
 * 커버리지:
 *   1) shipping_policy_id 가 null → 0 (배송정책 미지정 = 무료 기본).
 *   2) shipping_policy_id 가 유효 → 해당 정책의 fee 반환.
 *   3) 정책이 없거나 타 셀러 소유(seller_id WHERE 미스) → 0 (방어).
 */

interface PolicyRow {
  id: string
  seller_id: string
  fee: number
}

/** shipping_policies 만 담는 최소 in-memory mock client. */
function makeMockClient(policies: PolicyRow[]) {
  return {
    from(table: string) {
      if (table !== 'shipping_policies') {
        throw new Error(`unexpected table: ${table}`)
      }
      let rows = policies.slice()
      const chain = {
        select: (_cols: string) => chain,
        eq: (col: string, val: unknown) => {
          rows = rows.filter(
            (r) => (r as unknown as Record<string, unknown>)[col] === val,
          )
          return chain
        },
        maybeSingle: () =>
          Promise.resolve({ data: rows[0] ?? null, error: null }),
      }
      return chain
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('resolveShippingFee — shipping_policy_id → shipping_policies.fee', () => {
  it('shipping_policy_id 가 null 이면 0 (배송정책 미지정)', async () => {
    const client = makeMockClient([])
    expect(await resolveShippingFee(client, null, 'seller-1')).toBe(0)
  })

  it('유효 정책이면 해당 fee 반환', async () => {
    const client = makeMockClient([
      { id: 'pol-1', seller_id: 'seller-1', fee: 2500 },
    ])
    expect(await resolveShippingFee(client, 'pol-1', 'seller-1')).toBe(2500)
  })

  it('타 셀러 정책(seller_id WHERE 미스)이면 0', async () => {
    const client = makeMockClient([
      { id: 'pol-1', seller_id: 'seller-OTHER', fee: 2500 },
    ])
    expect(await resolveShippingFee(client, 'pol-1', 'seller-1')).toBe(0)
  })
})
