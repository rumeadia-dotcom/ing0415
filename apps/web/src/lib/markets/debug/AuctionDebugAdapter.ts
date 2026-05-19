import { createMockAdapter } from './createMockAdapter'
import type { MarketAdapter } from '../types'

/**
 * 옥션 debug 어댑터 — v1 정식 라인업 (ESM JWT).
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §9
 *
 * v1 변경 (2026-05-19): authenticate input = AuthInput.kind='esm_jwt' (site='A').
 * credentialKind = 'esm_jwt'. refreshToken 정의 없음 (영구 키).
 * G마켓·옥션은 ESM 2.0 통합 백오피스를 공유 — 어댑터 구조 동일, site 만 다름.
 */
export const auctionDebugAdapter: MarketAdapter = createMockAdapter('auction')
