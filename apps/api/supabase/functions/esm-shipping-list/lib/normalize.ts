/**
 * esm-shipping-list / 배송 리소스 조회 응답 정규화 (pure — Deno 의존 없음).
 *
 * 마스터:
 *   - docs/architecture/v1/features/esm.md "⚠ 전환 결정 (2026-05-30): 생성형 → 조회형" 절 / PR-E1
 *   - docs/architecture/v1/cross-cutting/shipping-fee-model.md §2 (Layer 2 조회형 단일 표준)
 *   - esm-api/product/17.md (출하지 전체조회 → shippingPlaces[])
 *   - esm-api/product/19.md (발송정책 전체조회 → dispatchPolicies[])
 *
 * 역할:
 *   ESM 의 raw 조회 응답(이미 JSON 파싱된 unknown)을 select 노출용 정규화 형태로 변환한다.
 *   생성형(esm-shipping-profile 4단계 생성)과 달리 우리 앱은 만들지 않고 조회만 한다.
 *
 * 보안 (CLAUDE.md "외부 API 로깅 패턴" / security.md §2):
 *   - 출하지 raw 에는 addrNo/추가배송비 등이 있으나 select 노출에 불필요 → 정규화에서 제외.
 *   - 주소/연락처 등 PII 는 이 응답 단계에서 통과시키지 않는다 (이름/번호만).
 *   - 본 모듈은 순수 변환 — 네트워크/로깅/Date.now 부작용 없음 (vitest 에서 직접 import).
 *
 * 설계상 결정:
 *   - zod 를 import 하지 않는다(`npm:zod` 는 Deno specifier → vitest Node 환경 비호환).
 *     구조 검증은 plain TS 가드로 수행한다. 응답 계약(zod 스키마)은
 *     apps/web/src/lib/schemas/esm.ts / _shared/schemas.ts 에 별도로 존재(단일 소스).
 *   - 발송정책은 사이트별(G/A)이라 호출한 계정 site 로 태깅한다(dispatchPolicyNo.{gmkt|iac} 매칭용).
 */

/** 정규화 site — 'G'=지마켓, 'A'=옥션. */
export type EsmListSite = 'G' | 'A'

/** ESM 발송유형 (esm-api/product/19.md). */
export type EsmListDispatchType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

const DISPATCH_TYPES: readonly EsmListDispatchType[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
] as const

/** 정규화 출하지 (select 노출용 — 번호/이름/기본여부만). */
export interface NormalizedShippingPlace {
  placeNo: string
  placeName: string
  isDefault: boolean
}

/** 정규화 발송정책 (site 태깅). */
export interface NormalizedDispatchPolicy {
  site: EsmListSite
  dispatchPolicyNo: string
  dispatchPolicyName: string
  dispatchType: EsmListDispatchType
  isDefault: boolean
}

// ─────────────────────────────────────────────
// raw 가드 (plain TS)
// ─────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** ESM 번호 필드(int 로 내려옴)를 문자열 식별자로. 누락/빈값/0 미만은 null(스킵 대상). */
function toIdString(v: unknown): string | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return null
    return String(v)
  }
  if (typeof v === 'string') {
    const trimmed = v.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** ESM boolean 필드 — 명시 true 만 true. 누락/null 은 false. */
function toBool(v: unknown): boolean {
  return v === true
}

function toDispatchType(v: unknown): EsmListDispatchType | null {
  return typeof v === 'string' &&
    (DISPATCH_TYPES as readonly string[]).includes(v)
    ? (v as EsmListDispatchType)
    : null
}

/**
 * 응답 wrapper 에서 배열을 추출한다.
 *   - { shippingPlaces: [...] } / { dispatchPolicies: [...] } (정상 — esm-api 문서)
 *   - 배열 그대로
 *   - 알 수 없는 형태/누락 → 빈 배열 (조회 결과 없음과 동일 취급)
 */
function extractArray(raw: unknown, key: string): unknown[] {
  if (Array.isArray(raw)) return raw
  if (isRecord(raw)) {
    const v = raw[key]
    if (Array.isArray(v)) return v
  }
  return []
}

// ─────────────────────────────────────────────
// 정규화 (raw → 정규화 배열)
// ─────────────────────────────────────────────

/**
 * 출하지 전체조회 응답 정규화 (esm-api/product/17.md).
 *   { shippingPlaces: [{ placeNo, placeName, isDefaultShippingPlace, ... }] }
 * 번호/이름이 없는 항목은 select 에 쓸 수 없으므로 스킵한다(부분 누락 내성).
 */
export function normalizeShippingPlaces(
  raw: unknown,
): NormalizedShippingPlace[] {
  const list = extractArray(raw, 'shippingPlaces')
  const result: NormalizedShippingPlace[] = []
  for (const item of list) {
    if (!isRecord(item)) continue
    const placeNo = toIdString(item.placeNo)
    const placeName = toNonEmptyString(item.placeName)
    if (placeNo === null || placeName === null) continue
    result.push({
      placeNo,
      placeName,
      isDefault: toBool(item.isDefaultShippingPlace),
    })
  }
  return result
}

/**
 * 발송정책 전체조회 응답 정규화 (esm-api/product/19.md).
 *   { dispatchPolicies: [{ dispatchPolicyNo, dispatchPolicyName, dispatchType, isDefault, ... }] }
 * 발송정책은 사이트별이므로 호출한 계정 site 로 태깅한다.
 * 번호/이름/유형 중 하나라도 누락이면 스킵.
 */
export function normalizeDispatchPolicies(
  raw: unknown,
  site: EsmListSite,
): NormalizedDispatchPolicy[] {
  const list = extractArray(raw, 'dispatchPolicies')
  const result: NormalizedDispatchPolicy[] = []
  for (const item of list) {
    if (!isRecord(item)) continue
    const dispatchPolicyNo = toIdString(item.dispatchPolicyNo)
    const dispatchPolicyName = toNonEmptyString(item.dispatchPolicyName)
    const dispatchType = toDispatchType(item.dispatchType)
    if (
      dispatchPolicyNo === null ||
      dispatchPolicyName === null ||
      dispatchType === null
    ) {
      continue
    }
    result.push({
      site,
      dispatchPolicyNo,
      dispatchPolicyName,
      dispatchType,
      isDefault: toBool(item.isDefault),
    })
  }
  return result
}
