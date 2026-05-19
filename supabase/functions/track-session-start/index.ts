/**
 * Edge Function: track-session-start
 *
 * 마스터:
 *   - docs/architecture/v1/ops/kpi.md §3.1, §3.3
 *   - docs/architecture/v1/features/auth.md §4.3
 *
 * 책임:
 *   - 앱 마운트 + 인증된 세션 감지 시 호출. `public.sessions` 에 row 1건 insert.
 *   - IP / UA 는 Edge runtime 헤더에서만 추출 → `sha256(value + DAILY_SALT)` 해시로 저장.
 *     클라이언트는 IP / UA 를 직접 전송하지 않는다 (스푸핑 차단).
 *
 * 강제:
 *   - Authorization: Bearer <jwt> 누락 시 401. anonymous 세션 추적 불가 (MAU 기반).
 *   - sessions INSERT 는 service_role 클라이언트로 수행. RLS 정책상 본인만 insert 가능
 *     하나(kpi.md §3.2), Edge Function 은 stateless context 이므로 service_role 사용 +
 *     sellerId 를 jwt 에서 검증 후 명시 적용.
 *   - 응답에는 sessionId 만. 평문 IP / UA / hash 자체도 노출 금지.
 *   - 본 함수는 best-effort. 외부 호출 실패는 사용자 동선을 막지 않음 (kpi.md §2 가용성).
 */

import { z } from 'npm:zod@3.23.8'
import {
  env,
  getServiceClient,
  getUserClient,
  HttpErrors,
  ok,
  parseBody,
  sha256Hex,
  withRequest,
} from '../_shared/index.ts'

// 본 함수는 body 가 사실상 비어 있다. 미래 확장(client_build 등)을 위해 zod 스키마는 유지.
const RequestSchema = z.object({
  clientBuild: z.string().max(64).optional(),
})

function extractClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? null
}

async function requireSellerId(req: Request): Promise<string> {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    throw HttpErrors.unauthorized('missing_token', 'Authorization header required')
  }
  const token = auth.slice('bearer '.length).trim()
  if (token.length < 10) {
    throw HttpErrors.unauthorized('invalid_token', 'token format invalid')
  }
  const supabase = getUserClient(token)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
  }
  return data.user.id
}

export default Deno.serve(
  withRequest('track-session-start', async ({ req, logger, correlationId }) => {
    // body 는 비어 있을 수 있으나 JSON 형식 강제 (parseBody 가 비-JSON 거부).
    const raw = await req.clone().text()
    const body = raw.length === 0 ? { clientBuild: undefined } : await parseBody(req, RequestSchema)

    const sellerId = await requireSellerId(req)

    const ip = extractClientIp(req)
    const ua = req.headers.get('user-agent')
    const ipHash = ip ? await sha256Hex(`${ip}${env.DAILY_SALT}`) : null
    const uaHash = ua ? await sha256Hex(`${ua}${env.DAILY_SALT}`) : null

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        seller_id: sellerId,
        ip_hash: ipHash,
        ua_hash: uaHash,
        client_build: body.clientBuild ?? null,
      })
      .select('id')
      .single()

    if (error || !data) {
      logger.error(
        { rpcError: error?.code ?? 'unknown', sellerId, correlationId },
        '← sessions insert error',
      )
      throw HttpErrors.internal('sessions_insert_failed', 'failed to record session start')
    }

    logger.info({ sellerId, sessionId: data.id, correlationId }, '← session started')
    return ok({ sessionId: data.id as string }, { correlationId })
  }),
)
