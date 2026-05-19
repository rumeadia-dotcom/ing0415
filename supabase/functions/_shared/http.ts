/**
 * Edge Function HTTP wrapper.
 *
 * 마스터:
 *   - docs/architecture/v1/security.md §7.4 (CORS), §6 (Sentry / logger)
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §6
 *
 * 강제:
 *   - 모든 Edge Function 진입점은 `withRequest` 로 wrap 한다 — try/catch / CORS /
 *     correlationId / Sentry capture / 구조화 응답을 단일 지점에서 처리.
 *   - 응답 body 의 에러 message 는 `maskError` 통과 후 직렬화 (PII / 토큰 노출 차단).
 *   - CORS Allow-Origin 은 `PUBLIC_APP_ORIGIN` (1개) 만. `*` 금지.
 *   - OPTIONS preflight 도 CORS 헤더만 echo 하고 200.
 */

import { CORRELATION_HEADER, correlationFromRequest } from './correlation.ts'
import { env } from './env.ts'
import { HttpError, HttpErrors } from './errors.ts'
import { createLogger, type Logger } from './logger.ts'
import { maskError } from './masking.ts'
import { captureMarketError, flushSentry, initSentry } from './sentry.ts'

import { z } from 'npm:zod@3.23.8'

const ALLOWED_HEADERS = [
  'authorization',
  'content-type',
  CORRELATION_HEADER,
  'x-client-info',
  'apikey',
].join(', ')

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.PUBLIC_APP_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

export function ok<T>(
  data: T,
  init: { status?: number; correlationId?: string; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(corsHeaders())
  headers.set('content-type', 'application/json; charset=utf-8')
  if (init.correlationId) {
    headers.set(CORRELATION_HEADER, init.correlationId)
  }
  if (init.headers) {
    new Headers(init.headers).forEach((v, k) => headers.set(k, v))
  }
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers,
  })
}

export function err(
  status: number,
  code: string,
  message: string,
  init: {
    correlationId?: string
    details?: Record<string, unknown>
  } = {},
): Response {
  const headers = new Headers(corsHeaders())
  headers.set('content-type', 'application/json; charset=utf-8')
  if (init.correlationId) {
    headers.set(CORRELATION_HEADER, init.correlationId)
  }
  const body: Record<string, unknown> = { code, message }
  if (init.details) body.details = init.details
  return new Response(JSON.stringify(body), { status, headers })
}

export interface RequestContext {
  correlationId: string
  logger: Logger
  req: Request
}

export type RequestHandler = (ctx: RequestContext) => Promise<Response> | Response

/**
 * Edge Function 진입점 표준 wrapper.
 *
 * 사용:
 *   Deno.serve(withRequest('registration-run', async ({ req, logger, correlationId }) => {
 *     const body = await parseBody(req, MySchema)
 *     ...
 *     return ok({ ok: true }, { correlationId })
 *   }))
 */
export function withRequest(
  serviceName: string,
  handler: RequestHandler,
): (req: Request) => Promise<Response> {
  initSentry(serviceName)

  return async (req: Request): Promise<Response> => {
    const correlationId = correlationFromRequest(req)
    const logger = createLogger(serviceName, { correlationId })

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    const startedAt = Date.now()
    logger.info(
      { method: req.method, url: req.url },
      '→ edge request',
    )

    try {
      const res = await handler({ req, logger, correlationId })
      logger.info(
        { status: res.status, latencyMs: Date.now() - startedAt },
        '← edge response',
      )
      // correlationId 응답 헤더 보장
      if (!res.headers.get(CORRELATION_HEADER)) {
        res.headers.set(CORRELATION_HEADER, correlationId)
      }
      return res
    } catch (e) {
      const masked = maskError(e)
      logger.error(
        { err: masked, latencyMs: Date.now() - startedAt },
        '← edge error',
      )
      captureMarketError(e, { service: serviceName, correlationId })

      if (e instanceof HttpError) {
        return err(e.status, e.code, e.message, {
          correlationId,
          details: e.details,
        })
      }
      // zod 검증 실패는 400 으로 (parseBody 가 별도 처리하지만 안전망).
      if (e instanceof z.ZodError) {
        return err(400, 'validation', 'invalid request', {
          correlationId,
          details: { issues: e.issues },
        })
      }
      return err(500, 'internal', 'internal server error', { correlationId })
    } finally {
      // 짧은 수명 Edge Function — Sentry 이벤트 flush 보장
      await flushSentry(1500).catch(() => {})
    }
  }
}

/**
 * body 를 JSON 으로 파싱하고 zod 스키마 검증.
 * 실패 시 HttpError(400 validation) throw.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw HttpErrors.badRequest('invalid_json', 'request body must be JSON')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw HttpErrors.badRequest('validation', 'request body validation failed', {
      issues: parsed.error.issues,
    })
  }
  return parsed.data
}

/** 쿼리스트링 파싱 + zod 검증. */
export function parseQuery<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): z.infer<T> {
  const url = new URL(req.url)
  const obj: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    obj[k] = v
  })
  const parsed = schema.safeParse(obj)
  if (!parsed.success) {
    throw HttpErrors.badRequest('validation', 'query validation failed', {
      issues: parsed.error.issues,
    })
  }
  return parsed.data
}

/** Authorization 헤더에서 Bearer JWT 추출. 누락 / 형식 오류 시 401. */
export function requireBearer(req: Request): string {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    throw HttpErrors.unauthorized('missing_token', 'Authorization header required')
  }
  const token = auth.slice('bearer '.length).trim()
  if (token.length < 10) {
    throw HttpErrors.unauthorized('invalid_token', 'token too short')
  }
  return token
}
