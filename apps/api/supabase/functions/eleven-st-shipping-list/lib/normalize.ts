/**
 * eleven-st-shipping-list / 출고지·반품지 조회 응답 정규화 (pure — Deno/npm 의존 없음).
 *
 * 마스터:
 *   - docs/architecture/v1/features/11st.md §3 (Layer 2 데이터 모델 — 조회형 확정)
 *   - docs/architecture/v1/cross-cutting/shipping-fee-model.md §2 (Layer 2 조회형 단일 표준)
 *   - 11st-api/product/shipping-1014.md (출고지 목록 GET /rest/areaservice/outboundarea)
 *   - 11st-api/product/shipping-1015.md (반품/교환지 목록 GET /rest/areaservice/inboundarea)
 *
 * 역할:
 *   11번가의 raw 조회 응답(stripNsPrefix 통과 후 plain object)을 select 노출용으로 정규화한다.
 *   우리는 출고지/반품지를 만들지 않고 셀러오피스 선행 등록분을 조회만 한다(ESM/네이버/쿠팡과
 *   동일한 Layer 2 조회형 단일 표준). 상품등록 3단계 카드(MarketOptionsCard)가 select 로 노출.
 *
 * 보안 (CLAUDE.md "외부 API 로깅 패턴" / security.md / 11st.md §3):
 *   - ⚠️ PII 차단: 정규화 결과는 addrSeq + addrNm 2필드만. raw 에 있는 addr(주소)·rcvrNm(이름)·
 *     gnrlTlphnNo/prtblTlphnNo(전화)·memNo(회원번호)는 우리 DB·응답·로그 어디에도 통과시키지 않는다.
 *   - 본 모듈은 순수 변환 — 네트워크/로깅/Date.now 부작용 없음 (vitest 에서 직접 import).
 *
 * 설계상 결정:
 *   - zod 를 import 하지 않는다(npm:zod 는 Deno specifier → vitest Node 환경 비호환).
 *     구조 검증은 plain TS 가드로 수행. 응답 계약(zod)은 schemas/eleven-st.ts(+_shared/schemas.ts)에 별도.
 *   - stripNsPrefix(eleven-st-map.ts, 순수) 로 ns2 prefix 제거 후 inOutAddresss>inOutAddress[] 추출.
 *   - result_message != 'SUCCESS' (조회 오류) → 빈 배열로 안전 처리(empty 와 동일 취급). 호출측이
 *     SUCCESS 여부를 별도 판별하고자 하면 parseElevenStShippingResult 로 (ok|empty|error) 분류.
 */

import { stripNsPrefix } from '../../_shared/market-adapters/eleven-st-map.ts'

/** 정규화 출고지/반품지 옵션 (select 노출용 — 시퀀스/주소명만, PII 0). */
export interface NormalizedElevenStAddress {
  addrSeq: string
  addrNm: string
}

// ─────────────────────────────────────────────
// raw 가드 (plain TS)
// ─────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 시퀀스/문자열 식별자 — 숫자/문자열 모두 trim 후 비어있지 않으면 채택. */
function toIdString(v: unknown): string | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    return String(v)
  }
  if (typeof v === 'string') {
    const trimmed = v.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function toNonEmptyString(v: unknown): string | null {
  if (typeof v === 'number') return String(v)
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asArray(node: unknown): unknown[] {
  if (Array.isArray(node)) return node
  if (isRecord(node)) return [node]
  return []
}

/**
 * stripNsPrefix 통과 객체에서 `inOutAddresss` 컨테이너를 꺼낸다.
 *   - { inOutAddresss: { inOutAddress: [...]|{}, result_message } }
 *   - 일부 파서가 최상위에 바로 inOutAddress 를 두는 경우도 내성.
 */
function extractContainer(stripped: unknown): Record<string, unknown> | null {
  if (!isRecord(stripped)) return null
  const c = stripped.inOutAddresss
  if (isRecord(c)) return c
  // wrapper 없이 inOutAddress 가 최상위인 변형 내성.
  if (stripped.inOutAddress !== undefined || stripped.result_message !== undefined) {
    return stripped
  }
  return null
}

// ─────────────────────────────────────────────
// 결과 분류 (ok | empty | error)
// ─────────────────────────────────────────────

/**
 * 조회 응답을 분류한다 (1014/1015 공통, spec: result_message 체크).
 *   - 'SUCCESS' (대소문자 무시) → ok
 *   - result_message 가 SUCCESS 가 아닌 메시지(주소 조회 오류 등) → error (PII 가능성 → 메시지는 호출측 로그 금지)
 *   - result_message 없음 + 주소 0건 → empty
 * 입력은 raw(파싱 직후) — 내부에서 stripNsPrefix 수행. 순수 함수.
 */
export function classifyElevenStShippingResult(
  raw: unknown,
): { kind: 'ok' } | { kind: 'empty' } | { kind: 'error'; message: string } {
  const stripped = stripNsPrefix(raw)
  const container = extractContainer(stripped)
  if (container === null) return { kind: 'empty' }
  const msg = toNonEmptyString(container.result_message)
  if (msg !== null && msg.toUpperCase() !== 'SUCCESS') {
    return { kind: 'error', message: msg }
  }
  const list = asArray(container.inOutAddress)
  if (list.length === 0) return { kind: 'empty' }
  return { kind: 'ok' }
}

/**
 * 출고지/반품지 조회 응답 정규화 (1014/1015 공통).
 *   ns2:inOutAddresss > ns2:inOutAddress[] → stripNsPrefix → addrSeq+addrNm 추출.
 *   result_message != SUCCESS (조회 오류) 면 빈 배열(empty 안전 기본값).
 *   addrSeq / addrNm 둘 중 하나라도 누락된 항목은 select 에 쓸 수 없으므로 스킵.
 *   ⚠️ addr / rcvrNm / 전화 / memNo 는 통과시키지 않는다 (PII 차단 — 11st.md §3).
 * 입력은 raw(파싱 직후) — 내부에서 stripNsPrefix 수행. 순수 함수.
 */
export function normalizeElevenStAddresses(
  raw: unknown,
): NormalizedElevenStAddress[] {
  const cls = classifyElevenStShippingResult(raw)
  if (cls.kind !== 'ok') return []

  const stripped = stripNsPrefix(raw)
  const container = extractContainer(stripped)
  if (container === null) return []

  const list = asArray(container.inOutAddress)
  const result: NormalizedElevenStAddress[] = []
  for (const item of list) {
    if (!isRecord(item)) continue
    const addrSeq = toIdString(item.addrSeq)
    const addrNm = toNonEmptyString(item.addrNm)
    if (addrSeq === null || addrNm === null) continue
    // 명시적으로 addrSeq + addrNm 만 push (raw spread 금지 — PII 누출 방지).
    result.push({ addrSeq, addrNm })
  }
  return result
}
