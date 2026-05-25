import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { connectMarket, marketQueryKeys } from '../api/markets-api'
import {
  toConnectRequest,
  type ApiKeyConnectForm,
  type ConnectResponse,
  type EsmJwtConnectForm,
  type HmacConnectForm,
} from '@/lib/schemas/markets-feature'

/**
 * 키 직접 입력 마켓 연결 — markets-connect invoke.
 *  - 쿠팡 HMAC / G마켓·옥션 ESM JWT / 11번가 API Key
 *
 * mutate() 입력은 RHF 폼 데이터 그대로 (HmacConnectForm | EsmJwtConnectForm |
 * ApiKeyConnectForm). 내부에서 toConnectRequest() 로 서버 (markets-connect
 * Edge Function) 형식 { marketId, accountLabel, credentials: { kind, ... } }
 * 으로 변환 후 invoke.
 */
export function useConnectMarket() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<
    ConnectResponse,
    unknown,
    HmacConnectForm | EsmJwtConnectForm | ApiKeyConnectForm
  >({
    mutationFn: (form) => connectMarket(toConnectRequest(form)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketQueryKeys.accounts(sellerId) })
    },
  })
}
