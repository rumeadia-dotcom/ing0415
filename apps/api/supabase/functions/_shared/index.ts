/**
 * _shared barrel — Edge Function 진입점에서 import 단일화.
 *
 * 사용:
 *   import {
 *     withRequest, parseBody, ok, err,
 *     createLogger, getServiceClient,
 *     storeCredential, loadCredential,
 *     getMarketAdapter, withRetry,
 *     MarketError, HttpErrors,
 *   } from '../_shared/index.ts'
 *
 * 본 barrel 은 명시적 re-export 만. 와일드카드 export 금지 (tree-shaking / 의존 추적).
 */

export { env, isDebug, isReal, resolveMasterKey, currentKid } from './env.ts'
export { getServiceClient, getUserClient } from './supabase.ts'
export { maskError, maskRecord } from './masking.ts'
export { initSentry, captureMarketError, flushSentry } from './sentry.ts'
export { createLogger, type Logger, type LogLevel, type LogContext } from './logger.ts'
export {
  generateCorrelationId,
  correlationFromRequest,
  CORRELATION_HEADER,
} from './correlation.ts'
export {
  MarketError,
  HttpError,
  HttpErrors,
  type MarketErrorCode,
  type MarketErrorContext,
} from './errors.ts'
export {
  withRequest,
  parseBody,
  parseQuery,
  requireBearer,
  ok,
  err,
  type RequestContext,
  type RequestHandler,
} from './http.ts'
export {
  withRetry,
  DEFAULT_RETRY,
  type RetryPolicy,
  type RetryContext,
} from './retry.ts'
export type { MarketAdapter } from './market-adapter.ts'
export {
  MarketOrderStatusSchema,
  FetchOrdersInputSchema,
  MarketOrderSchema,
  SubmitTrackingInputSchema,
  MarketSubmitTrackingResultSchema,
  TrackingCarrierCodeSchema,
  TRACKING_CARRIER_CODES,
  normalizeIsoOffset,
  type MarketOrderStatus,
  type FetchOrdersInput,
  type MarketOrder,
  type SubmitTrackingInput,
  type MarketSubmitTrackingResult,
  type TrackingCarrierCode,
} from './market-orders.ts'
export {
  getMarketAdapter,
  type GetAdapterOptions,
  type MockScenario,
} from './market-adapters/index.ts'
export {
  storeCredential,
  loadCredential,
  type StoreCredentialInput,
  type LoadCredentialInput,
  type DecryptedCredential,
} from './credentials.ts'
export {
  appendAudit,
  sha256Hex,
  type AuditCategory,
  type AppendAuditInput,
} from './audit.ts'
export * from './schemas.ts'
export { invokeMarketWorker } from './registration/invoke-worker.ts'
