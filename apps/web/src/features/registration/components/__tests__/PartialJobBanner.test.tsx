import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PartialJobBanner } from '../PartialJobBanner'
import type { MarketResult } from '@/lib/schemas/registration'

/**
 * R3: '전체 재시도' 버튼은 non-final 'failed' 만 재시도 대상으로 센다.
 *   failed_final 은 registration-retry 가 재시도하지 않으므로 카운트/활성에서 제외.
 *   (포함 시 항상 실패하는 버튼이 활성됨)
 */
function makeResult(over: Partial<MarketResult> & { marketStatus: MarketResult['marketStatus'] }): MarketResult {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    jobId: '00000000-0000-4000-8000-0000000000a0',
    marketId: 'naver',
    marketAccountId: '00000000-0000-4000-8000-0000000000b0',
    externalProductId: null,
    productUrl: null,
    errorCode: 'market_5xx',
    errorMessage: '오류',
    attemptCount: 1,
    excluded: false,
    lastAttemptedAt: null,
    ...over,
  }
}

describe('PartialJobBanner — 전체 재시도 대상 (R3)', () => {
  it('failed_final 만 있으면 전체 재시도 버튼 비활성 + (0개)', () => {
    render(
      <PartialJobBanner
        results={[
          makeResult({ marketStatus: 'success' }),
          makeResult({ marketStatus: 'failed_final', marketId: 'coupang' }),
          makeResult({ marketStatus: 'failed_final', marketId: '11st' }),
        ]}
        onRetryAll={vi.fn()}
        onExcludeAndRestart={vi.fn()}
      />,
    )
    const retryBtn = screen.getByRole('button', { name: /전체 재시도/ })
    expect(retryBtn).toBeDisabled()
    expect(retryBtn.textContent).toContain('0개')
  })

  it('non-final failed 가 있으면 활성 + 그 개수만 카운트(failed_final 제외)', () => {
    render(
      <PartialJobBanner
        results={[
          makeResult({ marketStatus: 'failed', marketId: 'coupang' }),
          makeResult({ marketStatus: 'failed_final', marketId: '11st' }),
        ]}
        onRetryAll={vi.fn()}
        onExcludeAndRestart={vi.fn()}
      />,
    )
    const retryBtn = screen.getByRole('button', { name: /전체 재시도/ })
    expect(retryBtn).toBeEnabled()
    expect(retryBtn.textContent).toContain('1개')
  })
})
