/**
 * esm-shipping-profile / 부분 실패 error row 단위·통합 테스트 (QA-313).
 *
 * 검증 대상:
 *   - lib/error-row.ts 의 pure 헬퍼 (Deno 의존 없음 → vitest 환경 import 가능).
 *   - in-memory 시뮬레이터로 4단계 부분 실패 → status='error' row payload 재현.
 *     (index.ts 의 Deno.serve entry 는 vitest 에서 직접 import 불가하므로, entry 의
 *      try/catch 흐름을 동일 로직으로 재구성해 적재 payload 를 검증한다 —
 *      shipping-dispatch.test.ts 와 동일 패턴.)
 *
 * 보안 단언:
 *   - error row raw_meta 에 PII(주소/전화/이름)/토큰/secretKey 가 절대 없음.
 *   - 적재되는 번호는 성공분만(부분), 미확보 번호는 null.
 */

import { describe, expect, it } from 'vitest'
import {
  buildErrorRowMeta,
  completedStepsBefore,
  parseFailedStep,
  type EsmProfileStep,
  type PartialProfileNumbers,
  type ProfileErrorMeta,
} from '../lib/error-row'

// ─────────────────────────────────────────────
// pure 헬퍼
// ─────────────────────────────────────────────

describe('error-row / parseFailedStep', () => {
  it('esm_<step>_* 코드에서 단계 역산', () => {
    expect(parseFailedStep('esm_address_http_500')).toBe('address')
    expect(parseFailedStep('esm_place_schema_mismatch')).toBe('place')
    expect(parseFailedStep('esm_policy_no_missing')).toBe('policy')
    expect(parseFailedStep('esm_dispatch_invalid_json')).toBe('dispatch')
  })

  it('매칭 안 되는 코드는 null (호출측 fallback)', () => {
    expect(parseFailedStep('esm_step_unknown')).toBeNull()
    expect(parseFailedStep('internal')).toBeNull()
    expect(parseFailedStep('')).toBeNull()
  })
})

describe('error-row / completedStepsBefore', () => {
  it('각 실패 단계의 직전까지 성공 목록', () => {
    expect(completedStepsBefore('address')).toEqual([])
    expect(completedStepsBefore('place')).toEqual(['address'])
    expect(completedStepsBefore('policy')).toEqual(['address', 'place'])
    expect(completedStepsBefore('dispatch')).toEqual(['address', 'place', 'policy'])
  })
})

describe('error-row / buildErrorRowMeta', () => {
  it('failedStep / errorCode / completedSteps 만 담는다 (PII-free)', () => {
    const meta = buildErrorRowMeta({
      failedStep: 'dispatch',
      errorCode: 'esm_dispatch_http_502',
    })
    expect(meta).toEqual({
      failedStep: 'dispatch',
      errorCode: 'esm_dispatch_http_502',
      completedSteps: ['address', 'place', 'policy'],
    })
    // 보안: meta 키는 정확히 3개 — PII 유입 통로 차단.
    expect(Object.keys(meta).sort()).toEqual([
      'completedSteps',
      'errorCode',
      'failedStep',
    ])
  })
})

// ─────────────────────────────────────────────
// 시뮬레이터 — index.ts 의 4단계 try/catch 흐름 재구성
// ─────────────────────────────────────────────

interface SimError {
  code: string // HttpError.code (esm_<step>_*)
}

interface RecordedErrorRow {
  addr_no: string | null
  place_no: string | null
  bundle_policy_no: string | null
  dispatch_policy_no: string | null
  status: 'error'
  raw_meta: ProfileErrorMeta
}

type StepFn = () => string // 성공 시 번호 반환, 실패 시 throw SimError

/**
 * index.ts entry 의 3) ESM 4단계 + catch(error row 적재) 흐름을 동일 로직으로 재구성.
 * 각 step 은 주입된 StepFn. 어느 step 이 throw 하면 partial + meta 로 error row 를 만들고
 * 원래 에러를 re-throw 한다(여기선 throw 대신 결과 객체 반환으로 단언).
 */
function runProfileCreate(steps: {
  address: StepFn
  place: StepFn
  policy: () => string | null // bundlePolicyNo 는 null 가능
  dispatch: StepFn
}):
  | { ok: true; addrNo: string; placeNo: string; bundlePolicyNo: string | null; dispatchPolicyNo: string }
  | { ok: false; errorRow: RecordedErrorRow; thrownCode: string } {
  const partial: PartialProfileNumbers = {}
  try {
    const addrNo = steps.address()
    partial.addrNo = addrNo
    const placeNo = steps.place()
    partial.placeNo = placeNo
    const bundlePolicyNo = steps.policy()
    partial.bundlePolicyNo = bundlePolicyNo
    const dispatchPolicyNo = steps.dispatch()
    return { ok: true, addrNo, placeNo, bundlePolicyNo, dispatchPolicyNo }
  } catch (e) {
    const errorCode = (e as SimError).code ?? 'esm_step_unknown'
    const failedStep: EsmProfileStep =
      parseFailedStep(errorCode) ??
      (partial.placeNo === undefined
        ? partial.addrNo === undefined
          ? 'address'
          : 'place'
        : partial.bundlePolicyNo === undefined
          ? 'policy'
          : 'dispatch')
    const rawMeta = buildErrorRowMeta({ failedStep, errorCode })
    const errorRow: RecordedErrorRow = {
      addr_no: partial.addrNo ?? null,
      place_no: partial.placeNo ?? null,
      bundle_policy_no: partial.bundlePolicyNo ?? null,
      dispatch_policy_no: null,
      status: 'error',
      raw_meta: rawMeta,
    }
    return { ok: false, errorRow, thrownCode: errorCode }
  }
}

const succeed = (no: string): StepFn => () => no
const fail = (code: string): StepFn => () => {
  const e: Error & SimError = Object.assign(new Error(code), { code })
  throw e
}

describe('error-row / scenario / 4단계 모두 성공 → active (error row 없음)', () => {
  it('성공 경로는 번호 전부 반환', () => {
    const r = runProfileCreate({
      address: succeed('A1'),
      place: succeed('P1'),
      policy: () => 'B1',
      dispatch: succeed('D1'),
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r).toMatchObject({
        addrNo: 'A1',
        placeNo: 'P1',
        bundlePolicyNo: 'B1',
        dispatchPolicyNo: 'D1',
      })
    }
  })
})

describe('error-row / scenario / 부분 실패 → status=error row 적재', () => {
  it('① address 실패 → 번호 전부 null, failedStep=address, completedSteps=[]', () => {
    const r = runProfileCreate({
      address: fail('esm_address_http_401'),
      place: succeed('P1'),
      policy: () => 'B1',
      dispatch: succeed('D1'),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorRow.addr_no).toBeNull()
      expect(r.errorRow.place_no).toBeNull()
      expect(r.errorRow.dispatch_policy_no).toBeNull()
      expect(r.errorRow.status).toBe('error')
      expect(r.errorRow.raw_meta).toEqual({
        failedStep: 'address',
        errorCode: 'esm_address_http_401',
        completedSteps: [],
      })
    }
  })

  it('② place 실패 → addr_no 확보, place_no null, failedStep=place', () => {
    const r = runProfileCreate({
      address: succeed('440755'),
      place: fail('esm_place_http_500'),
      policy: () => 'B1',
      dispatch: succeed('D1'),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorRow.addr_no).toBe('440755')
      expect(r.errorRow.place_no).toBeNull()
      expect(r.errorRow.dispatch_policy_no).toBeNull()
      expect(r.errorRow.raw_meta.failedStep).toBe('place')
      expect(r.errorRow.raw_meta.completedSteps).toEqual(['address'])
    }
  })

  it('③ policy 실패 → addr_no/place_no 확보, failedStep=policy', () => {
    const r = runProfileCreate({
      address: succeed('A1'),
      place: succeed('P1'),
      policy: () => {
        const e: Error & SimError = Object.assign(new Error('x'), {
          code: 'esm_policy_schema_mismatch',
        })
        throw e
      },
      dispatch: succeed('D1'),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorRow.addr_no).toBe('A1')
      expect(r.errorRow.place_no).toBe('P1')
      expect(r.errorRow.bundle_policy_no).toBeNull()
      expect(r.errorRow.dispatch_policy_no).toBeNull()
      expect(r.errorRow.raw_meta.failedStep).toBe('policy')
      expect(r.errorRow.raw_meta.completedSteps).toEqual(['address', 'place'])
    }
  })

  it('④ dispatch 실패(고아 최대) → addr/place/bundle 확보, dispatch_policy_no null', () => {
    const r = runProfileCreate({
      address: succeed('440756'),
      place: succeed('176131'),
      policy: () => '663290',
      dispatch: fail('esm_dispatch_http_502'),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorRow.addr_no).toBe('440756')
      expect(r.errorRow.place_no).toBe('176131')
      expect(r.errorRow.bundle_policy_no).toBe('663290')
      expect(r.errorRow.dispatch_policy_no).toBeNull()
      expect(r.errorRow.raw_meta.failedStep).toBe('dispatch')
      expect(r.errorRow.raw_meta.completedSteps).toEqual(['address', 'place', 'policy'])
    }
  })

  it('fallback — errorCode 가 step prefix 와 무관해도 partial 진행도로 단계 추정', () => {
    // address 성공, place 에서 step prefix 없는 에러 → partial.placeNo undefined → 'place' 추정.
    const r = runProfileCreate({
      address: succeed('A1'),
      place: fail('esm_step_unknown'),
      policy: () => 'B1',
      dispatch: succeed('D1'),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorRow.raw_meta.failedStep).toBe('place')
      expect(r.errorRow.addr_no).toBe('A1')
    }
  })
})

describe('error-row / 보안 — raw_meta 에 PII 없음', () => {
  it('어떤 단계 실패든 raw_meta 키는 정확히 {failedStep,errorCode,completedSteps}', () => {
    for (const code of [
      'esm_address_http_401',
      'esm_place_http_500',
      'esm_policy_schema_mismatch',
      'esm_dispatch_invalid_json',
    ]) {
      const r = runProfileCreate({
        address: code.includes('address') ? fail(code) : succeed('A1'),
        place: code.includes('place') ? fail(code) : succeed('P1'),
        policy: code.includes('policy')
          ? () => {
              const e: Error & SimError = Object.assign(new Error('x'), { code })
              throw e
            }
          : () => 'B1',
        dispatch: code.includes('dispatch') ? fail(code) : succeed('D1'),
      })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        const keys = Object.keys(r.errorRow.raw_meta).sort()
        expect(keys).toEqual(['completedSteps', 'errorCode', 'failedStep'])
        // PII 토큰 흔적이 raw_meta 직렬화에 절대 없음.
        const serialized = JSON.stringify(r.errorRow.raw_meta)
        expect(serialized).not.toMatch(/secret|token|phone|addr1|representativeName/i)
      }
    }
  })
})
