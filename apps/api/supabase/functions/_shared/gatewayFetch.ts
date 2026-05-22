/**
 * Market Gateway 클라이언트 — Edge Function 측 단일 진입점.
 *
 * 마스터: docs/architecture/v1/cross-cutting/market-gateway.md §4.2
 *
 * 강제:
 *   - 모든 MarketAdapter 의 외부 fetch 는 본 함수를 경유한다 (raw fetch 금지).
 *   - debug 모드 (mock 어댑터) 는 본 함수를 호출하지 않는다 — 어댑터 측에서 우회.
 *   - 호출측은 `correlationId` 를 반드시 전달. `jobId` 는 RegistrationJob 컨텍스트에서만.
 *
 * 동작:
 *   1) URL / 마켓 화이트리스트 검증 (assertGatewayUrl)
 *   2) HMAC-SHA256 서명 (ts + market + url + body)
 *   3) gateway 의 /v1/proxy 로 POST — body 는 { url, method, headers, body }
 *   4) 응답 status 분류 + 로깅
 *   5) 응답 객체를 그대로 반환 — 어댑터가 본문 파싱
 *
 * 에러 매핑 (호출측이 catch 후 MarketError 변환):
 *   - 401 (HMAC mismatch) → 운영 사고 — MarketError 'unauthorized' + Sentry alert
 *   - 403 (화이트리스트 거부) → 호출측 버그 — MarketError 'validation'
 *   - 502 / 504 → 마켓 도달 실패 — MarketError 'network' (재시도)
 *   - 5xx → 마켓 서버 측 → MarketError 'server' (재시도)
 *   - 4xx → 마켓 응답 그대로 → 어댑터가 자체 매핑
 */

import { env } from './env.ts'
import { MarketError } from './errors.ts'
import { createLogger } from './logger.ts'
import {
  assertGatewayUrl,
  buildSignPayload,
  classifyGatewayStatus,
  type GatewayMarket,
  hmacSignHex,
  isGatewayMarket,
  maskUrlForLog,
} from './gateway-sign.ts'

const PROXY_PATH = '/v1/proxy'
const DEFAULT_TIMEOUT_MS = 20_000

export interface GatewayFetchInit {
  /** RegistrationJob / 외부 호출 correlation id. 호출측이 createLogger 의 그것과 동일하게 전달. */
  correlationId: string
  /** RegistrationJob 단위 ID (있을 때만). */
  jobId?: string
  /** HTTP 메서드. 기본 GET. */
  method?: string
  /** 마켓 측에 보낼 헤더. Authorization 등은 호출측 (어댑터) 책임. */
  headers?: Record<string, string>
  /** body 는 문자열로 전달 (JSON.stringify 등은 호출측). */
  body?: string
  /** upstream timeout (ms). 기본 20s. gateway 측은 25s 까지 대기. */
  timeoutMs?: number
  /** 테스트용 fetch override. 기본 globalThis.fetch. */
  fetchImpl?: typeof fetch
  /** 테스트용 now override (ms). 기본 Date.now. */
  now?: () => number
}

function requireGatewayConfig(): { baseUrl: string; secret: string } {
  if (!env.MARKET_GATEWAY_BASE_URL || !env.MARKET_GATEWAY_SECRET) {
    throw new MarketError('unauthorized', 'gateway not configured', {
      market: 'gateway',
      cause: 'MARKET_GATEWAY_BASE_URL / MARKET_GATEWAY_SECRET missing',
    })
  }
  return {
    baseUrl: env.MARKET_GATEWAY_BASE_URL,
    secret: env.MARKET_GATEWAY_SECRET,
  }
}

/**
 * 마켓 API 호출을 게이트웨이 경유로 수행한다.
 *
 * @param market   대상 마켓 ID. 게이트웨이 화이트리스트에 등록된 5종만 허용.
 * @param url      마켓 API 의 절대 URL (https://...). 호스트는 GATEWAY_ALLOWED_HOSTS 에 속해야 함.
 * @param init     correlationId / method / headers / body 등.
 * @returns        gateway 가 forward 한 upstream Response.
 *
 * 호출측은 응답을 그대로 받아서 `await res.json()` / `await res.text()` 등으로 파싱.
 * 본 함수는 4xx/5xx 도 그대로 Response 로 반환 — throw 는 네트워크 실패 / 게이트웨이 자체
 * 거부 (401/403) / 타임아웃 시에만.
 */
export async function gatewayFetch(
  market: string,
  url: string,
  init: GatewayFetchInit,
): Promise<Response> {
  if (!isGatewayMarket(market)) {
    throw new MarketError('validation', `unknown market for gateway: ${market}`, {
      market,
    })
  }
  const gwMarket: GatewayMarket = market
  assertGatewayUrl(url) // throws on bad url / unsupported protocol / host not allowed

  const { baseUrl, secret } = requireGatewayConfig()
  const fetchImpl = init.fetchImpl ?? globalThis.fetch
  const now = init.now ?? Date.now

  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ?? ''
  const ts = String(now())
  const payload = buildSignPayload({ ts, market: gwMarket, url, body })
  const sig = await hmacSignHex(secret, payload)

  const logger = createLogger('market-gateway', {
    correlationId: init.correlationId,
    jobId: init.jobId,
    market: gwMarket,
  })

  const proxyBody = JSON.stringify({
    url,
    method,
    headers: init.headers ?? {},
    body,
  })

  const ctl = new AbortController()
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const tid = setTimeout(() => ctl.abort(), timeoutMs)

  const startedAt = now()
  logger.info(
    { method, target: maskUrlForLog(url) },
    '→ market request (gateway)',
  )

  let res: Response
  try {
    res = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}${PROXY_PATH}`, {
      method: 'POST',
      headers: {
        'x-gw-ts': ts,
        'x-gw-sig': sig,
        'x-gw-market': gwMarket,
        'x-gw-correlation-id': init.correlationId,
        'x-gw-job-id': init.jobId ?? '',
        'content-type': 'application/json',
      },
      body: proxyBody,
      signal: ctl.signal,
    })
  } catch (e) {
    clearTimeout(tid)
    const aborted = (e as { name?: string } | undefined)?.name === 'AbortError'
    logger.error({ err: String(e), aborted }, '← gateway transport error')
    throw new MarketError(
      'network',
      aborted ? 'gateway timeout' : 'gateway transport error',
      { market: gwMarket, cause: e },
    )
  }
  clearTimeout(tid)

  const latencyMs = now() - startedAt
  const kind = classifyGatewayStatus(res.status)
  logger.info(
    { status: res.status, kind, latencyMs },
    '← market response (gateway)',
  )

  // gateway 자체 거부는 throw — upstream 응답이 아니므로 어댑터가 처리하지 못함.
  if (kind === 'auth_mismatch') {
    throw new MarketError('unauthorized', 'gateway hmac mismatch', {
      market: gwMarket,
      status: res.status,
    })
  }
  if (kind === 'forbidden') {
    throw new MarketError('validation', 'gateway rejected request', {
      market: gwMarket,
      status: res.status,
    })
  }
  if (kind === 'upstream_network') {
    throw new MarketError('network', 'upstream network failure', {
      market: gwMarket,
      status: res.status,
    })
  }

  // 그 외 (upstream_server / upstream_client / unknown) 는 호출측 어댑터가 본문 보고 매핑.
  return res
}
