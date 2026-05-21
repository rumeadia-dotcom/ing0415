/**
 * 로젠 SDK 단위 테스트.
 *
 * 마스터:
 *   - docs/architecture/v1/testing.md §6 (외부 호출 mock fetch 패턴)
 *   - CLAUDE.md "외부 API 로깅 패턴"
 *
 * 시나리오:
 *   1. getSlipNo — 정상 응답
 *   2. getSlipNo — 401 → unauthorized
 *   3. getSlipNo — 429 → rate_limit
 *   4. getSlipNo — 5xx → server
 *   5. getSlipNo — network abort → network
 *   6. getSlipNo — resultCd 비정상 → 코드 매핑
 *   7. registerOrderData — 정상
 *   8. registerOrderData — resultCd 실패
 *   9. buildPrintPopupUrl — URL 빌더 정합
 *  10. inquirySlipNoMulti — 정상 list normalize
 *  11. 로그에 userId / custCd 평문 미노출 (길이만)
 */

import { describe, it, expect, vi } from 'vitest'
import {
  consoleLogenLogger,
  createLogenClient,
  LogenError,
  type LogenLogger,
} from '../index'

const BASE_URL = 'https://topenapi.ilogen.com'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

function makeMemoryLogger(): {
  logger: LogenLogger
  entries: { level: string; ctx: Record<string, unknown>; msg: string }[]
} {
  const entries: { level: string; ctx: Record<string, unknown>; msg: string }[] = []
  return {
    entries,
    logger: {
      info: (ctx, msg) => entries.push({ level: 'info', ctx, msg }),
      warn: (ctx, msg) => entries.push({ level: 'warn', ctx, msg }),
      error: (ctx, msg) => entries.push({ level: 'error', ctx, msg }),
    },
  }
}

describe('logen client — getSlipNo', () => {
  it('정상 응답 — slipNo 배열 normalize', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCd: '00',
        startSlipNo: '1234567890',
        closeSlipNo: '1234567892',
        slipNo: ['1234567890', '1234567891', '1234567892'],
      }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'TESTUSER',
      custCd: 'CUST123',
      fetchImpl,
      logger: consoleLogenLogger(),
    })
    const result = await client.getSlipNo({ slipQty: 3 })
    expect(result.startSlipNo).toBe('1234567890')
    expect(result.slipNo).toHaveLength(3)
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [calledUrl, calledInit] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain('/lrm02b-edi/edi/getSlipNo')
    expect(calledInit.method).toBe('POST')
    // userId 가 body 에 포함되어야 하지만 헤더 / URL 에는 미포함.
    expect(typeof calledInit.body).toBe('string')
    expect(calledInit.body as string).toContain('TESTUSER')
  })

  it('응답 형식이 slipNoList 키일 때도 수용', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCd: '00',
        startSlipNo: '1000000001',
        closeSlipNo: '1000000001',
        slipNoList: ['1000000001'],
      }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    const result = await client.getSlipNo({ slipQty: 1 })
    expect(result.slipNo).toEqual(['1000000001'])
  })

  it('401 → LogenError unauthorized', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('forbidden', 401))
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    await expect(client.getSlipNo({ slipQty: 1 })).rejects.toMatchObject({
      name: 'LogenError',
      code: 'unauthorized',
    })
  })

  it('429 → LogenError rate_limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('rate limited', 429))
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    await expect(client.getSlipNo({ slipQty: 1 })).rejects.toMatchObject({
      code: 'rate_limit',
    })
  })

  it('5xx → LogenError server', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(textResponse('boom', 503))
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    await expect(client.getSlipNo({ slipQty: 1 })).rejects.toMatchObject({
      code: 'server',
    })
  })

  it('fetch reject (network) → LogenError network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    await expect(client.getSlipNo({ slipQty: 1 })).rejects.toMatchObject({
      code: 'network',
    })
  })

  it('timeout (abort) → LogenError network', async () => {
    // fetchImpl 가 abort 신호를 받으면 DOMException AbortError 와 동등한 에러 throw.
    const fetchImpl = vi.fn(async (_url, init?: RequestInit): Promise<Response> => {
      const signal = init?.signal
      return await new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          // DOMException 이 없는 환경(jsdom) 대비.
          const err =
            typeof DOMException !== 'undefined'
              ? new DOMException('aborted', 'AbortError')
              : Object.assign(new Error('aborted'), { name: 'AbortError' })
          reject(err)
        })
      })
    })
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
      timeoutMs: 5,
    })
    await expect(client.getSlipNo({ slipQty: 1 })).rejects.toMatchObject({
      code: 'network',
    })
  })

  it('resultCd 가 AUTH001 인 경우 unauthorized', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCd: 'AUTH001',
        resultMsg: 'invalid userId',
      }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    const err = await client.getSlipNo({ slipQty: 1 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LogenError)
    expect((err as LogenError).code).toBe('unauthorized')
    expect((err as LogenError).context.resultCd).toBe('AUTH001')
  })

  it('성공 resultCd 인데 필수 필드 누락 → server', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCd: '00',
        // startSlipNo / closeSlipNo 누락
      }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    await expect(client.getSlipNo({ slipQty: 1 })).rejects.toMatchObject({
      code: 'server',
    })
  })

  it('로그에 userId / custCd 평문 미노출 (길이만)', async () => {
    const { logger, entries } = makeMemoryLogger()
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCd: '00',
        startSlipNo: '1',
        closeSlipNo: '1',
        slipNo: ['1'],
      }),
    )
    createLogenClient({
      baseUrl: BASE_URL,
      userId: 'SECRETUSERID',
      custCd: 'SECRETCUST',
      fetchImpl,
      logger,
    })
    const allCtxJson = JSON.stringify(entries)
    expect(allCtxJson).not.toContain('SECRETUSERID')
    expect(allCtxJson).not.toContain('SECRETCUST')
    expect(allCtxJson).toContain('userIdLen')
  })
})

describe('logen client — registerOrderData', () => {
  const validPayload = {
    takeDt: '20260521',
    sndCustNm: '발송인',
    sndCustAddr: '서울시 강남구 테스트로 1',
    sndTelNo: '02-1234-5678',
    rcvCustNm: '수취인',
    rcvCustAddr: '서울시 송파구 수취로 9',
    rcvTelNo: '010-9999-9999',
    fareTy: 'C',
    qty: 1,
    dlvFare: 0,
    fixTakeNo: 'ORDER-001',
    slipNo: '1234567890',
  }

  it('정상 응답 → fixTakeNo 와 resultCd 반환', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCd: '00',
        fixTakeNo: 'ORDER-001',
        slipNo: '1234567890',
      }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    const result = await client.registerOrderData(validPayload)
    expect(result.fixTakeNo).toBe('ORDER-001')
    expect(result.resultCd).toBe('00')
  })

  it('resultCd echo 없을 때 요청값으로 fallback', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ resultCd: 'OK' }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    const result = await client.registerOrderData(validPayload)
    expect(result.fixTakeNo).toBe('ORDER-001')
  })

  it('VAL 코드 → validation 에러', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCd: 'VAL100',
        errorMsg: '수취인 주소 누락',
      }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    const err = await client.registerOrderData(validPayload).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LogenError)
    expect((err as LogenError).code).toBe('validation')
  })

  it('SYS 코드 → server 에러 + retryable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ resultCd: 'SYS500', resultMsg: 'db down' }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    const err = (await client
      .registerOrderData(validPayload)
      .catch((e: unknown) => e)) as LogenError
    expect(err.code).toBe('server')
    expect(err.retryable).toBe(true)
  })

  it('takeDt 형식 위반 → zod validation throw (요청 직전)', async () => {
    const fetchImpl = vi.fn()
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    await expect(
      client.registerOrderData({ ...validPayload, takeDt: '2026-05-21' }),
    ).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('logen client — buildPrintPopupUrl', () => {
  it('URL 에 userId / custCd / takeDt 가 쿼리로 포함', () => {
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'TESTU',
      custCd: 'TESTC',
      fetchImpl: vi.fn(),
    })
    const url = client.buildPrintPopupUrl({ takeDt: '20260521' })
    expect(url).toContain(`${BASE_URL}/lrm02b-edi/edi/outSlipPrintPop?`)
    expect(url).toContain('userId=TESTU')
    expect(url).toContain('custCd=TESTC')
    expect(url).toContain('takeDt=20260521')
  })

  it('잘못된 takeDt → zod throw', () => {
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl: vi.fn(),
    })
    expect(() => client.buildPrintPopupUrl({ takeDt: 'bad' })).toThrow()
  })
})

describe('logen client — inquirySlipNoMulti', () => {
  it('list 키로 normalize', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCd: '00',
        list: [
          { slipNo: '1000000001', status: 'PRINTED' },
          { slipNo: '1000000002', status: 'PENDING' },
        ],
      }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    const result = await client.inquirySlipNoMulti({
      slipNos: ['1000000001', '1000000002'],
    })
    expect(result.slipNo).toEqual(['1000000001', '1000000002'])
    expect(result.status).toEqual(['PRINTED', 'PENDING'])
  })

  it('data 키도 수용', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resultCd: 'OK',
        data: [{ slipNo: '1', status: 'Y' }],
      }),
    )
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl,
    })
    const result = await client.inquirySlipNoMulti({ slipNos: ['1'] })
    expect(result.slipNo).toEqual(['1'])
  })

  it('빈 slipNos → zod throw', async () => {
    const client = createLogenClient({
      baseUrl: BASE_URL,
      userId: 'U',
      custCd: 'C',
      fetchImpl: vi.fn(),
    })
    await expect(client.inquirySlipNoMulti({ slipNos: [] })).rejects.toThrow()
  })
})

describe('logen client — 생성자 검증', () => {
  it('baseUrl 누락 → LogenError validation', () => {
    expect(() =>
      createLogenClient({
        baseUrl: '',
        userId: 'U',
        custCd: 'C',
      }),
    ).toThrow(LogenError)
  })

  it('userId 누락 → LogenError validation', () => {
    expect(() =>
      createLogenClient({
        baseUrl: BASE_URL,
        userId: '',
        custCd: 'C',
      }),
    ).toThrow(LogenError)
  })
})
