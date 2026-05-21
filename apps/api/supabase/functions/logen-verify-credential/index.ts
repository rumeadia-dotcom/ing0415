/**
 * Edge Function: logen-verify-credential
 *
 * 마스터:
 *   - docs/spec/PRD.md §6.2, §7
 *   - apps/web/src/lib/logen/ (FE SDK 와 동일 API 시그니처 / 응답 검증)
 *
 * 처리 시퀀스:
 *   1. authenticated 셀러 JWT 검증
 *   2. body = { userId, custCd } zod parse
 *   3. Logen `getSlipNo({ slipQty: 1 })` 호출 — Logen API 인증 핑
 *   4. 성공 시 `fn_set_logen_credentials` RPC 로 pgcrypto 암호화 저장
 *      (의존: PR2 마이그레이션 `20260521000005_logen_credentials_rpc.sql`)
 *   5. 응답: LogenVerifyResponseSchema
 *
 * 강제 (Backend INTJ 원칙):
 *   - LOGEN_API_BASE_URL env 로 dev / prod 분기 (기본 dev).
 *   - userId / custCd / sender* 평문은 로그 금지 (길이만).
 *   - timeout 15s, retry 없음 (verify 는 단일 ping — backoff 는 호출측 책임).
 *   - service_role 우회 정당화: verify 는 본인 셀러 검증 + 자격증명 저장 모두
 *     사용자 JWT 로 ownership 보장. RPC 내부에서도 p_seller_id 일치 검증 강제 (PR2).
 *
 * 의존 (배포 순서):
 *   - PR2 의 `fn_set_logen_credentials` RPC 가 먼저 적용되어야 본 함수 동작.
 *   - 본 PR description 에 의존 명시.
 */

import { z } from 'npm:zod@3.23.8'
import {
  HttpErrors,
  getUserClient,
  ok,
  parseBody,
  withRequest,
  appendAudit,
} from '../_shared/index.ts'
import { setLogenCredentials } from '../_shared/pgcrypto-logen.ts'

// ─────────────────────────────────────────────
// Request / Response 스키마 (FE / Edge 공유 — apps/web/src/lib/logen/schemas.ts mirror)
// ─────────────────────────────────────────────

const RequestSchema = z.object({
  userId: z.string().min(1).max(50),
  custCd: z.string().min(1).max(50),
  /** 발송인 정보 — verify 성공 시 함께 저장 (registerOrderData 필요). */
  senderName: z.string().min(1).max(50),
  senderAddress: z.string().min(1).max(200),
  senderPhone: z.string().min(1).max(20),
  fareTy: z.string().min(1).max(2).optional(),
  dlvFare: z.number().int().min(0).optional(),
})

const ResponseSchema = z.object({
  status: z.enum(['active', 'unauthorized', 'error']),
  verifiedAt: z.string(),
  correlationId: z.string(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
})

// ─────────────────────────────────────────────
// Logen API 응답 — getSlipNo 만 (verify ping)
// ─────────────────────────────────────────────

const GetSlipNoResSchema = z.object({
  resultCd: z.string().min(1),
  resultMsg: z.string().optional(),
  errorMsg: z.string().optional(),
  errMsg: z.string().optional(),
  startSlipNo: z.string().optional(),
  closeSlipNo: z.string().optional(),
  slipNo: z.array(z.string()).optional(),
  slipNoList: z.array(z.string()).optional(),
})

const DEFAULT_TIMEOUT_MS = 15_000

// ─────────────────────────────────────────────
// 셀러 JWT 해석
// ─────────────────────────────────────────────

async function resolveSellerId(req: Request): Promise<string> {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    throw HttpErrors.unauthorized('missing_token', 'Authorization required')
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

// ─────────────────────────────────────────────
// resultCd → 분류
// ─────────────────────────────────────────────

function isSuccessResultCd(cd: string): boolean {
  const up = cd.toUpperCase().trim()
  return up === '00' || up === '0' || up === 'OK' || up === 'SUCCESS' || up === 'S'
}

function isUnauthorizedResultCd(cd: string): boolean {
  const up = cd.toUpperCase().trim()
  return up.startsWith('AUTH') || up === 'E401' || up === 'E403'
}

// ─────────────────────────────────────────────
// Edge Function entry
// ─────────────────────────────────────────────

export default Deno.serve(
  withRequest(
    'logen-verify-credential',
    async ({ req, logger, correlationId }) => {
      if (req.method !== 'POST') {
        throw HttpErrors.badRequest('method_not_allowed', 'POST required')
      }
      const body = await parseBody(req, RequestSchema)
      const sellerId = await resolveSellerId(req)

      const baseUrl = (
        Deno.env.get('LOGEN_API_BASE_URL') ?? 'https://topenapi.ilogen.com'
      ).replace(/\/$/, '')

      const verifiedAtIso = (): string => new Date().toISOString()

      // 1) Logen getSlipNo (qty=1) 핑 ─────────────────────────────────────
      const url = `${baseUrl}/lrm02b-edi/edi/getSlipNo`
      const controller = new AbortController()
      const timerId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

      logger.info(
        {
          market: 'logen',
          method: 'POST',
          url,
          sellerId,
          userIdLen: body.userId.length,
          custCdLen: body.custCd.length,
          correlationId,
        },
        '→ market request',
      )

      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            Accept: 'application/json',
            'X-Correlation-Id': correlationId,
          },
          body: JSON.stringify({ userId: body.userId, slipQty: 1 }),
          signal: controller.signal,
        })
      } catch (e) {
        clearTimeout(timerId)
        const isAbort = e instanceof DOMException && e.name === 'AbortError'
        const reason = isAbort ? 'timeout' : 'network'
        logger.error(
          { market: 'logen', sellerId, correlationId, reason },
          '← market error',
        )
        await appendAudit({
          category: 'markets',
          event: 'verify_failure',
          sellerId,
          meta: { market: 'logen', reason },
          correlationId,
          logger,
        })
        return ok(
          ResponseSchema.parse({
            status: 'error' as const,
            verifiedAt: verifiedAtIso(),
            correlationId,
            errorCode: reason,
            errorMessage: isAbort ? 'logen api timeout' : 'logen api network error',
          }),
          { correlationId },
        )
      }
      clearTimeout(timerId)

      const text = await response.text().catch(() => '')
      logger.info(
        { market: 'logen', sellerId, status: response.status, correlationId },
        '← market response',
      )

      // HTTP-level 실패
      if (!response.ok) {
        const status: 'unauthorized' | 'error' =
          response.status === 401 || response.status === 403
            ? 'unauthorized'
            : 'error'
        await appendAudit({
          category: 'markets',
          event: 'verify_failure',
          sellerId,
          meta: {
            market: 'logen',
            reason: `http_${response.status}`,
          },
          correlationId,
          logger,
        })
        return ok(
          ResponseSchema.parse({
            status,
            verifiedAt: verifiedAtIso(),
            correlationId,
            errorCode: `http_${response.status}`,
            errorMessage: `logen api responded ${response.status}`,
          }),
          { correlationId },
        )
      }

      // JSON parse
      let raw: unknown
      try {
        raw = text.length === 0 ? {} : JSON.parse(text)
      } catch {
        await appendAudit({
          category: 'markets',
          event: 'verify_failure',
          sellerId,
          meta: { market: 'logen', reason: 'invalid_json' },
          correlationId,
          logger,
        })
        return ok(
          ResponseSchema.parse({
            status: 'error',
            verifiedAt: verifiedAtIso(),
            correlationId,
            errorCode: 'invalid_json',
            errorMessage: 'logen api response not JSON',
          }),
          { correlationId },
        )
      }

      const parsed = GetSlipNoResSchema.safeParse(raw)
      if (!parsed.success) {
        await appendAudit({
          category: 'markets',
          event: 'verify_failure',
          sellerId,
          meta: { market: 'logen', reason: 'schema_mismatch' },
          correlationId,
          logger,
        })
        return ok(
          ResponseSchema.parse({
            status: 'error',
            verifiedAt: verifiedAtIso(),
            correlationId,
            errorCode: 'schema_mismatch',
            errorMessage: 'logen api response schema mismatch',
          }),
          { correlationId },
        )
      }

      // resultCd 검증
      if (!isSuccessResultCd(parsed.data.resultCd)) {
        const status: 'unauthorized' | 'error' = isUnauthorizedResultCd(
          parsed.data.resultCd,
        )
          ? 'unauthorized'
          : 'error'
        await appendAudit({
          category: 'markets',
          event: 'verify_failure',
          sellerId,
          meta: {
            market: 'logen',
            reason: 'result_cd_failed',
            resultCd: parsed.data.resultCd,
          },
          correlationId,
          logger,
        })
        return ok(
          ResponseSchema.parse({
            status,
            verifiedAt: verifiedAtIso(),
            correlationId,
            errorCode: parsed.data.resultCd,
            errorMessage:
              parsed.data.resultMsg ??
              parsed.data.errorMsg ??
              parsed.data.errMsg ??
              'logen verify rejected',
          }),
          { correlationId },
        )
      }

      // 2) 성공 → 자격증명 저장 (pgcrypto via RPC) ───────────────────────
      try {
        await setLogenCredentials({
          sellerId,
          userId: body.userId,
          custCd: body.custCd,
          senderName: body.senderName,
          senderAddress: body.senderAddress,
          senderPhone: body.senderPhone,
          ...(body.fareTy !== undefined ? { fareTy: body.fareTy } : {}),
          ...(body.dlvFare !== undefined ? { dlvFare: body.dlvFare } : {}),
          correlationId,
          logger,
        })
      } catch (e) {
        // 저장 실패는 verify 실패와 별개로 사용자에게 노출.
        const msg = e instanceof Error ? e.message : 'unknown'
        logger.error(
          { market: 'logen', sellerId, correlationId, err: msg.slice(0, 200) },
          '← logen credentials store failed',
        )
        await appendAudit({
          category: 'markets',
          event: 'verify_failure',
          sellerId,
          meta: { market: 'logen', reason: 'credentials_store_failed' },
          correlationId,
          logger,
        })
        return ok(
          ResponseSchema.parse({
            status: 'error',
            verifiedAt: verifiedAtIso(),
            correlationId,
            errorCode: 'credentials_store_failed',
            errorMessage: 'logen api verify succeeded but credentials store failed',
          }),
          { correlationId },
        )
      }

      await appendAudit({
        category: 'markets',
        event: 'verify_success',
        sellerId,
        meta: { market: 'logen' },
        correlationId,
        logger,
      })

      logger.info(
        { market: 'logen', sellerId, correlationId },
        '← verify ok',
      )

      return ok(
        ResponseSchema.parse({
          status: 'active' as const,
          verifiedAt: verifiedAtIso(),
          correlationId,
        }),
        { correlationId },
      )
    },
  ),
)
