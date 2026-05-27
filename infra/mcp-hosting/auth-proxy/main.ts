/**
 * MCP auth-proxy — Deno HTTP server.
 *
 * 설계 ground truth: docs/architecture/v1/cross-cutting/mcp-hosting.md §1.1 / §6.2 / §8.2
 *
 * 라우팅 = **서브도메인(Host) 기반** (2026-05-28 변경 — 기존 path-prefix 폐기).
 *   이유: postgres-mcp 는 SSE 전송만 지원하는데, SSE 는 /messages/ 엔드포인트를 host 루트 기준으로
 *   광고하므로 path-prefix(/supabase-real)로는 메시지 POST 가 prefix 를 잃어 깨진다.
 *   서브도메인이면 prefix 가 없어 SSE·Streamable HTTP 모두 그대로 동작.
 *
 * 동작 (Caddy 가 *.43-201-83-78.sslip.io 의 4 서브도메인을 127.0.0.1:9000 으로 reverse-proxy):
 *  (a) Host 헤더 첫 라벨로 엔드포인트 식별 (supabase-dev / supabase-real / playwright / sentry)
 *  (b) 엔드포인트별 Bearer 토큰 상수시간 검증 (현재 + grace _NEXT)
 *  (c) supabase-real 은 200/401 전건 audit 1줄 (쿼리 본문 미기록)
 *  (d) 해당 MCP 컨테이너로 **전체 경로 그대로** 스트리밍 프록시 (strip 없음 → SSE /messages/ 정상)
 *
 * 환경변수:
 *  - ROUTES               : "supabase-dev=http://postgres-mcp-dev:8000;supabase-real=...;..."  (라벨=베이스URL)
 *  - MCP_TOKEN_<EP>       : 엔드포인트별 Bearer (예: MCP_TOKEN_SUPABASE_REAL)
 *  - MCP_TOKEN_<EP>_NEXT  : (옵션) rotation grace 신토큰
 *  - MCP_PROXY_PORT       : (옵션) listen 포트, default 9000
 *  - MCP_AUDIT_LOG        : (옵션) real audit 경로, default /var/log/mcp-hosting/real-access.log
 *  - MCP_LOG_LEVEL        : (옵션) debug | info | warn | error, default info
 */

const PORT = Number(Deno.env.get('MCP_PROXY_PORT') ?? 9000);
const LOG_LEVEL = (Deno.env.get('MCP_LOG_LEVEL') ?? 'info') as LogLevel;
const AUDIT_LOG = Deno.env.get('MCP_AUDIT_LOG') ?? '/var/log/mcp-hosting/real-access.log';
const REAL_ENDPOINT = 'supabase-real'; // audit 대상

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function log(level: LogLevel, fields: Record<string, unknown>, msg: string): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[LOG_LEVEL]) return;
  const line = { ts: new Date().toISOString(), level, msg, ...fields };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

// hop-by-hop 헤더 (RFC 7230) — 프록시 시 제거.
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
]);

function stripHopByHop(h: Headers): Headers {
  const out = new Headers();
  for (const [k, v] of h.entries()) if (!HOP_BY_HOP.has(k.toLowerCase())) out.set(k, v);
  return out;
}

/** ROUTES env 파싱: "supabase-real=http://host:8000;playwright=http://host:8931" → Map(label→base) */
function parseRoutes(raw: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const part of raw.split(';')) {
    const s = part.trim();
    if (!s) continue;
    const eq = s.indexOf('=');
    if (eq < 0) continue;
    const key = s.slice(0, eq).trim(); // 예: supabase-real
    const val = s.slice(eq + 1).trim(); // 예: http://postgres-mcp-real:8000
    if (key && val) m.set(key, val);
  }
  return m;
}

const ROUTES = parseRoutes(Deno.env.get('ROUTES') ?? '');
if (ROUTES.size === 0) log('warn', {}, 'ROUTES is empty — every request will 404');

/** Host 헤더 첫 DNS 라벨 → 엔드포인트. supabase-real.43-201-83-78.sslip.io → supabase-real */
function endpointFromHost(req: Request): string {
  const host = (req.headers.get('host') ?? req.headers.get('x-forwarded-host') ?? '').toLowerCase();
  const hostname = host.split(':')[0];           // 포트 제거
  return hostname.split('.')[0] ?? '';           // 첫 라벨
}

/** 엔드포인트(라벨) → 토큰 env 접미사. supabase-real → SUPABASE_REAL */
function tokenSuffix(endpoint: string): string {
  return endpoint.toUpperCase().replace(/-/g, '_');
}

/** 현재 + _NEXT(grace) 토큰 목록. 빈 배열이면 미설정 = 거부 대상. */
function expectedTokens(endpoint: string): string[] {
  const suffix = tokenSuffix(endpoint);
  const cur = Deno.env.get(`MCP_TOKEN_${suffix}`);
  const next = Deno.env.get(`MCP_TOKEN_${suffix}_NEXT`);
  return [cur, next].filter((t): t is string => typeof t === 'string' && t.length > 0);
}

/**
 * 상수시간 문자열 비교 (타이밍 사이드채널 차단). gateway timingSafeEqualHex 와 동일 패턴.
 * Bearer 토큰은 base64url ASCII → charCodeAt 비교가 바이트 비교와 등가.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearerFrom(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

async function auditReal(fields: Record<string, unknown>): Promise<void> {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...fields }) + '\n';
  try {
    await Deno.writeTextFile(AUDIT_LOG, line, { append: true, create: true });
  } catch (e) {
    log('error', { err: String(e) }, 'audit write failed');
  }
}

function unauthorized(): Response {
  return new Response('unauthorized', { status: 401 });
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // 헬스체크 (무인증, 민감정보 없음) — Host 무관
  if (req.method === 'GET' && url.pathname === '/healthz') {
    return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }

  const endpoint = endpointFromHost(req);
  const target = ROUTES.get(endpoint);

  if (!endpoint || !target) {
    log('warn', { host: req.headers.get('host'), endpoint }, 'unknown endpoint');
    return new Response('not found', { status: 404 });
  }

  const isReal = endpoint === REAL_ENDPOINT;
  const ip = clientIp(req);

  const tokens = expectedTokens(endpoint);
  if (tokens.length === 0) {
    log('error', { endpoint }, 'no token configured for endpoint');
    if (isReal) await auditReal({ endpoint, ip, outcome: 'misconfigured', status: 401 });
    return unauthorized();
  }

  const presented = bearerFrom(req);
  const ok = presented !== null && tokens.some((t) => timingSafeEqual(presented, t));
  if (!ok) {
    log('warn', { endpoint, ip }, 'bearer mismatch');
    if (isReal) await auditReal({ endpoint, ip, outcome: 'denied', status: 401 });
    return unauthorized();
  }

  if (isReal) await auditReal({ endpoint, ip, outcome: 'allowed', status: 200, path: url.pathname });

  // ── 프록시 (전체 경로 그대로 전달 — strip 없음 → SSE /messages/ 정상) ──────
  const upstreamUrl = target + url.pathname + url.search;

  const fwdHeaders = stripHopByHop(req.headers);
  fwdHeaders.delete('authorization'); // 게이트웨이 토큰을 MCP 컨테이너로 흘리지 않음

  const method = req.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer();

  const t0 = performance.now();
  log('info', { endpoint, method, path: url.pathname, ip }, '→ mcp request');

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { method, headers: fwdHeaders, body, redirect: 'manual' });
  } catch (e) {
    log('error', { endpoint, err: String(e) }, '← upstream error');
    return new Response('upstream error', { status: 502 });
  }

  const ms = Math.round(performance.now() - t0);
  log('info', { endpoint, status: upstream.status, ms }, '← mcp response');

  // 응답 본문 스트리밍 패스스루 (text/event-stream SSE 포함).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: stripHopByHop(upstream.headers),
  });
}

Deno.serve(
  { port: PORT, hostname: '0.0.0.0', onListen: ({ port }) => log('info', { port, routes: [...ROUTES.keys()] }, 'mcp-auth-proxy listening') },
  handle,
);
