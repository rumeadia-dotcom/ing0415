import { useMutation, useQueryClient } from '@tanstack/react-query'
import { registrationCancel, registrationQueryKeys, type CancelRequest, type CancelResponse } from '../api/registration-api'

export function useRegistrationCancel() {
  const qc = useQueryClient()
  return useMutation<CancelResponse, unknown, CancelRequest>({
    mutationFn: (req) => registrationCancel(req),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: registrationQueryKeys.job(data.jobId) })
    },
  })
}
