/**
 * audit_log 적재 헬퍼.
 *
 * 마스터:
 *   - docs/architecture/v1/security.md §12 (audit_log DDL / 카테고리)
 *
 * 강제:
 *   - append-only. UPDATE / DELETE 금지 (RLS + 정책 부재).
 *   - meta jsonb 에 PII / 토큰 포함 금지 — 호출 전 maskRecord 통과.
 *   - ip / user_agent 는 sha256(value + daily_salt) 해시만. 원본 IP 저장 금지.
 *   - 카테고리 / 이벤트 키는 security.md §12.1 의 단일 출처 (auth / markets /
 *     registration / security / account).
 */

import { maskRecord } from './masking.ts'
import { getServiceClient } from './supabase.ts'
import type { Logger } from './logger.ts'

export type AuditCategory =
  | 'auth'
  | 'markets'
  | 'registration'
  | 'security'
  | 'account'
  | 'shipping'

export interface AppendAuditInput {
  category: AuditCategory
  /** security.md §12.1 의 이벤트 키. 자유 문자열이지만 표 외 사용 시 PR 차단. */
  event: string
  sellerId: string | null
  /** IP / UA 는 호출측에서 sha256(value + dailySalt) 적용 후 전달. */
  ipHash?: string
  uaHash?: string
  meta?: Record<string, unknown>
  correlationId?: string
  logger?: Logger
}

/**
 * daily_salt 생성용 — 운영 환경에서는 별도 시크릿 + 일자 결합.
 * Phase 후속에서 별도 모듈로 분리. 현재는 호출측 책임.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}

export async function appendAudit(input: AppendAuditInput): Promise<void> {
  const supabase = getServiceClient()
  const safeMeta = input.meta ? (maskRecord(input.meta) as Record<string, unknown>) : {}
  if (input.correlationId) {
    safeMeta.correlationId = input.correlationId
  }

  const { error } = await supabase.from('audit_log').insert({
    category: input.category,
    event: input.event,
    seller_id: input.sellerId,
    ip_hash: input.ipHash ?? null,
    ua_hash: input.uaHash ?? null,
    meta: safeMeta,
  })

  if (error) {
    // audit 실패는 잡 전체를 막지 않음 — 단, 로그로 남김 (관찰 가능성).
    input.logger?.error(
      {
        category: input.category,
        event: input.event,
        sellerId: input.sellerId,
        rpcError: error.code ?? 'unknown',
        correlationId: input.correlationId,
      },
      '← audit insert error',
    )
    return
  }
  input.logger?.debug(
    {
      category: input.category,
      event: input.event,
      sellerId: input.sellerId,
      correlationId: input.correlationId,
    },
    '← audit insert ok',
  )
}
