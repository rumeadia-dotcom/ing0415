import { createMockAdapter } from './createMockAdapter'
import type { MarketAdapter } from '../types'

/**
 * 쿠팡 debug 어댑터 — v1 정식 라인업 (HMAC).
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §9
 *
 * v1 변경 (2026-05-19): authenticate input = AuthInput.kind='hmac_key'.
 * credentialKind = 'hmac'. refreshToken 정의 없음 (영구 키).
 * 현 단계는 공통 mock 의 wrapper — Stage F real 어댑터 옆에 실제 HMAC 어댑터 본문 작성.
 */
export const coupangDebugAdapter: MarketAdapter = createMockAdapter('coupang')
