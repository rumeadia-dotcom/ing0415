/**
 * esm-shipping-profile / 부분 실패 error row 구성 (pure — Deno 의존 없음).
 *
 * 마스터: docs/architecture/v1/features/esm.md §1.3 / §3 (고아 정책 추적).
 *
 * 배경 (QA-313):
 *   ESM 배송 프로필 생성은 4단계(주소록→출하지→묶음배송→발송정책) 순차 호출이다.
 *   일부 단계 성공 후 뒷단계가 실패하면 ESM 측에 부분 생성된 리소스(addrNo/placeNo 등)가
 *   고아로 남는다. 이때 우리 DB 에 status='error' row 를 적재해 추적한다(throw 만 하고
 *   사라지면 고아 리소스를 영원히 못 찾는다).
 *
 * 보안 (CLAUDE.md "외부 API 로깅 패턴" / security.md §2):
 *   - raw_meta 에 PII(주소/전화/이름) / 토큰 / secretKey 절대 금지.
 *   - 기록 허용: 실패 단계명(step) + ESM 측 에러 성격을 식별하는 HttpError code 정도.
 *   - 부분 확보된 번호(addr_no/place_no/bundle_policy_no)는 ESM 내부 식별자이므로 저장 허용
 *     (PII 아님 — 고아 리소스 추적/수동 정리에 필요).
 */

/** 4단계 step 식별자. */
export type EsmProfileStep = 'address' | 'place' | 'policy' | 'dispatch'

/** 4단계 진행 중 확보된 번호(성공분만). undefined = 아직 못 받음 → DB NULL. */
export interface PartialProfileNumbers {
  addrNo?: string
  placeNo?: string
  bundlePolicyNo?: string | null
}

/** error row 의 raw_meta — PII / 토큰 금지. 실패 단계 + 에러 성격만. */
export interface ProfileErrorMeta {
  failedStep: EsmProfileStep
  /** HttpError.code (예: 'esm_place_http_500' / 'esm_dispatch_schema_mismatch'). PII 없음. */
  errorCode: string
  /** 실패 시점까지 성공한 단계들 (고아 리소스 추적용). */
  completedSteps: EsmProfileStep[]
}

const STEP_ORDER: readonly EsmProfileStep[] = ['address', 'place', 'policy', 'dispatch']

/**
 * 실패 step 에러 코드(`esm_<step>_*`)에서 어느 단계가 실패했는지 역산.
 * 코드 prefix 가 step 과 매칭되지 않으면 null (호출측이 fallback).
 */
export function parseFailedStep(errorCode: string): EsmProfileStep | null {
  for (const step of STEP_ORDER) {
    if (errorCode.startsWith(`esm_${step}_`)) return step
  }
  return null
}

/**
 * 실패 step 기준 "그 단계 이전(미포함)까지 성공한 단계" 목록.
 * 예: dispatch 실패 → ['address','place','policy'].
 */
export function completedStepsBefore(failedStep: EsmProfileStep): EsmProfileStep[] {
  const idx = STEP_ORDER.indexOf(failedStep)
  return idx <= 0 ? [] : STEP_ORDER.slice(0, idx)
}

/**
 * error row INSERT payload 구성 (번호는 성공분만, PII 미포함).
 * service_role INSERT 에 그대로 넘긴다.
 */
export function buildErrorRowMeta(opts: {
  failedStep: EsmProfileStep
  errorCode: string
}): ProfileErrorMeta {
  return {
    failedStep: opts.failedStep,
    errorCode: opts.errorCode,
    completedSteps: completedStepsBefore(opts.failedStep),
  }
}
