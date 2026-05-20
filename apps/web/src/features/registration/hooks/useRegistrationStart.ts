import { useMutation, useQueryClient } from '@tanstack/react-query'
import { registrationStart, registrationQueryKeys, type StartRequest, type StartResponse } from '../api/registration-api'

export function useRegistrationStart() {
  const qc = useQueryClient()
  return useMutation<StartResponse, unknown, StartRequest>({
    mutationFn: (req) => registrationStart(req),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: registrationQueryKeys.job(data.jobId) })
    },
  })
}
