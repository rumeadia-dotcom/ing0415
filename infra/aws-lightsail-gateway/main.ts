/**
 * Market Gateway — Deno HTTP server (AWS Lightsail VPS, Seoul).
 *
 * 모든 Supabase Edge Function → 마켓 API 호출이 본 게이트웨이를 경유한다 (고정 IP 단일 outbound).
 * 설계: docs/architecture/v1/cross-cutting/market-gateway.md
 *
 * 환경변수 (systemd EnvironmentFile=/etc/market-gateway/env):
 *  - MARKET_GATEWAY_SECRET   : Edge Function 과 공유하는 HMAC 시크릿 (≥32 bytes hex)
 *  - MARKET_GATEWAY_PORT     : (옵션) listen 포트, default 8787
 *  - MARKET_GATEWAY_LOG_LEVEL: (옵션) debug | info | warn | error, default info
 *  - SENTRY_DSN              : (옵션) Sentry 연동 시
 *
 * 실행:
 *  deno run --allow-net --allow-env --no-prompt main.ts
 */

const SECRET = mustEnv('MARKET_GATEWAY_SECRET');
const PORT = Number(Deno.env.get('MARKET_GATEWAY_PORT') ?? 8787);
const LOG_LEVEL = (Deno.env.get('MARKET_GATEWAY_LOG_LEVEL') ?? 'info') as LogLevel;

const ALLOWED_MARKETS = new Set(['naver', 'coupang', 'gmarket', 'auction', '11st']);
const ALLOWED_UPSTREAM_HOSTS = new Set([
  'api.commerce.naver.com',
  'api-gateway.coupang.com',
  // ESM(G마켓·옥션): sa2 = 현행 상품/카테고리 base, sa = 레거시 호환 유지.
  'sa2.esmplus.com',
  'sa.esmplus.com',
  // 11번가: api.11st.co.kr = 실제 REST base (PR-1~, cateservice/prodservices/ordservices).
  //   openapi.11st.co.kr = 구 placeholder 호출용 — 호출부 재작성(PR-1~5) 완료 전까지 병존.
  //   PR-5 까지 다른 11번가 메서드가 구 placeholder 를 쓰므로 openapi 는 제거 금지 (11st.md §7).
  'api.11st.co.kr',
  'openapi.11st.co.kr',
]);

const TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 20_000;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function log(level: LogLevel, fields: Record<string, unknown>, msg: string): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[LOG_LEVEL]) return;
  const line = { ts: new Date().toISOString(), level, msg, ...redact(fields) };
  // Gateway backend logger — console 직접 호출 (cycle 55 no-console 룰 예외)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

function mustEnv(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`missing env: ${key}`);
  return v;
}

/**
 * security.md §6.2 redact 규칙. OAuth 토큰 / HMAC 키 / API Key / 이메일 / 전화번호.
 * gateway 는 응답 본문은 건드리지 않고 헤더·로깅 필드만 마스킹.
 */
const SECRET_KEY_RE = /(authorization|x-api-key|api[-_]?key|secret|token|password|access[-_]?key|cookie)/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g;

function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj.replace(EMAIL_RE, '<email>').replace(PHONE_RE, '<phone>');
  if (Array.isArray(obj)) return obj.map(redact);
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) ? '<redacted>' : redact(v);
    }
    return out;
  }
  return obj;
}

// 11번가 발송처리(1888) `…/ordservices/reqdelivery/{sendDt}/{dlvMthdCd}/{dlvEtprsCd}/{invcNo}/{dlvNo}`
// 는 송장번호(invcNo)·배송번호(dlvNo)를 path segment 로 포함한다. 게이트웨이 로그에 노출되지
// 않도록 reqdelivery 이후 segment 를 마스킹한다 (Edge `gateway-sign.ts:maskUrlForLog` 미러, PR-6 보안).
function maskSensitivePathSegments(pathname: string): string {
  const idx = pathname.indexOf('/reqdelivery/');
  if (idx !== -1) {
    return `${pathname.slice(0, idx + '/reqdelivery'.length)}/<masked>`;
  }
  return pathname;
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${maskSensitivePathSegments(u.pathname)}`;
  } catch {
    return '<invalid-url>';
  }
}

async function hmacVerify(ts: string, market: string, url: string, body: string, sig: string): Promise<boolean> {
  const payload = `${ts}${market}${url}${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expectedBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expected = bufToHex(expectedBuf);
  return timingSafeEqualHex(expected, sig);
}

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface ProxyPayload {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

function isProxyPayload(v: unknown): v is ProxyPayload {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return typeof p.url === 'string' && typeof p.method === 'string';
}

async function handleProxy(req: Request): Promise<Response> {
  const ts = req.headers.get('x-gw-ts') ?? '';
  const sig = req.headers.get('x-gw-sig') ?? '';
  const market = req.headers.get('x-gw-market') ?? '';
  const cid = req.headers.get('x-gw-correlation-id') ?? '';
  const jid = req.headers.get('x-gw-job-id') ?? '';

  if (!ALLOWED_MARKETS.has(market)) {
    log('warn', { market, cid }, 'unknown market');
    return new Response('forbidden', { status: 403 });
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > TIMESTAMP_DRIFT_MS) {
    log('warn', { market, cid, ts }, 'timestamp drift');
    return new Response('unauthorized', { status: 401 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!isProxyPayload(payload)) return new Response('bad request', { status: 400 });

  const ok = await hmacVerify(ts, market, payload.url, payload.body ?? '', sig);
  if (!ok) {
    log('warn', { market, cid, target: maskUrl(payload.url) }, 'hmac mismatch');
    return new Response('unauthorized', { status: 401 });
  }

  let upstreamHost: string;
  try {
    upstreamHost = new URL(payload.url).host;
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!ALLOWED_UPSTREAM_HOSTS.has(upstreamHost)) {
    log('warn', { market, cid, upstreamHost }, 'upstream host not allowed');
    return new Response('forbidden', { status: 403 });
  }

  const t0 = performance.now();
  log('info', { market, cid, jid, method: payload.method, target: maskUrl(payload.url) }, '→ proxy request');

  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort(), UPSTREAM_TIMEOUT_MS);
  let upstream: Response;
  // Deno fetch 는 GET/HEAD 요청에 body 가 있으면 (빈 문자열 포함) TypeError 던짐.
  // gatewayFetch() 측이 body 를 항상 '' 로 채우므로 (payload 직렬화 일관성) 여기서 정리.
  const upstreamMethod = payload.method.toUpperCase();
  const hasBody = upstreamMethod !== 'GET' && upstreamMethod !== 'HEAD' && payload.body !== '';
  try {
    upstream = await fetch(payload.url, {
      method: payload.method,
      headers: payload.headers ?? {},
      body: hasBody ? payload.body : undefined,
      signal: ctl.signal,
    });
  } catch (e) {
    clearTimeout(tid);
    log('error', { market, cid, jid, err: String(e) }, '← upstream error');
    return new Response('upstream error', { status: 502 });
  }
  clearTimeout(tid);
  const ms = Math.round(performance.now() - t0);
  log('info', { market, cid, jid, status: upstream.status, ms }, '← proxy response');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: stripHopByHop(upstream.headers),
  });
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function stripHopByHop(h: Headers): Headers {
  const out = new Headers();
  for (const [k, v] of h.entries()) if (!HOP_BY_HOP.has(k.toLowerCase())) out.set(k, v);
  return out;
}

function handleHealth(): Response {
  return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

Deno.serve({ port: PORT, onListen: ({ port }) => log('info', { port }, 'market-gateway listening') }, (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname === '/healthz') return handleHealth();
  if (req.method === 'POST' && url.pathname === '/v1/proxy') return handleProxy(req);
  return new Response('not found', { status: 404 });
});
