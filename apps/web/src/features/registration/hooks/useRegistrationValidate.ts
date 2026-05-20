import { useMutation } from '@tanstack/react-query'
import { registrationValidate, type ValidateRequest } from '../api/registration-api'
import type { Step4ValidationSchema } from '@/lib/schemas/registration'
import type { z } from 'zod'

type ValidationResponse = z.infer<typeof Step4ValidationSchema>

/**
 * Step 4 미리보기 진입 시 1회 호출. retry 는 사용자가 입력 수정 후 수동 재진입.
 */
export function useRegistrationValidate() {
  return useMutation<ValidationResponse, unknown, ValidateRequest>({
    mutationFn: (req) => registrationValidate(req),
  })
}
