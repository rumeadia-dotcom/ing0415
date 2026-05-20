import { useMutation, useQueryClient } from '@tanstack/react-query'
import { registrationRetry, registrationQueryKeys, type RetryRequest, type RetryResponse } from '../api/registration-api'

export function useRegistrationRetry() {
  const qc = useQueryClient()
  return useMutation<RetryResponse, unknown, RetryRequest>({
    mutationFn: (req) => registrationRetry(req),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: registrationQueryKeys.job(data.jobId) })
    },
  })
}
