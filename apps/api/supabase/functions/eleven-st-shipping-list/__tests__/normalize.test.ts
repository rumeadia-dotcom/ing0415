/**
 * eleven-st-shipping-list / 출고지·반품지 조회 응답 정규화 단위 테스트 (PR-2).
 *
 * 검증 대상: lib/normalize.ts 의 pure 헬퍼 (Deno 의존 없음 → vitest 환경 import 가능).
 *   index.ts 의 Deno.serve entry 는 vitest 에서 직접 import 불가 (npm:/Deno specifier).
 *   따라서 정규화/결과분류/PII 차단 로직만 순수 단위로 검증한다 (esm-shipping-list normalize 와 동일 패턴).
 *
 * 마스터:
 *   - docs/architecture/v1/features/11st.md §3 (Layer 2 — 조회형 확정, PII 미저장)
 *   - 11st-api/product/shipping-1014.md (출고지) / shipping-1015.md (반품/교환지)
 *   - testing.md R-001 / CLAUDE.md "pass + fail(빈 목록·필드 누락·조회실패) ≥1"
 */

import { describe, expect, it } from 'vitest'
import {
  classifyElevenStShippingResult,
  normalizeElevenStAddresses,
} from '../lib/normalize'

// ns2 prefix 가 붙은 spec 형태 응답 (fast-xml-parser 파싱 직후 — stripNsPrefix 전).
function ns2Response(
  addresses: Record<string, unknown>[],
  resultMessage = 'SUCCESS',
): unknown {
  const inOutAddress = addresses.map((a) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(a)) out[`ns2:${k}`] = v
    return out
  })
  return {
    'ns2:inOutAddresss': {
      'ns2:inOutAddress': inOutAddress.length === 1 ? inOutAddress[0] : inOutAddress,
      'ns2:result_message': resultMessage,
    },
  }
}

// ─────────────────────────────────────────────
// normalizeElevenStAddresses
// ─────────────────────────────────────────────

describe('normalizeElevenStAddresses', () => {
  it('정상 응답 — ns2 제거 후 addrSeq+addrNm 추출 (출고지 1014)', () => {
    const raw = ns2Response([
      {
        addrSeq: 14,
        addrNm: '본사',
        addr: '서울 중구 을지로1가 111',
        rcvrNm: '홍길동',
        gnrlTlphnNo: '02-1111-2222',
        prtblTlphnNo: '010-3333-4444',
        memNo: '10000000',
      },
      { addrSeq: '27', addrNm: '제2물류센터', addr: '경기 ...' },
    ])
    expect(normalizeElevenStAddresses(raw)).toEqual([
      { addrSeq: '14', addrNm: '본사' },
      { addrSeq: '27', addrNm: '제2물류센터' },
    ])
  })

  it('⚠️ PII 차단 — 주소/이름/전화/회원번호는 정규화 결과에 통과시키지 않는다', () => {
    const raw = ns2Response([
      {
        addrSeq: 14,
        addrNm: '본사',
        addr: '서울 중구 을지로1가 111',
        rcvrNm: '홍길동',
        gnrlTlphnNo: '02-1111-2222',
        prtblTlphnNo: '010-3333-4444',
        memNo: '10000000',
      },
    ])
    const [opt] = normalizeElevenStAddresses(raw)
    expect(Object.keys(opt ?? {}).sort()).toEqual(['addrNm', 'addrSeq'])
    // 직렬화해도 PII 토큰이 새지 않는다.
    const serialized = JSON.stringify(normalizeElevenStAddresses(raw))
    expect(serialized).not.toContain('을지로')
    expect(serialized).not.toContain('홍길동')
    expect(serialized).not.toContain('010-3333-4444')
    expect(serialized).not.toContain('10000000')
  })

  it('단건 응답(inOutAddress 가 배열 아닌 단일 객체)도 정규화', () => {
    const raw = ns2Response([{ addrSeq: '31', addrNm: '본사 반품지' }])
    expect(normalizeElevenStAddresses(raw)).toEqual([
      { addrSeq: '31', addrNm: '본사 반품지' },
    ])
  })

  it('빈 목록 — inOutAddress 없음 → [] (셀러오피스 미등록)', () => {
    const raw = { 'ns2:inOutAddresss': { 'ns2:result_message': 'SUCCESS' } }
    expect(normalizeElevenStAddresses(raw)).toEqual([])
  })

  it('필드 누락 — addrSeq / addrNm 없는 항목은 스킵', () => {
    const raw = ns2Response([
      { addrNm: '시퀀스없음' }, // addrSeq 누락 → 스킵
      { addrSeq: 5 }, // addrNm 누락 → 스킵
      { addrSeq: 7, addrNm: '정상' },
    ])
    expect(normalizeElevenStAddresses(raw)).toEqual([
      { addrSeq: '7', addrNm: '정상' },
    ])
  })

  it('조회실패 — result_message 가 SUCCESS 아니면 [] (에러 메시지 누출 방지)', () => {
    const raw = {
      'ns2:inOutAddresss': {
        'ns2:result_message':
          '주소지 조회 오류 : OpenAPI Key 에 해당하는 유저가 없습니다.',
      },
    }
    expect(normalizeElevenStAddresses(raw)).toEqual([])
  })

  it('wrapper 누락 / 알 수 없는 형태 → 빈 배열 (조회실패 안전 기본값)', () => {
    expect(normalizeElevenStAddresses({})).toEqual([])
    expect(normalizeElevenStAddresses(null)).toEqual([])
    expect(normalizeElevenStAddresses('oops')).toEqual([])
  })
})

// ─────────────────────────────────────────────
// classifyElevenStShippingResult
// ─────────────────────────────────────────────

describe('classifyElevenStShippingResult', () => {
  it('SUCCESS + 주소 1건 → ok', () => {
    const raw = ns2Response([{ addrSeq: 1, addrNm: 'A' }])
    expect(classifyElevenStShippingResult(raw)).toEqual({ kind: 'ok' })
  })

  it('success (소문자) 도 ok 로 인정', () => {
    const raw = ns2Response([{ addrSeq: 1, addrNm: 'A' }], 'success')
    expect(classifyElevenStShippingResult(raw)).toEqual({ kind: 'ok' })
  })

  it('SUCCESS + 주소 0건 → empty', () => {
    const raw = { 'ns2:inOutAddresss': { 'ns2:result_message': 'SUCCESS' } }
    expect(classifyElevenStShippingResult(raw)).toEqual({ kind: 'empty' })
  })

  it('result_message 가 오류 메시지 → error (메시지 보존, 호출측이 비노출 처리)', () => {
    const raw = {
      'ns2:inOutAddresss': {
        'ns2:result_message': '주소지 조회 오류 : 유저 없음',
      },
    }
    const cls = classifyElevenStShippingResult(raw)
    expect(cls.kind).toBe('error')
    expect(cls.kind === 'error' && cls.message).toContain('조회 오류')
  })

  it('container 누락 → empty (안전 기본값)', () => {
    expect(classifyElevenStShippingResult({})).toEqual({ kind: 'empty' })
    expect(classifyElevenStShippingResult(null)).toEqual({ kind: 'empty' })
  })
})
