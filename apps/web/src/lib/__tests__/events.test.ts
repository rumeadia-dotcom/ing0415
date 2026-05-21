import { describe, it, expect, vi, beforeEach } from 'vitest'

const invokeMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: invokeMock },
  }),
}))

import { trackShippingEvent } from '../events'

beforeEach(() => {
  invokeMock.mockReset()
})

describe('trackShippingEvent (v2 KPI)', () => {
  it('happy: shipping-event-log Edge Function 을 정확한 body 로 호출', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null })
    await trackShippingEvent({
      event: 'orders.collected',
      meta: { count: 3 },
    })
    expect(invokeMock).toHaveBeenCalledWith('shipping-event-log', {
      body: { event: 'orders.collected', meta: { count: 3 } },
    })
  })

  it('meta 미지정 시 빈 객체로 전송', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null })
    await trackShippingEvent({ event: 'orders.waybill_printed' })
    const call = invokeMock.mock.calls[0]?.[1] as { body: { meta: unknown } }
    expect(call.body.meta).toEqual({})
  })

  it('invoke error 반환 시 throw 하지 않음 (fire-and-forget)', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'network down' },
    })
    await expect(
      trackShippingEvent({ event: 'orders.tracking_submitted' }),
    ).resolves.toBeUndefined()
  })

  it('invoke 예외 throw 해도 swallow', async () => {
    invokeMock.mockRejectedValue(new Error('boom'))
    await expect(
      trackShippingEvent({ event: 'orders.logen_registered' }),
    ).resolves.toBeUndefined()
  })

  it('v2 이벤트 4종 모두 호출 가능 (PRD §1.5 KPI)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: null })
    const events = [
      'orders.collected',
      'orders.logen_registered',
      'orders.waybill_printed',
      'orders.tracking_submitted',
    ] as const
    for (const e of events) {
      await trackShippingEvent({ event: e })
    }
    expect(invokeMock).toHaveBeenCalledTimes(4)
  })
})
