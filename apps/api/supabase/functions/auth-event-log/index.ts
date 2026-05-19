/**
 * Edge Function: auth-event-log
 *
 * 마스터:
 *   - docs/architecture/v1/features/auth.md §2.4, §4.3, §5.5
 *   - docs/architecture/v1/security.md §12 (audit_log)
 *
 * 책임:
 *   - 클라이언트가 보고하는 인증 이벤트(login_success / logout / password_reset_* 등)를
 *     audit_log 에 append-only 적재한다.
 *   - IP / UA 는 Edge runtime 의 헤더에서 추출 후 `sha256(value + DAILY_SALT)` 해시로만
 *     저장. 평문은 어떤 경로로도 DB 에 도달하지 않는다.
 *
 * 강제:
 *   - body 는 zod 검증 통과만 수용 (any/unknown 잔존 금지).
 *   - Authorization 헤더가 있으면 `supabase.auth.getUser()` 로 검증 → sellerId 확정.
 *     없으면 sellerId = null (signup 직전 failure 등은 익명 적재 허용 — auth.md §5.5).
 *   - INSERT 는 service_role 클라이언트(`appendAudit` 내부)로 수행 — audit_log 는
 *     authenticated/anon 정책 부재 (security.md §12.2).
 *   - 응답 본문에는 PII / 토큰 / 평문 IP / UA 노출 금지.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  env,
  getUserClient,
  HttpErrors,
  ok,
  parseBody,
  sha256Hex,
  withRequest,
} from '../_shared/index.ts'

const RequestSchema = z.object({
  event: z.enum([
    'auth.login_success',
    'auth.login_failure',
    'auth.logout',
    'auth.password_reset_requested',
    'auth.password_reset_completed',
    'auth.session_revoked_global',
    'auth.signup_attempted_existing_email',
  ]),
  meta: z.record(z.unknown()).default({}),
})

type AuthEvent = z.infer<typeof RequestSchema>['event']

function extractClientIp(req: Request): string | null {
  // Supabase Edge Functions 는 클라이언트 IP 를 `x-forwarded-for` 첫 토큰에 둔다.
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? null
}

async function resolveSellerId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    // anonymous 적재 허용 — auth.md §5.5
    return null
  }
  const token = auth.slice('bearer '.length).trim()
  if (token.length < 10) {
    // 형식 오류는 명시적으로 차단 (스푸핑 방지)
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
  withRequest('auth-event-log', async ({ req, logger, correlationId }) => {
    const body = await parseBody(req, RequestSchema)
    const sellerId = await resolveSellerId(req)

    const ip = extractClientIp(req)
    const ua = req.headers.get('user-agent')
    const ipHash = ip ? await sha256Hex(`${ip}${env.DAILY_SALT}`) : undefined
    const uaHash = ua ? await sha256Hex(`${ua}${env.DAILY_SALT}`) : undefined

    const evt: AuthEvent = body.event
    await appendAudit({
      category: 'auth',
      event: evt,
      sellerId,
      ipHash,
      uaHash,
      meta: body.meta,
      correlationId,
      logger,
    })

    return ok({ logged: true as const }, { correlationId })
  }),
)
