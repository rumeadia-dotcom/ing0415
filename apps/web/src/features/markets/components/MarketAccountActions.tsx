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
import { ko } from '@/locales/ko'
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
 *
 * Studio 비주얼: 재인증 (warning fill) / 상태확인 (secondary outline) / 해제 (danger ghost).
 */
export function MarketAccountActions({ account }: MarketAccountActionsProps): JSX.Element {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const verify = useVerifyMarket()
  const disconnect = useDisconnectMarket()
  const tt = ko.markets.actions

  const isRevoked = account.status === 'revoked'
  const isExpired = account.status === 'expired'
  const needsReauth = isExpired || isRevoked

  const handleVerify = (): void => {
    verify.mutate(
      { accountId: account.id },
      {
        onSuccess: (data) => {
          toast.success(`${tt.reverify} — ${data.status}`)
        },
        onError: (err) => {
          if (err instanceof MarketApiInvocationError) {
            const f = formatMarketError(err.toApiError())
            toast.error(f.message, {
              description: f.correlationId ? `요청 ID: ${f.correlationId}` : undefined,
            })
          } else {
            toast.error(formatMarketError(null).message)
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
          toast.success(`${tt.disconnect} 완료`)
          setConfirmOpen(false)
        },
        onError: (err) => {
          if (err instanceof MarketApiInvocationError) {
            const f = formatMarketError(err.toApiError())
            toast.error(f.message, {
              description: f.correlationId ? `요청 ID: ${f.correlationId}` : undefined,
            })
          } else {
            toast.error(formatMarketError(null).message)
          }
        },
      },
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {needsReauth ? (
        <Button
          variant={isExpired ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => navigate(`/markets/connect/${account.marketId}`)}
        >
          {isRevoked ? tt.reconnect : tt.reauth}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleVerify}
          disabled={verify.isPending}
        >
          {verify.isPending ? tt.reverifying : tt.reverify}
        </Button>
      )}

      {isRevoked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="ghost" size="sm" disabled aria-disabled>
                {tt.disconnect}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{tt.alreadyRevoked}</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          className="text-danger hover:bg-danger-soft hover:text-danger"
        >
          {tt.disconnect}
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
              {tt.cancel}
            </Button>
            <Button variant="danger" onClick={handleDisconnect} disabled={disconnect.isPending}>
              {disconnect.isPending ? tt.disconnecting : tt.disconnect}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
