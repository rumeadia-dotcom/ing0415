/**
 * Market Gateway — pure 서명/직렬화 모듈.
 *
 * 마스터: docs/architecture/v1/cross-cutting/market-gateway.md §4.2
 *
 * Deno-specific 의존을 가지지 않는 순수 함수만 모은다. 본 모듈은:
 *  - Web Crypto API (`crypto.subtle`) — Node 19+ / Deno 양쪽 동작
 *  - Pure TS (no Deno.env / no fetch / no logger)
 *
 * → vitest 환경에서 그대로 import 하여 단위 테스트 가능.
 *
 * 게이트웨이 측 (infra/aws-lightsail-gateway/main.ts) 의 검증 로직과 **동일한 payload
 * 직렬화 규칙** 을 유지해야 한다 — 변경 시 양쪽 동기.
 */

/** 게이트웨이 측 main.ts 의 ALLOWED_MARKETS 와 동일. */
export const GATEWAY_ALLOWED_MARKETS = ['naver', 'coupang', 'gmarket', 'auction', '11st'] as const
export type GatewayMarket = (typeof GATEWAY_ALLOWED_MARKETS)[number]

export function isGatewayMarket(v: string): v is GatewayMarket {
  return (GATEWAY_ALLOWED_MARKETS as readonly string[]).includes(v)
}

/**
 * HMAC payload 직렬화 규칙 — 게이트웨이 측과 동일.
 *
 *   payload = ts + market + url + body
 *
 * 여기서 body 는 빈 문자열일 수 있다 (GET 요청). null/undefined 는 ''.
 *
 * 이 함수는 순수 — 같은 입력에 같은 출력.
 */
export function buildSignPayload(input: {
  ts: string
  market: GatewayMarket
  url: string
  body: string
}): string {
  return `${input.ts}${input.market}${input.url}${input.body}`
}

/**
 * HMAC-SHA256 서명. lowercase hex.
 *
 * crypto.subtle.importKey / sign 은 Promise. 호출측에서 await.
 */
export async function hmacSignHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return bufToHex(sigBuf)
}

export function bufToHex(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf)
  let out = ''
  for (const byte of arr) {
    out += byte.toString(16).padStart(2, '0')
  }
  return out
}

/**
 * gateway 가 거부할 URL 인지 사전 검증 (네트워크 호출 전 fast-fail).
 *  - 절대 URL (http/https) 이어야 함
 *  - 호스트가 known 마켓 호스트 화이트리스트에 속해야 함 (gateway 측과 동일)
 */
export const GATEWAY_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  'api.commerce.naver.com',
  'api-gateway.coupang.com',
  // ESM(G마켓·옥션) 상품·카테고리(PR-2)·배송 프로필(PR-3) API 호스트. sa2 = 현행 base(sa2.esmplus.com/item/v1).
  // sa = JWT aud 클레임용 레거시 도메인 — 전환 완료 전까지 호환 위해 병존(PR-2/4 가 전 호출 sa2 이전 후 제거 예정).
  // NOTE: Lightsail Gateway main.ts 의 ALLOWED_* 미러 + gateway 재배포는 ops 작업 (esm.md §7 PR-2 항).
  'sa2.esmplus.com',
  'sa.esmplus.com',
  // 11번가: 실제 REST base(api.11st.co.kr, PR-0~). openapi.11st.co.kr 는 구 placeholder 호출용 —
  // 호출부 재작성(PR-1~5) 완료 후 제거 예정. NOTE: Lightsail Gateway main.ts ALLOWED_* 미러 + 재배포는 ops.
  'api.11st.co.kr',
  'openapi.11st.co.kr',
])

export function assertGatewayUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`[gateway] invalid url: ${url}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`[gateway] unsupported protocol: ${parsed.protocol}`)
  }
  if (!GATEWAY_ALLOWED_HOSTS.has(parsed.host)) {
    throw new Error(`[gateway] host not in allow-list: ${parsed.host}`)
  }
}

/**
 * 민감 정보가 path variable 로 실리는 마켓 endpoint 의 pathname 마스킹 규칙.
 *
 * 11번가 발송처리(1888) `GET /rest/ordservices/reqdelivery/{sendDt}/{dlvMthdCd}/{dlvEtprsCd}/{invcNo}/{dlvNo}`
 * 는 **송장번호(invcNo)·배송번호(dlvNo)** 를 path segment 로 포함한다. querystring 마스킹만으로는
 * 이들이 게이트웨이 로그에 그대로 남으므로(cross-market 위험), `reqdelivery` 이후 segment 를
 * 통째로 가린다. PII/송장 0 (PR-6 보안 — `features/11st.md` §7 PR-5 보안 후속).
 */
function maskSensitivePathSegments(pathname: string): string {
  // /rest/ordservices/reqdelivery/<sendDt>/<dlvMthdCd>/<dlvEtprsCd>/<invcNo>/<dlvNo>
  // reqdelivery 다음 모든 segment 를 마스킹 (송장·dlvNo 노출 차단).
  const idx = pathname.indexOf('/reqdelivery/')
  if (idx !== -1) {
    return `${pathname.slice(0, idx + '/reqdelivery'.length)}/<masked>`
  }
  return pathname
}

/**
 * URL 의 querystring 제거 + 민감 path segment 마스킹 (로깅용). 토큰/키가 querystring 에 실리는
 * 마켓 + 송장/dlvNo 가 path 에 실리는 11번가 발송처리 대비.
 */
export function maskUrlForLog(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}${maskSensitivePathSegments(u.pathname)}`
  } catch {
    return '<invalid-url>'
  }
}

/**
 * 게이트웨이 HTTP 응답 status → MarketError code 매핑 후보.
 * gatewayFetch 의 wrapper 에서 사용.
 *
 *  401 unauthorized   → gateway HMAC 검증 실패 (시크릿 불일치 / drift) → 운영 사고
 *  403 forbidden      → 마켓/호스트 화이트리스트 거부 → 호출측 버그
 *  502 bad gateway    → upstream 마켓 API 도달 실패 → network (재시도)
 *  504 gateway timeout→ upstream 응답 timeout → network (재시도)
 *  기타 5xx           → server (재시도)
 *  기타 4xx           → validation (재시도 X)
 *
 * 본 함수는 mapping 의도만 표현. 실제 throw 는 gatewayFetch.ts 가 처리.
 */
export type GatewayFailureKind =
  | 'auth_mismatch'    // 401 — 게이트웨이 HMAC 거부
  | 'forbidden'        // 403 — 화이트리스트 거부
  | 'upstream_network' // 502 / 504 — 마켓 도달 실패
  | 'upstream_server'  // 5xx — 마켓 서버 측
  | 'upstream_client'  // 4xx — 마켓이 4xx 그대로 forward
  | 'unknown'

export function classifyGatewayStatus(status: number): GatewayFailureKind {
  if (status === 401) return 'auth_mismatch'
  if (status === 403) return 'forbidden'
  if (status === 502 || status === 504) return 'upstream_network'
  if (status >= 500) return 'upstream_server'
  if (status >= 400) return 'upstream_client'
  return 'unknown'
}
