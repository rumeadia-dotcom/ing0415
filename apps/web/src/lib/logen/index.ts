/**
 * 로젠택배 SDK 공개 진입점.
 *
 * 사용:
 *   import { createLogenClient, LogenError } from '@/lib/logen'
 *
 * 마스터: docs/spec/PRD.md §7
 */

export {
  createLogenClient,
  consoleLogenLogger,
  type CreateLogenClientOptions,
  type LogenClient,
  type LogenLogger,
} from './client'
export { LogenError, type LogenErrorCode, type LogenErrorContext } from './errors'
export type {
  GetSlipNoResult,
  RegisterOrderDataReq,
  RegisterOrderDataResult,
  BuildPrintPopupUrlReq,
  InquirySlipNoMultiResult,
  LogenVerifyRequest,
  LogenVerifyResponse,
} from './schemas'
export {
  LogenVerifyRequestSchema,
  LogenVerifyResponseSchema,
  GetSlipNoReqSchema,
  GetSlipNoResultSchema,
  RegisterOrderDataReqSchema,
  RegisterOrderDataResultSchema,
  BuildPrintPopupUrlReqSchema,
  InquirySlipNoMultiReqSchema,
  InquirySlipNoMultiResultSchema,
} from './schemas'
