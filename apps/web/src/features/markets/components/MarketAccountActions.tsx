import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'
import { useDisconnectMarket } from '../hooks/useDisconnectMarket'
import { useVerifyMarket } from '../hooks/useVerifyMarket'
import { MarketApiInvocationError } from '../api/markets-api'
import { formatMarketError } from '../utils/market-error-messages'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

interface MarketAccountActionsProps {
  account: MarketAccount
}

/**
 * markets.md §7.1 의 행/카드 우측 액션 묶음.
 * - active → [상태 확인] + [해제]
 * - expired → [재인증] + [해제]
 * - revoked → [재연결] (해제 비활성)
 * - error → [상태 확인] + [해제]
 */
export function MarketAccountActions({ account }: MarketAccountActionsProps): JSX.Element {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const verify = useVerifyMarket()
  const disconnect = useDisconnectMarket()

  const isRevoked = account.status === 'revoked'
  const needsReauth = account.status === 'expired' || account.status === 'revoked'

  const handleVerify = (): void => {
    verify.mutate(
      { accountId: account.id },
      {
        onSuccess: (data) => {
          toast.success(`상태 확인 완료 — ${data.status}`)
        },
        onError: (err) => {
          if (err instanceof MarketApiInvocationError) {
            const f = formatMarketError(err.toApiError())
            toast.error(f.message, { description: f.correlationId ? `요청 ID: ${f.correlationId}` : undefined })
          } else {
            toast.error('상태 확인에 실패했습니다.')
          }
        },
      },
    )
  }

  const handleDisconnect = (): void => {
    disconnect.mutate(
      { accountId: account.id },
      {
        onSuccess: () => {
          toast.success('마켓 연결이 해제되었습니다.')
          setConfirmOpen(false)
        },
        onError: (err) => {
          if (err instanceof MarketApiInvocationError) {
            const f = formatMarketError(err.toApiError())
            toast.error(f.message, { description: f.correlationId ? `요청 ID: ${f.correlationId}` : undefined })
          } else {
            toast.error('연결 해제에 실패했습니다.')
          }
        },
      },
    )
  }

  return (
    <div className="flex items-center gap-2">
      {needsReauth ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/markets/connect/${account.marketId}`)}
        >
          {isRevoked ? '재연결' : '재인증'}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleVerify}
          disabled={verify.isPending}
        >
          {verify.isPending ? '확인 중…' : '상태 확인'}
        </Button>
      )}

      {isRevoked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="ghost" size="sm" disabled aria-disabled>
                해제
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>이미 해제된 계정입니다</TooltipContent>
        </Tooltip>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
          해제
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>마켓 연결 해제</DialogTitle>
            <DialogDescription>
              <strong>{account.accountLabel}</strong> 연결을 해제하면 이 계정으로 상품을 등록할 수
              없게 됩니다. 다시 연결하려면 인증 과정을 처음부터 진행해야 합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={handleDisconnect} disabled={disconnect.isPending}>
              {disconnect.isPending ? '해제 중…' : '해제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
