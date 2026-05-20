import { createMockAdapter } from './createMockAdapter'
import type { MarketAdapter } from '../types'

/**
 * G마켓 debug 어댑터 — v1 정식 라인업 (ESM JWT).
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §9
 *
 * v1 변경 (2026-05-19): authenticate input = AuthInput.kind='esm_jwt' (site='G').
 * credentialKind = 'esm_jwt'. refreshToken 정의 없음 (영구 키).
 */
export const gmarketDebugAdapter: MarketAdapter = createMockAdapter('gmarket')
