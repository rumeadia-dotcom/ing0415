# market-adapter.md — 마켓 어댑터 인터페이스 (v1 cross-cutting)

> 본 문서는 다중 마켓 상품 자동 등록 SaaS 의 **마켓 어댑터 단일 인터페이스**를 정의한다.
> 본 문서는 `platform.md` / `frontend.md` / `security.md` / `testing.md` 와 정합해야 하며,
> 충돌 시 `security.md` 가 우선한다. `features/markets.md` 와 `features/registration.md`
> 는 본 문서의 인터페이스·타입·에러 매핑을 그대로 인용한다.
>
> **작성 책임**: backend (INTJ, 12년차).
> **승인**: architect + security.
> **개정 절차**: 5메서드 인터페이스 변경 / 공용 타입 변경은 backend + architect + security 3자 승인 필수.
>
> **근거**: PRD §1.2 / §1.3 / §2.2 / §2.4, CLAUDE.md "핵심 아키텍처 결정 사항" §1, `security.md` §4 / §6 / §7.

---

## 1. 목적 · 범위

- **목적**: 마켓 API 의 변덕(엔드포인트·페이로드·rate limit·인증방식)을 5메서드 인터페이스 1장 뒤에 격리한다.
- **범위 (2026-05-22 v1.3 / 2026-05-23 정정)**: **v1 정식 = 네이버 / 쿠팡 / G마켓 / 옥션 / 11번가 5개 전부 — real 어댑터까지 동작**. 모든 마켓 호출은 **AWS Lightsail Market Gateway (서울 리전 고정 IP)** 를 경유 (`market-gateway.md` 참조). **5개 마켓 전부** 가 셀러의 키 발급 단계에서 IP 화이트리스트 등록을 요구하며 (이전엔 11번가만 있다고 잘못 기재), gateway 의 고정 IP 1개를 5개 마켓 셀러 콘솔에 모두 등록하는 방식으로 일괄 해소. v1 단계에서 `authenticate(input)` 의 `input` 은 **4-way `AuthInput` discriminated union** — OAuth code (네이버) / HMAC 키 (쿠팡) / ESM JWT (G마켓·옥션) / API Key (11번가). 어댑터 내부 `fetch` 는 모두 `_shared/gatewayFetch()` 로 wrapping.
- **비범위**: 재시도·rate limit·이미지 변환·로깅·감사 — 어댑터 **바깥**(`registration-run` Edge Function 오케스트레이터 + `_shared/*`).

---

## 2. MarketAdapter 인터페이스 (5메서드, 강제)

신규 마켓 추가 = **이 인터페이스를 구현하는 1파일** (`apps/web/src/lib/markets/<id>/adapter.ts`) + 단위 테스트.
6번째 메서드 추가는 본 문서 개정 절차로만 가능. 어댑터 내부에 fetch retry / 이미지 변환 / 큐 / Sentry 직접 호출 코드를 두는 PR 은 **차단**.

### 2.1 TypeScript 시그니처 (2026-05-19 4-way AuthInput 확장)

```ts
// apps/web/src/lib/markets/types.ts
import { z } from 'zod';
import type {
  AuthInput,
  CategoryNode,
  CreateProductResult,
  MarketCredentialKind,
  MarketId,
  MarketMapping,
  MarketPayload,
  Product,
  StoredCredential,
  TokenSet,
} from '@/lib/schemas';

/**
 * MarketAdapter — 5메서드 인터페이스 (강제).
 *
 * 2026-05-19 변경 사항:
 *  - `authenticate(input)` 의 input 이 4-way `AuthInput` discriminated union 으로 확장됨.
 *    OAuth code (네이버) / HMAC 키 (쿠팡) / ESM JWT (G마켓·옥션) / API Key (11번가) 분기.
 *  - `refreshToken` 은 OAuth (네이버) 에서만 사용 → **optional**. HMAC·ESM JWT·API Key 는 영구 키이므로 어댑터에서 정의 생략.
 *  - 반환 타입이 `TokenSet` → `StoredCredential` (kind + payload + optional expiresAt) 로 일반화.
 */
export interface MarketAdapter {
  /** 어댑터 인스턴스가 다루는 마켓 ID. */
  readonly market: MarketId;

  /** 어댑터가 사용하는 credential kind. credential_payload jsonb 의 kind 와 1:1. */
  readonly credentialKind: MarketCredentialKind;

  /**
   * 4-way 인증 input → 저장 가능한 credential.
   * 입력: AuthInput = oauth_code (네이버) | hmac_key (쿠팡) | esm_jwt (G마켓·옥션) | api_key (11번가).
   * 출력: StoredCredential = kind + payload (+ OAuth 만 expiresAt).
   * 에러: MarketError('unauthorized' | 'validation' | 'network' | 'server' | 'unknown').
   */
  authenticate(input: AuthInput): Promise<StoredCredential>;

  /**
   * refresh_token → token 갱신. **OAuth (네이버) 에서만 사용 → optional**.
   * HMAC (쿠팡) / ESM JWT (G마켓·옥션) / API Key (11번가) 는 정의 자체 생략 (`undefined`).
   * 에러: 'unauthorized' (invalid_grant / revoked) → 호출측에서 disconnected 처리.
   */
  refreshToken?(refresh: string): Promise<TokenSet>;

  /**
   * 마켓 카테고리 트리. 캐시 정책·만료는 호출측(features/markets.md §카테고리 캐시) 담당.
   * 어댑터는 마켓 API 호출 + zod 검증 + 트리 정규화.
   */
  fetchCategoryTree(): Promise<CategoryNode[]>;

  /**
   * 도메인 Product + 마켓별 MarketMapping → 마켓 페이로드.
   * 순수 함수. fetch / Date.now / Math.random 직접 사용 금지 (결정성).
   */
  transformProduct(product: Product, mapping: MarketMapping): MarketPayload;

  /**
   * 마켓에 상품 생성 요청. 결과는 externalId + productUrl + status.
   * 부분 성공이 마켓 측에서 있을 수 있으면 status='partial' + warnings 채움.
   */
  createProduct(payload: MarketPayload): Promise<CreateProductResult>;

  /**
   * 마켓별 동적 등록필드 메타 (optional, §9.8). s3 3단계 MarketOptionsCard 가
   * 마켓을 몰라도 동적 렌더할 수 있게 RegistrationFieldMeta[] 를 노출.
   * 하위호환: 미구현(undefined) = 추가 등록필드 없음(= []). naver/coupang/11st 는
   * 메서드 생략 → 카테고리 매핑만. ESM(gmarket/auction)만 배송 프로필 선택 필드 선언.
   * 순수 동기 함수 — 외부 호출 없음.
   */
  getRegistrationFields?(): RegistrationFieldMeta[];
}
```

### 2.2 입력 / 출력 zod 스키마 (`apps/web/src/lib/schemas/market.ts`)

본 스키마는 BE/FE 공유 단일 소스. 마켓 API 응답은 어댑터 내부에서 본 스키마로 `parse` (예외 → `MarketError('validation')`).

**`MarketCredentialKind` 마스터 위치**: `apps/web/src/lib/schemas/market.ts` (4값 enum: `oauth` / `hmac` / `esm_jwt` / `api_key`). `credential_payload` jsonb 의 `kind` 필드와 1:1.

```ts
// apps/web/src/lib/schemas/market.ts
import { z } from 'zod';

// ---------- MarketId ----------
export const MarketIdSchema = z.enum([
  'naver',
  'coupang',
  '11st',
  'gmarket',
  'auction',
]);
export type MarketId = z.infer<typeof MarketIdSchema>;

// ---------- MarketCredentialKind ----------
// credential_payload jsonb 의 kind 필드 — credential-vault.md §3.1 마스터.
export const MARKET_CREDENTIAL_KINDS = ['oauth', 'hmac', 'esm_jwt', 'api_key'] as const;
export const MarketCredentialKindSchema = z.enum(MARKET_CREDENTIAL_KINDS);
export type MarketCredentialKind = z.infer<typeof MarketCredentialKindSchema>;

// ---------- TokenSet (OAuth 전용) ----------
export const TokenSetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  // ISO 8601. 마켓 응답 expires_in(초)은 어댑터에서 절대시각으로 환산.
  expiresAt: z.string().datetime({ offset: true }),
  scope: z.string().optional(),
  tokenType: z.literal('Bearer').default('Bearer'),
});
export type TokenSet = z.infer<typeof TokenSetSchema>;

// ---------- AuthInput (4-way discriminated union) ----------
// MarketAdapter.authenticate(input) 의 input 타입. 마켓별 인증 방식 분기.
//
//  - oauth_code: 네이버 스마트스토어 (`type=SELF` Authorization Code)
//  - hmac_key:   쿠팡 윙 OpenAPI (VENDOR_ID + ACCESS_KEY + SECRET_KEY)
//  - esm_jwt:    G마켓·옥션 ESM 2.0 (masterId + secretKey + sellerId + site)
//  - api_key:    11번가 (API Key 단일. v1.3 정식 진입 — AWS Lightsail Gateway 고정 IP 화이트리스트 등록 후 활성)
export const OAuthCodeAuthInputSchema = z.object({
  kind: z.literal('oauth_code'),
  code: z.string().min(1),
});

export const HmacKeyAuthInputSchema = z.object({
  kind: z.literal('hmac_key'),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  vendorId: z.string().min(1),
});

export const EsmJwtAuthInputSchema = z.object({
  kind: z.literal('esm_jwt'),
  masterId: z.string().min(1),
  secretKey: z.string().min(1),
  sellerId: z.string().min(1),
  site: z.enum(['G', 'A']),                    // G = G마켓, A = 옥션
});

export const ApiKeyAuthInputSchema = z.object({
  kind: z.literal('api_key'),
  apiKey: z.string().min(1),
});

export const AuthInputSchema = z.discriminatedUnion('kind', [
  OAuthCodeAuthInputSchema,
  HmacKeyAuthInputSchema,
  EsmJwtAuthInputSchema,
  ApiKeyAuthInputSchema,
]);
export type AuthInput = z.infer<typeof AuthInputSchema>;

// ---------- StoredCredential (adapter.authenticate 반환 타입) ----------
// credential_payload jsonb 에 저장될 형식과 1:1.
// kind 별 payload 분기 — OAuth 만 expiresAt 필수, 나머지는 영구 키.
export const StoredCredentialSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('oauth'),
    payload: TokenSetSchema,
    expiresAt: z.string().datetime({ offset: true }),       // OAuth 만 만료
  }),
  z.object({
    kind: z.literal('hmac'),
    payload: z.object({
      accessKey: z.string().min(1),
      secretKey: z.string().min(1),
      vendorId: z.string().min(1),
    }),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    kind: z.literal('esm_jwt'),
    payload: z.object({
      masterId: z.string().min(1),
      secretKey: z.string().min(1),
      sellerId: z.string().min(1),
      site: z.enum(['G', 'A']),
    }),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
  z.object({
    kind: z.literal('api_key'),
    payload: z.object({ apiKey: z.string().min(1) }),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  }),
]);
export type StoredCredential = z.infer<typeof StoredCredentialSchema>;

// ---------- CategoryNode (재귀) ----------
export type CategoryNode = {
  id: string;            // 마켓 측 카테고리 코드
  name: string;          // 표시명 (한국어)
  depth: number;         // 1-based
  leaf: boolean;         // true 면 등록 가능
  parentId: string | null;
  children: CategoryNode[];
};
export const CategoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    depth: z.number().int().min(1).max(10),
    leaf: z.boolean(),
    parentId: z.string().nullable(),
    children: z.array(CategoryNodeSchema),
  }),
);

// ---------- Product (도메인 마스터) ----------
export const ProductImageSchema = z.object({
  // Supabase Storage URL (서명된 또는 public). 변환본 URL 은 MarketMapping 쪽.
  url: z.string().url(),
  alt: z.string().max(120).optional(),
  order: z.number().int().min(0),
});
export const ProductSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  name: z.string().min(1).max(100),
  priceKrw: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  images: z.array(ProductImageSchema).min(1).max(20),
  descriptionHtml: z.string().max(50_000).default(''),
  // 마스터 카테고리는 자유 텍스트 (마켓별 매핑은 MarketMapping 으로).
  categoryHint: z.string().max(120).optional(),
  brand: z.string().max(60).optional(),
  // 배송 정보 (마켓별 필수 필드는 mapping 으로 채움).
  shippingFeeKrw: z.number().int().nonnegative().default(0),
});
export type Product = z.infer<typeof ProductSchema>;

// ---------- MarketMapping ----------
export const MarketMappingSchema = z.object({
  market: MarketIdSchema,
  // 마켓 측 카테고리 코드 (leaf).
  categoryId: z.string().min(1),
  // 변환된 이미지 URL 배열 (마켓 규격 충족).
  transformedImageUrls: z.array(z.string().url()).min(1).max(20),
  // 마켓별 필수 필드(자유 형식). 어댑터가 자신만의 zod 로 다시 검증.
  extra: z.record(z.string(), z.unknown()).default({}),
});
export type MarketMapping = z.infer<typeof MarketMappingSchema>;

// ---------- MarketPayload (마켓별 페이로드, opaque) ----------
// 어댑터별 페이로드는 마켓 API 스펙에 따라 형태가 천차만별 →
// 본 타입은 의도적으로 brand 타입만 강제하고, 내부 구조 검증은 각 어댑터의 zod 스키마가 책임.
export const MarketPayloadSchema = z.object({
  market: MarketIdSchema,
  raw: z.unknown(), // 마켓별 어댑터 zod 로 parse 된 후 들어옴
});
export type MarketPayload = z.infer<typeof MarketPayloadSchema>;

// ---------- CreateProductResult ----------
export const CreateProductResultSchema = z.object({
  market: MarketIdSchema,
  externalId: z.string().min(1),      // 마켓 측 상품 ID
  productUrl: z.string().url(),        // 셀러가 마켓에서 직접 볼 수 있는 URL
  status: z.enum(['succeeded', 'partial']),
  warnings: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
      }),
    )
    .default([]),
});
export type CreateProductResult = z.infer<typeof CreateProductResultSchema>;
```

### 2.3 구현 규약

- **순수성**: `transformProduct` 는 순수 함수. fetch / Date.now / Math.random 직접 사용 금지 (테스트 결정성). 시각이 필요하면 mapping 에 inject.
- **검증 의무**: 마켓 응답을 받은 즉시 어댑터별 zod 스키마로 `parse`. 실패 = `MarketError('validation')`. 그대로 도메인 타입으로 노출 금지.
- **fetch wrapper 금지**: 어댑터 내부에서 직접 retry / backoff / circuit breaker 구현 금지. 어댑터는 `globalThis.fetch` (또는 주입된 `httpClient`) 를 1회 호출. 재시도는 호출측에서.
- **로깅 직접 호출 금지**: `console.*` / Sentry 직접 호출 금지. 호출측이 wrap 한 logger 를 통해서만. 어댑터는 `throw` 만.

---

## 3. 공용 타입 위치 / import 경로

| 타입 | 정의 위치 | 사용처 |
|---|---|---|
| `MarketId` | `apps/web/src/lib/schemas/common.ts` | 모든 곳 |
| `MarketCredentialKind` | `apps/web/src/lib/schemas/market.ts` | adapter, credential-vault, `features/markets` |
| `AuthInput` (+ 4 변형 schema) | `apps/web/src/lib/schemas/market.ts` | adapter, `markets-connect` / `markets-oauth-callback` Edge Function |
| `StoredCredential` | `apps/web/src/lib/schemas/market.ts` | adapter, `fn_encrypt_and_store_credential` 입력 |
| `TokenSet` | `apps/web/src/lib/schemas/market.ts` | OAuth refreshToken 경로 (네이버 한정) |
| `CategoryNode` | `apps/web/src/lib/schemas/market.ts` | adapter, `features/registration` |
| `Product` | `apps/web/src/lib/schemas/market.ts` | adapter, `features/registration` |
| `MarketMapping` | `apps/web/src/lib/schemas/market.ts` | adapter, `features/registration` |
| `MarketPayload` | `apps/web/src/lib/schemas/market.ts` | adapter |
| `CreateProductResult` | `apps/web/src/lib/schemas/market.ts` | adapter, `features/registration` |
| `MarketAdapter` | `apps/web/src/lib/markets/types.ts` | adapter, orchestrator |
| `MarketError` | `apps/web/src/lib/markets/errors.ts` | adapter, orchestrator |

---

## 4. mock / real 어댑터 동등성

### 4.1 모드 분기 (단 1지점)

```ts
// apps/web/src/lib/markets/index.ts
import { useMock } from '@/lib/env';
import type { MarketAdapter } from './types';
import type { MarketId } from '@/lib/schemas/common';

export async function getMarketAdapter(market: MarketId): Promise<MarketAdapter> {
  if (useMock) {
    const { createDebugAdapter } = await import('./debug');
    return createDebugAdapter(market);
  }
  // 2026-05-22 v1.3: 5 마켓 전부 (naver / coupang / gmarket / auction / 11st) real 어댑터 활성.
  // 모든 마켓 호출은 AWS Lightsail Market Gateway (서울 리전 고정 IP) 경유 — market-gateway.md 참조.
  // 11번가 IP 화이트리스트 정책은 gateway 고정 IP 등록으로 해소.
  switch (market) {
    case 'naver': {
      const { createNaverAdapter } = await import('./real/naver');
      return createNaverAdapter();
    }
    case 'coupang': {
      const { createCoupangAdapter } = await import('./real/coupang');
      return createCoupangAdapter();
    }
    case 'gmarket': {
      const { createGmarketAdapter } = await import('./real/gmarket');
      return createGmarketAdapter();
    }
    case 'auction': {
      const { createAuctionAdapter } = await import('./real/auction');
      return createAuctionAdapter();
    }
    case '11st': {
      // v1.3 정식 진입 — AWS Lightsail Market Gateway 고정 IP 를 11번가 화이트리스트에 등록 후 활성.
      const { create11stAdapter } = await import('./real/11st');
      return create11stAdapter();
    }
    default: {
      const _exhaustive: never = market;
      throw new Error(`unknown market: ${String(_exhaustive)}`);
    }
  }
}
```

- **금지**: `getAdapter` 외 위치에서 `if (mode === 'debug')` 로 어댑터 본체를 분기. 어댑터 1개당 mock 파일 1개·real 파일 1개. 그 외 위치에서 모드 분기 발견 시 PR 차단.
- **빌드 검증**: real 빌드 산출물 (`dist/`) 에 `markets/mock/` 코드가 포함되지 않는지 `pnpm grep:secrets` + `pnpm grep:mock-leak` 으로 자동 검증 (Phase 2 작성). 동적 import + `mode === 'debug'` 가드로 tree-shaking 가능하게.

### 4.2 mock 응답도 zod 통과 필수

```ts
// apps/web/src/lib/markets/debug/<id>/adapter.ts (요지) — 2026-05-19 4-way AuthInput 반영
import type { MarketAdapter } from '../../types';
import {
  type AuthInput,
  type CategoryNode,
  type CreateProductResult,
  CategoryNodeSchema,
  CreateProductResultSchema,
  type MarketCredentialKind,
  type MarketId,
  type MarketMapping,
  type MarketPayload,
  type Product,
  type StoredCredential,
  StoredCredentialSchema,
  type TokenSet,
  TokenSetSchema,
} from '@/lib/schemas';
import { MarketError } from '../../errors';

type Scenario = 'happy' | '5xx' | '401' | '429' | 'timeout' | 'partial';

const SCENARIO: Scenario =
  (globalThis as { __MOCK_SCENARIO__?: Scenario }).__MOCK_SCENARIO__ ?? 'happy';

/**
 * createDebugAdapter — 마켓 ID 별로 credentialKind 와 authenticate 분기를 다르게 셋업.
 * naver=oauth / coupang=hmac / gmarket=esm_jwt / auction=esm_jwt / 11st=api_key.
 */
export function createDebugAdapter(market: MarketId): MarketAdapter {
  const credentialKind: MarketCredentialKind =
    market === 'naver' ? 'oauth' :
    market === 'coupang' ? 'hmac' :
    market === 'gmarket' || market === 'auction' ? 'esm_jwt' :
    'api_key';

  return {
    market,
    credentialKind,
    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (SCENARIO === '5xx') throw new MarketError('server', 'mock 5xx', { market });
      if (SCENARIO === '401') throw new MarketError('unauthorized', 'mock 401', { market });
      if (SCENARIO === '429') throw new MarketError('rate_limit', 'mock 429', { market, retryAfterMs: 1500 });
      if (SCENARIO === 'timeout') {
        await new Promise((r) => setTimeout(r, 60_000));
        throw new MarketError('network', 'mock timeout', { market });
      }
      // kind 별 happy 분기 — 입력 kind 가 어댑터 credentialKind 와 일치해야 함
      if (input.kind === 'oauth_code') {
        return StoredCredentialSchema.parse({
          kind: 'oauth',
          payload: {
            accessToken: 'mock_access_' + 'x'.repeat(40),
            refreshToken: 'mock_refresh_' + 'x'.repeat(40),
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            scope: 'product.write',
            tokenType: 'Bearer',
          },
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        });
      }
      if (input.kind === 'hmac_key') {
        return StoredCredentialSchema.parse({
          kind: 'hmac',
          payload: { accessKey: input.accessKey, secretKey: input.secretKey, vendorId: input.vendorId },
        });
      }
      if (input.kind === 'esm_jwt') {
        return StoredCredentialSchema.parse({
          kind: 'esm_jwt',
          payload: {
            masterId: input.masterId, secretKey: input.secretKey,
            sellerId: input.sellerId, site: input.site,
          },
        });
      }
      // api_key (11번가 v1.3 정식 — AWS Lightsail Gateway 경유)
      return StoredCredentialSchema.parse({
        kind: 'api_key',
        payload: { apiKey: input.apiKey },
      });
    },
    // OAuth (네이버) 만 refreshToken 정의. HMAC/ESM JWT/API Key 어댑터는 이 메서드 자체 생략 (undefined).
    async refreshToken(_refresh): Promise<TokenSet> {
      if (SCENARIO === '401') throw new MarketError('unauthorized', 'invalid_grant', { market });
      return TokenSetSchema.parse({
        accessToken: 'mock_access_rotated_' + 'x'.repeat(40),
        refreshToken: 'mock_refresh_rotated_' + 'x'.repeat(40),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        tokenType: 'Bearer',
      });
    },
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const tree: CategoryNode[] = [
        {
          id: 'C-100',
          name: '패션의류',
          depth: 1,
          leaf: false,
          parentId: null,
          children: [
            { id: 'C-100-10', name: '여성의류', depth: 2, leaf: true, parentId: 'C-100', children: [] },
          ],
        },
      ];
      // mock 도 동일 스키마 통과해야 함 (regression: 스키마 변경 시 mock 깨짐)
      return tree.map((n) => CategoryNodeSchema.parse(n));
    },
    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      return {
        market,
        raw: {
          name: product.name,
          price: product.priceKrw,
          stock: product.stock,
          images: mapping.transformedImageUrls,
          categoryId: mapping.categoryId,
          extra: mapping.extra,
        },
      };
    },
    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      if (SCENARIO === '5xx') throw new MarketError('server', 'mock 5xx', { market });
      if (SCENARIO === '429') throw new MarketError('rate_limit', 'mock 429', { market, retryAfterMs: 2000 });
      if (SCENARIO === 'partial') {
        return CreateProductResultSchema.parse({
          market,
          externalId: 'MOCK-' + Math.random().toString(36).slice(2, 10),
          productUrl: `https://mock.${market}.example.com/p/123`,
          status: 'partial',
          warnings: [{ code: 'image_resized', message: '이미지 1장이 권장 해상도 미달로 자동 보정됨' }],
        });
      }
      return CreateProductResultSchema.parse({
        market,
        externalId: 'MOCK-' + Math.random().toString(36).slice(2, 10),
        productUrl: `https://mock.${market}.example.com/p/123`,
        status: 'succeeded',
        warnings: [],
      });
    },
  };
}
```

### 4.3 Vitest 단위 테스트 예시 (동등성 1개)

```ts
// apps/web/src/lib/markets/__tests__/adapter-contract.test.ts — 2026-05-19 4-way AuthInput 반영
import { describe, it, expect } from 'vitest';
import { createDebugAdapter } from '@/lib/markets/debug';
import {
  StoredCredentialSchema,
  CategoryNodeSchema,
  CreateProductResultSchema,
  ProductSchema,
  MarketMappingSchema,
} from '@/lib/schemas';

describe('MarketAdapter contract — debug(naver) happy path', () => {
  const adapter = createDebugAdapter('naver');

  it('authenticate({kind:"oauth_code"}) → StoredCredentialSchema 통과 (kind=oauth)', async () => {
    const cred = await adapter.authenticate({ kind: 'oauth_code', code: 'dummy_code' });
    expect(() => StoredCredentialSchema.parse(cred)).not.toThrow();
    expect(cred.kind).toBe('oauth');
    if (cred.kind === 'oauth') expect(cred.payload.accessToken.length).toBeGreaterThan(10);
  });

  it('fetchCategoryTree → 모든 노드가 CategoryNodeSchema 통과', async () => {
    const tree = await adapter.fetchCategoryTree();
    expect(tree.length).toBeGreaterThan(0);
    for (const node of tree) {
      expect(() => CategoryNodeSchema.parse(node)).not.toThrow();
    }
  });

  it('transformProduct 는 순수 함수 (동일 입력 → 동일 출력)', () => {
    const product = ProductSchema.parse({
      id: '11111111-1111-1111-1111-111111111111',
      sellerId: '22222222-2222-2222-2222-222222222222',
      name: '테스트 상품',
      priceKrw: 19_900,
      stock: 100,
      images: [{ url: 'https://cdn.example.com/a.jpg', order: 0 }],
      shippingFeeKrw: 0,
    });
    const mapping = MarketMappingSchema.parse({
      market: 'naver',
      categoryId: 'C-100-10',
      transformedImageUrls: ['https://cdn.example.com/a-naver.jpg'],
      extra: {},
    });
    const a = adapter.transformProduct(product, mapping);
    const b = adapter.transformProduct(product, mapping);
    expect(a).toEqual(b);
  });

  it('createProduct(happy) → CreateProductResultSchema 통과', async () => {
    const payload = adapter.transformProduct(
      ProductSchema.parse({
        id: '11111111-1111-1111-1111-111111111111',
        sellerId: '22222222-2222-2222-2222-222222222222',
        name: '테스트 상품',
        priceKrw: 19_900,
        stock: 100,
        images: [{ url: 'https://cdn.example.com/a.jpg', order: 0 }],
        shippingFeeKrw: 0,
      }),
      MarketMappingSchema.parse({
        market: 'naver',
        categoryId: 'C-100-10',
        transformedImageUrls: ['https://cdn.example.com/a-naver.jpg'],
        extra: {},
      }),
    );
    const result = await adapter.createProduct(payload);
    expect(() => CreateProductResultSchema.parse(result)).not.toThrow();
    expect(result.status).toBe('succeeded');
  });
});
```

> 실 어댑터 (`naver`, `coupang`) 도 동일 테스트 슈트를 **MSW 로 마켓 API 를 mocking 한 채** 통과해야 한다 (`testing.md` §통합 테스트).

---

## 5. 재시도 / Rate Limit (어댑터 바깥)

### 5.1 위치

- 오케스트레이터: `apps/api/supabase/functions/registration-run/index.ts`.
- 어댑터 호출 wrap: `apps/api/supabase/functions/_shared/with-retry.ts`.
- 동시 호출 한도: `apps/api/supabase/functions/_shared/limiter.ts` (마켓별 token bucket).

### 5.2 재시도 정책 (지수 백오프 + jitter)

```ts
// apps/api/supabase/functions/_shared/with-retry.ts
import { MarketError } from '@/lib/markets/errors';

export interface RetryPolicy {
  maxAttempts: number;          // 최대 시도 횟수 (1회차 = 최초 호출 포함)
  baseDelayMs: number;          // 첫 백오프
  maxDelayMs: number;           // 상한
  retryOn: Array<MarketError['code']>; // 재시도 대상 에러 코드
}

export const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 16_000,
  retryOn: ['rate_limit', 'server', 'network'],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY,
  ctx: { market: string; correlationId: string; jobId?: string },
): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < policy.maxAttempts) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      attempt += 1;
      if (!(e instanceof MarketError) || !policy.retryOn.includes(e.code) || attempt >= policy.maxAttempts) {
        throw e;
      }
      // 429 의 Retry-After 가 있으면 우선
      const backoffMs =
        e.code === 'rate_limit' && typeof e.context?.retryAfterMs === 'number'
          ? Math.min(e.context.retryAfterMs, policy.maxDelayMs)
          : Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
      // jitter ±20%
      const jittered = backoffMs * (0.8 + Math.random() * 0.4);
      await new Promise((r) => setTimeout(r, jittered));
    }
  }
  throw lastErr;
}
```

- **시도 횟수**: 5 (= 최초 1 + 재시도 4).
- **백오프**: 1s → 2s → 4s → 8s → 16s. jitter ±20% 적용 (thundering herd 방지).
- **429 처리**: `Retry-After` 헤더 값이 있으면 어댑터가 `MarketError('rate_limit', ..., { retryAfterMs })` 로 throw. wrapper 가 우선 사용.
- **무한 재시도 금지**: `maxAttempts` 초과 시 즉시 throw. 호출측이 `registration_job_market_results.status = 'failed'` 로 적재.
- **재시도 대상 에러**: `rate_limit` / `server` (5xx) / `network` (timeout). **`unauthorized` 는 재시도 금지** — 즉시 refreshToken 시도 → 실패 시 disconnected.
- **`validation` / `unknown` 은 재시도 금지** — 마켓 응답 자체가 깨진 경우 재시도해도 동일.

### 5.3 마켓별 동시 호출 한도 (잠정)

| 마켓 | 동시 호출 한도 | 일일 한도 | 근거 |
|---|---|---|---|
| 스마트스토어 (naver) | 3 RPS | Phase 2 실측 | 공식 문서 미공개, 잠정값. Phase 2 의 부하 테스트로 보정. |
| 쿠팡 (coupang) | 5 RPS | Phase 2 실측 | 동일 |
| gmarket / auction / 11st | 3 RPS (잠정) | Phase 2 실측 | 공식 문서 미공개. Phase 2 부하 테스트로 보정. |

```ts
// apps/api/supabase/functions/_shared/limiter.ts
const PER_MARKET_CONCURRENCY: Record<string, number> = {
  naver: 3,
  coupang: 5,
};
```

- **금지**: 한도 값을 어댑터 코드에 박지 않음. `_shared/limiter.ts` 단일 출처.
- **Phase 2 실측 이후**: 본 표와 `limiter.ts` 동시 갱신, 그 PR 에 부하 테스트 결과 첨부.

### 5.4 Edge Function timeout 분할

- Supabase Edge Function 단일 호출 timeout 안에 끝나도록 **마켓 1개 = 함수 호출 1회**로 쪼갠다.
- `registration-run` 은 jobId + market 단위로 호출. 진행 상황은 `registration_job_market_results` 적재 + Realtime push.

---

## 6. 로깅 규약

`security.md` §6.4 를 본 문서 규칙으로 승격.

```ts
// apps/api/supabase/functions/_shared/logger.ts (Edge)
import pino from 'pino'; // Deno 호환 빌드 또는 동등 구조화 로거
import { redact } from './redact'; // security.md §6.2 마스킹

export const logger = pino({
  level: Deno.env.get('APP_MODE') === 'real' ? 'warn' : 'debug',
  base: { service: 'registration-run' },
  formatters: {
    log: (obj) => redact(obj) as Record<string, unknown>,
  },
});
```

### 6.1 외부 호출 로그 3종 (필수 패턴)

```ts
logger.info(
  { market, method, url, sellerId, correlationId, jobId, attempt },
  '→ market request',
);
logger.info(
  { market, status, correlationId, jobId, attempt, latencyMs },
  '← market response',
);
logger.error(
  { market, err: maskError(e), correlationId, jobId, attempt },
  '← market error',
);
```

- **필수 필드**: `market`, `correlationId` (uuid v4, 요청 단위), `jobId` (RegistrationJob 단위. authenticate / refreshToken 처럼 잡 외 호출이면 생략).
- **금지 필드**: `accessToken`, `refreshToken`, `apiKey`, `email`, `phone`, `name`, `password`, 마켓 측 셀러 ID 평문. 토큰은 길이만 (`tokenLength: 187`).
- **maskError**: `security.md` §6.2 `redact()` 를 재사용.

### 6.2 어댑터 내부에서의 로그

- **금지**: 어댑터 본체에서 `logger.*` 호출. 어댑터는 `throw MarketError` 만. 로그는 wrapper(`withRetry` + 오케스트레이터) 책임.
- **이유**: 어댑터 단위 테스트가 stdout 오염 없이 동작해야 함. 로깅을 wrap 하면 mock 시나리오 검증이 단순해짐.

---

## 7. 에러 매핑 — `MarketError` (어댑터 책임)

### 7.1 정의

```ts
// apps/web/src/lib/markets/errors.ts
export type MarketErrorCode =
  | 'unauthorized'   // 401, invalid_grant, revoked
  | 'rate_limit'     // 429
  | 'validation'     // 400 / 422 / 응답 스키마 mismatch
  | 'network'        // timeout / DNS / TLS / 연결 실패
  | 'server'         // 5xx
  | 'unknown';       // 위 어디에도 매핑 불가

export interface MarketErrorContext {
  market: string;
  status?: number;
  retryAfterMs?: number;       // 429 일 때 Retry-After 헤더 환산
  marketErrorCode?: string;    // 마켓이 자체 발급한 error code (예: 'INVALID_CATEGORY')
  marketErrorMessage?: string; // 마켓 응답 메시지 원문 (PII 미포함 가정. 어댑터가 검증)
  cause?: unknown;             // 원본 에러 (로깅측에서 redact 후 기록)
}

export class MarketError extends Error {
  readonly code: MarketErrorCode;
  readonly context: MarketErrorContext;
  constructor(code: MarketErrorCode, message: string, context: MarketErrorContext) {
    super(message);
    this.name = 'MarketError';
    this.code = code;
    this.context = context;
  }
}
```

### 7.2 매핑 규칙 (어댑터 의무)

| 마켓 응답 | MarketErrorCode | 비고 |
|---|---|---|
| HTTP 401, OAuth `invalid_grant` / `invalid_token` / `revoked` | `unauthorized` | 호출측이 refresh → 실패 시 `market_credentials.status='disconnected'` |
| HTTP 429 + `Retry-After` 헤더 | `rate_limit` | `retryAfterMs` 채움. wrapper 우선 사용. |
| HTTP 400 / 422 / 응답 zod 검증 실패 | `validation` | 재시도 금지. `warnings`로 셀러에게 표시. |
| 네트워크 timeout (마켓별 §9.1) / TLS / DNS | `network` | wrapper 재시도 대상. |
| HTTP 5xx | `server` | wrapper 재시도 대상. |
| 그 외 (마켓이 200 으로 에러 body, body 비정상 등) | `unknown` | 재시도 금지. 즉시 알림. |

### 7.3 마켓 측 PII 노출 방지

- **필수**: `marketErrorMessage` 는 마켓이 반환한 그대로가 아니라, 어댑터가 알려진 안전 메시지 화이트리스트와 매칭한 후 저장. 매칭 실패 시 `marketErrorMessage` 미설정 (원본은 `cause` 로만 보관 → 로깅측에서 redact).

---

## 8. 인증 흐름 (provider 별)

> **2026-05-22 v1.3 갱신**: OAuth 흐름은 **네이버 한정**. 쿠팡 (HMAC) / G마켓·옥션 (ESM JWT) / 11번가 (API Key) 는 **`markets-connect` Edge Function 의 폼 입력 흐름** 으로 처리 — `features/markets.md` §4 / §5 참조. 11번가는 v1.3 정식 진입 (AWS Lightsail Gateway 경유).

### 8.1 시퀀스 (네이버 OAuth — ASCII)

```
[Seller Browser]   [App Frontend]      [Edge: oauth-start]     [Market OAuth]    [Edge: oauth-callback]     [Adapter.authenticate]
      |                  |                     |                      |                      |                       |
      | 1. "마켓 연결" 클릭                    |                      |                      |                       |
      |----------------->|                     |                      |                      |                       |
      |                  | 2. POST start(market)|                     |                      |                       |
      |                  |--------------------->| 3. state=rand(32B)  |                      |                       |
      |                  |                     |  store in oauth_state|                      |                       |
      |                  |                     |  + httpOnly cookie   |                      |                       |
      |                  |                     |  → authorize URL     |                      |                       |
      |                  |<--------------------|                      |                      |                       |
      |                  | 4. redirect to auth URL                    |                      |                       |
      | 5. authorize     |                     |                      |                      |                       |
      |----------------------------------------------------------->   |                      |                       |
      |                  |                     |                      | 6. consent           |                       |
      |                  |                     |                      |--------------------->|                       |
      |                  |                     |                      |  callback?code+state |                       |
      |                  |                     |                      |--------------------->| 7. state match check  |
      |                  |                     |                      |                      |  (cookie vs DB)       |
      |                  |                     |                      |                      |---------------------->|
      |                  |                     |                      |                      | 8. authenticate(code) |
      |                  |                     |                      |                      |--{POST token endpoint}|
      |                  |                     |                      |<----------------------- TokenSet             |
      |                  |                     |                      |                      | 9. encrypt + store    |
      |                  |                     |                      |                      |    market_credentials |
      |                  |                     |                      |                      |    (security.md §4)   |
      |                  | 10. redirect to /markets (redirect_to)     |                      |                       |
      |<----------------------------------------------------------------------redirect-------|                       |
```

### 8.2 state / redirect_uri / refresh

- **state**: 32 bytes 난수, DB(`oauth_state`) + httpOnly cookie 양쪽 일치 확인. 1회 사용 후 즉시 삭제. **근거**: `security.md` §7.2.
- **redirect_uri**: 코드 상수 화이트리스트만. **근거**: `security.md` §7.3.
- **refresh 사전 갱신**: 만료 5분 전 cron Edge Function 이 일괄 처리. on-demand 는 401 발생 시에만. **근거**: `security.md` §4.4.

---

## 9. 마켓별 차이 매트릭스 (v1 5 마켓 전부)

> **2026-05-22 v1.3 갱신**: v1 정식 = 네이버 / 쿠팡 / G마켓 / 옥션 / 11번가 5개 전부 (real 어댑터까지 동작). 11번가는 AWS Lightsail Gateway 의 고정 IP 화이트리스트 등록으로 진입.
> 잠정값은 Phase 2 통합 테스트 후 갱신. 갱신 시 본 문서 §13 미해결 사안 행 제거.

### 9.0 인증 방식 / 엔드포인트 요약 (5 마켓 마스터 표)

| 마켓 | `MarketCredentialKind` | `AuthInput.kind` | endpoint / base | refresh | IP 화이트리스트 | v1/v2 |
|---|---|---|---|---|---|---|
| 네이버 스마트스토어 (`naver`) | `oauth` | `oauth_code` | `https://api.commerce.naver.com/external/v1/oauth2/token` | 지원 (refresh_token rotation) | 불필요 | **v1** |
| 쿠팡 (`coupang`) | `hmac` | `hmac_key` | `https://api-gateway.coupang.com` (HMAC-SHA256 헤더 서명) | 없음 (영구 키) | 불필요 | **v1** |
| G마켓 (`gmarket`) | `esm_jwt` | `esm_jwt` | `https://sa.esmplus.com/api/v1` (`site='G'`) | JWT `iat` 만료 시 어댑터가 매 호출 직전 자체 재생성 | 불필요 | **v1** |
| 옥션 (`auction`) | `esm_jwt` | `esm_jwt` | `https://sa.esmplus.com/api/v1` (`site='A'` — 동일 ESM Single Account API) | 동일 (JWT 자체 재생성) | 불필요 | **v1** |
| 11번가 (`11st`) | `api_key` | `api_key` | `https://openapi.11st.co.kr/openapi/OpenApiService.tmall` (XML CP949) | 없음 | **필요** (AWS Lightsail Gateway 고정 IP 등록으로 해소) | **v1** |

**확장 정책 (v1 부터 4-way union)**: 본 표의 5 마켓이 4 가지 `AuthInput.kind` 를 모두 커버한다 (oauth_code / hmac_key / esm_jwt / api_key). 신규 인증 방식 추가 시:

1. `AuthInput` zod discriminated union 에 신규 `kind` 분기 추가 + `MarketCredentialKind` enum 1값 추가
2. 어댑터 1파일 (`apps/web/src/lib/markets/real/<id>/adapter.ts`) — `MarketAdapter` 인터페이스 5메서드 구현
3. 단위 테스트 1파일 — §11 매트릭스 8 케이스

**인터페이스 시그니처는 변경되지 않음** (`authenticate(input: AuthInput) → StoredCredential` 그대로). 호환 보존.

### 9.1 호출 / 인증 사양

| 항목 | 네이버 (`naver`) | 쿠팡 (`coupang`) | G마켓 (`gmarket`) | 옥션 (`auction`) | 11번가 (`11st`) |
|---|---|---|---|---|---|
| 인증 표준 | OAuth 2.0 Authorization Code (`type=SELF`) | HMAC-SHA256 헤더 서명 (요청별) | ESM 2.0 JWT (HS256, 셀러 secretKey 서명) | 동일 (`site='A'`) | API Key 헤더 |
| 토큰/키 보관 형태 | access + refresh + expiresAt (TokenSet) | accessKey + secretKey + vendorId (영구) | masterId + secretKey + sellerId + site (영구) | 동일 | apiKey 단일 (영구) |
| `client_id` / `vendor_id` / `master_id` 보관 | Edge Function env (`NAVER_CLIENT_ID/SECRET`) | 셀러 입력 (`vendorId`) | 셀러 입력 (`masterId`) | 동일 | 셀러 입력 (`apiKey`) |
| `redirect_uri` (화이트리스트) | `https://<host>/markets/callback/naver` | 해당 없음 (OAuth 미사용) | 해당 없음 | 해당 없음 | 해당 없음 |
| `scope` | `product.write product.read` (잠정) | 권한은 쿠팡 윙에서 키 발급 시 부여 | ESM 마이샵 권한 | 동일 | 11번가 셀러오피스 권한 |
| `code` 유효 시간 | 10분 (잠정) | n/a | n/a | n/a | n/a |
| `access_token` TTL | 잠정 1시간 | n/a (영구) | n/a (JWT 매 호출 재생성) | 동일 | n/a (영구) |
| `refresh_token` TTL | 잠정 14일 | — | — | — | — |
| refresh rotation | rotation 있음 가정 | n/a | n/a | n/a | n/a |
| HTTP timeout (어댑터 fetch) | 15s | 15s | 15s | 15s | 15s |
| 429 헤더 | `Retry-After` (초) | `Retry-After` (초) | (Phase 2 실측) | (동일) | (Phase 2 실측) |
| RPS (§5.3 잠정) | 3 | 5 | 3 (Phase 2 실측) | 3 (Phase 2 실측) | 3 (Phase 2 실측) |
| IP 화이트리스트 | 불필요 | 불필요 | 불필요 | 불필요 | **필요** → AWS Lightsail Gateway 고정 IP 등록으로 해소 |

### 9.2 카테고리 트리

| 항목 | naver | coupang | gmarket | auction | 11st |
|---|---|---|---|---|---|
| 최대 깊이 | 4 (잠정) | 5 (잠정) | 4 (잠정) | 4 (잠정) | 4 (잠정) |
| 조회 방식 | 전체 트리 1회 | 분할 페이징 (Phase 2 확인) | 전체 트리 1회 | 동일 | (Phase 2 실측) |
| 캐시 정책 | 24h TTL (호출측 책임) | 24h TTL | 24h TTL | 24h TTL | 24h TTL |
| 변경 통지 | webhook 없음 → polling | 동일 | 동일 | 동일 | 동일 |

### 9.3 이미지 규격 (Phase 2 실측 보정 예정)

| 항목 | naver | coupang | gmarket | auction | 11st |
|---|---|---|---|---|---|
| 권장 해상도 | 1000×1000 이상 | 1000×1000 이상 | 600×600 이상 | 동일 | 600×600 이상 (잠정) |
| 허용 포맷 | JPEG / PNG | JPEG / PNG / WebP | JPEG / PNG | 동일 | JPEG / PNG (잠정) |
| 최대 용량 | 10 MB | 5 MB | 5 MB | 동일 | 5 MB (잠정) |
| 최대 장수 | 10 | 10 | 10 | 10 | 10 (잠정) |

> 이미지 변환 파이프라인은 본 문서 범위 밖. `cross-cutting/image-pipeline.md` 참조.

### 9.4 필수 필드 / quirks

| 항목 | naver | coupang | gmarket / auction |
|---|---|---|---|
| 필수 필드 | 카테고리 / 상품명 / 가격 / 재고 / 배송 / 이미지 / 인증정보(품목별) | 카테고리 / 상품명 / 가격 / 재고 / 배송 / 이미지 / 벤더 인증 | 카테고리 / 상품명 / 가격 / 재고 / 배송 / 이미지 / 셀러 인증 |
| 알려진 quirk | 상품명 한도 100자, 특수문자 일부 거부 | 옵션 조합 등록 / 카테고리별 필수 인증서 | ESM 통합 (G+A 동시 등록 가능, site 파라미터로 분기) |
| 부분 성공 가능성 | 적음 | 옵션 단위 일부 실패 가능 | 적음 |

### 9.5 mock 시나리오 매핑 (debug)

| 시나리오 | naver (oauth) | coupang (hmac) | gmarket / auction (esm_jwt) |
|---|---|---|---|
| happy | StoredCredential(kind=oauth) | StoredCredential(kind=hmac) | StoredCredential(kind=esm_jwt) |
| 5xx | `server` throw | 동일 | 동일 |
| 401 | `unauthorized` throw (`invalid_grant`) | `unauthorized` (HMAC 서명 거부) | `unauthorized` (JWT 검증 실패) |
| 429 | `rate_limit` (retryAfterMs=1500) | 동일 | 동일 |
| timeout | `network` throw after 15s | 동일 | 동일 |
| partial | createProduct status='partial' + warnings | 동일 (옵션 일부 실패 시뮬레이션) | 동일 |

### 9.6 확장 정책 (v1 이후)

- **v1 부터 4-way union 강제**: `AuthInput` 은 oauth_code / hmac_key / esm_jwt / api_key 4 변형이 v1 인터페이스에 들어가 있다. 11번가 (`api_key`) real 어댑터는 v1 정식 구현 완료 — 인터페이스 시그니처 변경 없이 본문만 채웠고, IP 화이트리스트는 Lightsail Gateway 고정 IP 로 해소.
- **신규 인증 방식 추가 시** (예: 향후 OAuth2 Client Credentials 마켓 추가):
  1. `AuthInput` 에 `kind` 분기 추가 (`apps/web/src/lib/schemas/market.ts`)
  2. `MarketCredentialKind` enum 에 1값 추가
  3. 어댑터 1파일 (`apps/web/src/lib/markets/real/<id>/adapter.ts`)
  4. 단위 테스트 1파일
- **호환 보존**: 본 절차로 기존 어댑터 4개 코드 0줄 수정. 인터페이스 5메서드 시그니처 그대로.

### 9.7 v2 Extension — fetchOrders + submitTracking (2026-05-21 도입)

v2 배송 흐름 (PRD.md §6.1 / §6.4) 도입에 따라 `MarketAdapter` 인터페이스가 5 → 7 메서드로 확장된다. 인터페이스 시그니처는 다음 두 메서드 추가:

```ts
// 마켓 주문 목록 조회 (PRD §6.1)
fetchOrders(
  input: FetchOrdersInput,
  credential?: StoredCredential,
): Promise<MarketOrder[]>

// 송장 번호 제출 (PRD §6.4)
submitTracking(
  input: SubmitTrackingInput,
  credential?: StoredCredential,
): Promise<MarketSubmitTrackingResult>
```

**Why now:**
- v1 5 메서드는 "등록" 흐름만 다룬다 (auth/category/transform/create). v2 배송 흐름은 **등록된 상품의 주문 처리** 라는 별도 도메인이 추가되며, 마켓별 API 매트릭스가 4 마켓 모두 다른 엔드포인트·페이로드·status 매핑을 요구.
- 횡단 관심사(주문 캐시·셀러 권한·재시도) 는 `orders-sync` / `shipping-dispatch-job` Edge Function 이 담당. 어댑터는 **마켓 API 호출 + 응답 정규화** 만 책임.

**4 마켓 매트릭스 (간략):**

| 항목 | naver | coupang | gmarket (ESM site=G) | auction (ESM site=A) |
|---|---|---|---|---|
| fetchOrders 엔드포인트 | GET `/external/v1/pay-order/seller/orders/new-pay-waiting` | GET `/v2/.../ordersheets?status=ACCEPT` | GET `/order?site=G` | GET `/order?site=A` |
| submitTracking 엔드포인트 | PATCH `/external/v1/orders/{orderId}/dispatch` | PUT `/v2/.../orders/{shipmentBoxId}/ordersheets/shipments` | POST `/shipment` (site=G) | POST `/shipment` (site=A) |
| 인증 | OAuth Bearer | HMAC | ESM JWT | ESM JWT |
| 정상 거부 응답 | 400/422 → `ok=false` | 400/422 → `ok=false` | 200 + resultCode≠SUCCESS / 400 | 동일 |
| 횡단 실패 | 401/429/5xx → `MarketError` throw | 동일 | 동일 | 동일 |

**`submitTracking` 의 반환 정책 (throw 가 아닌 discriminated union):**

부분 실패가 정상 흐름의 일부 (`shipping-dispatch-job` 의 다중 주문 처리에서 한 건의 마켓 정상 거부가 다른 주문 진행을 멈추지 않도록). RegistrationJob 의 `partial` 상태 패턴(§3 registration-job-state.md) 과 동일한 설계.

- `{ ok: true, dispatchId?: string }` — 발송 처리 성공.
- `{ ok: false, errorCode: string, errorMessage: string }` — 마켓 정상 거부 (이미 발송 / 송장 형식 오류 / 검증 실패 등).
- `MarketError` throw — 네트워크 / 인증 / 5xx / rate_limit 같은 횡단 실패.

**파일 배치:**
- `apps/web/src/lib/markets/real/{naver,coupang}/orders.ts` — 마켓별 fetchOrders + submitTracking 구현.
- `apps/web/src/lib/markets/real/{naver,coupang}/tracking.ts` — submitTracking re-export thin wrapper (호출측 import 경로 일관성).
- `apps/web/src/lib/markets/real/esm/orders.ts` — G·A 공용 ESM 로직 단일 소스.
- `apps/web/src/lib/markets/real/{gmarket,auction}/{orders,tracking}.ts` — `esm/orders.ts` 를 site='G' / 'A' 로 호출하는 thin wrapper.
- `apps/web/src/lib/markets/debug/{naver,coupang,gmarket,auction}-{orders,tracking}.ts` — debug 어댑터 진입 점 (마켓별 mock 인스턴스 함수 export).
- `apps/web/src/lib/schemas/market-orders.ts` — `FetchOrdersInput` / `MarketOrder` / `SubmitTrackingInput` / `MarketSubmitTrackingResult` zod 단일 소스.

**테스트 (R-006 회귀 강제):**
- `apps/web/src/lib/markets/__tests__/parity.spec.ts` — mock ↔ real 시그니처 동일성 회귀.
- 마켓별 `*-orders.test.ts` 4개 — fetch mock + happy / 5xx / 401 / 429 / validation / 정상 거부 시나리오.

**호환 정책:**
- v1 코드 (registration-run / market-connect / OAuth callback) 는 본 확장의 영향 없음. 어댑터 인스턴스에 메서드 2개가 추가되었을 뿐 v1 호출 경로 변경 X.
- `getMarketAdapter()` 진입은 그대로. 신규 호출자 (`orders-sync` / `shipping-dispatch-job`) 는 동일 진입을 사용한다.

### 9.8 getRegistrationFields — 마켓별 동적 등록필드 (2026-05-30, PR-3.5 도입)

ESM(G마켓·옥션) 재구현(`features/esm.md` §4.6 / §5 / §6)에서 상품등록 3단계가 마켓별 추가 입력(배송 프로필 선택, 이후 PR-5 의 officialNotice)을 요구하게 됨에 따라, 컴포넌트 내 `if (marketId === ...)` 하드코딩 분기를 막기 위해 어댑터가 등록필드 메타를 선언하는 **optional 메서드**를 추가한다.

```ts
getRegistrationFields?(): RegistrationFieldMeta[];
```

- **반환 타입**: `RegistrationFieldMeta`(zod 단일 소스 `apps/web/src/lib/schemas/esm.ts` §4.6 / Edge 미러 `_shared/schemas.ts`).
  필드: `key` / `label`(i18n key) / `kind`(`select`|`text`|`number`|`officialNotice`|`shippingProfile`) / `required` / `optionsSource?`(`shippingProfiles`|`static`) / `helpText?` / `blockingReason?`(미입력 시 3단계 다음 버튼 tooltip).
- **하위호환 (핵심)**: optional 메서드 + "기본 동작 = `[]`". naver/coupang/11st 어댑터는 **메서드 자체를 생략** → 코드 0줄 수정. 호출측은 `getRegistrationFields(adapter)` 헬퍼(없으면 `[]`)로 접근한다.
- **순수 동기 함수** — 외부 호출 / Date.now / Math.random 금지(렌더 시점 동기 호출). 옵션 데이터(배송 프로필 목록)는 어댑터가 아니라 UI 가 `useEsmShippingProfiles` 로 채운다(`optionsSource` 가 출처만 지정).
- **ESM 선언**: gmarket/auction 은 공용 어댑터(`esm-shared.ts` / Web `shared-adapter.ts`)에서 `[{ key:'shippingProfileId', kind:'shippingProfile', required:true, optionsSource:'shippingProfiles', blockingReason:'…배송 프로필 선택 필요' }]` 1개 반환(thin wrapper 라 양 사이트 자동 동일). officialNotice 필드는 PR-5.
- **단일 소스**: 필드 빌더는 Web `apps/web/src/lib/markets/real/esm/registration-fields.ts` / Edge `_shared/market-adapters/esm-registration-fields.ts` 두 미러에 동일 구조(`getEsmRegistrationFields()`). mock 어댑터(Web `createMockAdapter` / Edge `debug.ts`)도 ESM 마켓에 한해 동일 빌더를 재사용해 parity 를 보장한다.
- **개정 분류**: 5메서드 핵심 인터페이스가 아니라 v2 Extension 계열의 **optional 메서드 추가**(fetchOrders/submitTracking 과 동일 패턴) — 기존 어댑터 무영향. backend + architect 합의(PR-3.5), security 검수 대상은 아님(외부 호출·자격증명 무관, i18n key 만 노출).

**테스트 (R-006 회귀 강제):**
- ESM(gmarket/auction) 어댑터: `getRegistrationFields()` 가 `shippingProfile` 필드 1개(required, optionsSource='shippingProfiles') 반환.
- 타 마켓(naver/coupang/11st): `getRegistrationFields` 미정의 → 헬퍼 통해 `[]`(하위호환 회귀).

---

## 10. 신규 마켓 추가 절차

1. **인터페이스 구현 파일 1개**: `apps/web/src/lib/markets/<id>/adapter.ts` — `MarketAdapter` 5메서드.
2. **마켓별 zod**: `apps/web/src/lib/markets/<id>/schema.ts` — 마켓 API 요청/응답 검증 스키마.
3. **단위 테스트**: `apps/web/src/lib/markets/<id>/__tests__/adapter.test.ts` — §11 테스트 매트릭스 8개 케이스 모두 통과.
4. **mock 어댑터 확장**: `apps/web/src/lib/markets/mock/adapter.ts` 에 신규 마켓 시나리오 추가 (`§4.2`).
5. **`features/markets.md` 갱신**: 마켓 OAuth 설정 / 카테고리 캐시 / 이미지 규격 / 필수 필드 표 갱신.
6. **`__shared/limiter.ts` 갱신**: 동시 호출 한도.
7. **`getAdapter` 의 switch 에 추가**: `apps/web/src/lib/markets/index.ts`.
8. **CI 통과**: `pnpm test` + `pnpm grep:secrets` + `pnpm grep:mock-leak`.
9. **security 검수**: OAuth state / redirect_uri / 토큰 저장 / 로깅 마스킹 — `security.md` §14 체크리스트.

> **금지**: 위 1~9 외에 어댑터 본체에 fetch wrapper / Sentry / 큐 로직을 두는 PR. 차단.

---

## 11. 테스트 매트릭스 (메서드별 통과 의무)

`testing.md` §3 §4 양식과 정합. 모든 어댑터 (mock + naver + coupang) 가 아래 8개 케이스를 통과해야 한다.

| # | 대상 메서드 | 시나리오 | 입력 | 기대 | 자동화 |
|---|---|---|---|---|---|
| T-A1 | `authenticate` | happy | 유효 code | `TokenSetSchema.parse` 통과 / accessToken / refreshToken / expiresAt 존재 | Vitest |
| T-A2 | `authenticate` | invalid code | 잘못된 code | `MarketError('unauthorized')` throw | Vitest + MSW |
| T-A3 | `authenticate` | 마켓 5xx | MSW 가 500 응답 | `MarketError('server')` throw | Vitest + MSW |
| T-R1 | `refreshToken` | happy | 유효 refresh | TokenSet 갱신 / rotation 적용 | Vitest |
| T-R2 | `refreshToken` | revoked | invalid_grant | `MarketError('unauthorized')` throw, 재시도 안 함 (오케스트레이터 책임) | Vitest |
| T-C1 | `fetchCategoryTree` | happy | - | 모든 노드 `CategoryNodeSchema.parse` 통과 / depth ≥ 1 / leaf 1개 이상 | Vitest |
| T-C2 | `fetchCategoryTree` | rate_limit | MSW 429 + Retry-After | `MarketError('rate_limit', { retryAfterMs })` throw | Vitest + MSW |
| T-T1 | `transformProduct` | 결정성 | (product, mapping) | `f(x) === f(x)` (deep equal) | Vitest |
| T-T2 | `transformProduct` | 필수 필드 누락 | mapping.categoryId 빈 문자열 | `MarketError('validation')` throw 또는 호출측 zod 실패 | Vitest |
| T-P1 | `createProduct` | happy | 유효 payload | `CreateProductResultSchema.parse` 통과 / status='succeeded' | Vitest + MSW |
| T-P2 | `createProduct` | 부분 성공 | payload | status='partial' + warnings ≥ 1 | Vitest + MSW |
| T-P3 | `createProduct` | 429 + retry 후 성공 | MSW 가 429 → 200 | wrapper(`withRetry`)로 wrap 시 최종 성공 | Vitest + MSW + `withRetry` |
| T-P4 | `createProduct` | 5회 모두 5xx | MSW 가 5회 500 | `MarketError('server')` 최종 throw, attempt=5 로깅 | Vitest + MSW + `withRetry` |

### 11.1 골든 패스 통합 (E2E)

- `testing.md` §3 골든 패스에 본 어댑터 매트릭스가 포함됨.
- Playwright 시나리오: 로그인 → 마켓 연결 (mock OAuth) → 상품 등록 위저드 6단계 → 등록 결과 (naver=succeeded, coupang=partial) → 이력 확인.

### 11.2 RLS 통과 검증

- 어댑터 단위 테스트 범위 외이지만, `market_credentials` 테이블에 대해 다른 셀러 row 조회 0건이어야 함 (`security.md` §3.4). `features/markets.md` 의 RLS 테스트로 별도 커버.

---

## 12. 외부 의존 (Deno / Edge Function)

- **HTTP 클라이언트**: `globalThis.fetch` 1차. 별도 라이브러리 (axios / ky) 도입 금지 — Edge Function 번들 크기 / Deno 호환성 이슈.
- **zod**: Edge Function 도 동일 버전 사용. 프론트와 단일 소스 (`apps/web/src/lib/schemas/market.ts`) 를 Edge Function 에서도 import (relative path 또는 import map).
- **로거**: pino (Deno-compatible build) 또는 자체 구조화 logger. `console.*` 직접 사용 금지.

---

## 13. 미해결 사안 (Phase 2 에서 결정)

| # | 사안 | 영향 | 결정 시점 |
|---|---|---|---|
| O-1 | 네이버 스마트스토어 실제 scope 명 / refresh TTL 실측 | §9.1 표 갱신 | Phase 2 통합 시작 |
| O-2 | 쿠팡 HMAC 서명 알고리즘 헤더 상수 / 시계 동기 윈도우 | §9.1 / 어댑터 구현 | Phase 2 |
| O-3 | 마켓별 실측 RPS / 일일 한도 | §5.3 `limiter.ts` | Phase 2 부하 테스트 |
| O-4 | 429 응답 헤더 포맷 (`Retry-After` vs 마켓 자체) | §7.2 `retryAfterMs` 환산 | Phase 2 |
| O-5 | 이미지 변환 파이프라인 멱등 키 설계 (S3 키 / Storage path) | `features/registration.md` 이미지 섹션 | Phase 2 |
| O-6 | Edge Function timeout 한도 확정 → 마켓당 호출 분할 단위 | §5.4 / `features/registration.md` 잡 분할 | **결정 완료** (OQ-15, Pro 400s 가정) |
| O-7 | Vault vs pgcrypto envelope 최종 결정 | `security.md` §4.2 | **결정 완료** (OQ-04, pgcrypto) |
| O-8 | 부분 성공(partial) 정의 — 마켓별 적용 범위 | §7.1 `CreateProductResult.status` | Phase 2 |
| O-9 | 11번가 IP 화이트리스트 정책 해결책 | §9.0 / `features/markets.md` §3.2 / 11st 어댑터 활성화 | **결정 완료** (2026-05-22, v1.3) — AWS Lightsail Market Gateway 고정 IP 등록. `market-gateway.md` 참조 |
| O-10 | ESM 2.0 JWT 의 `iat` 클럭 스큐 허용치 / 어댑터 내부 재생성 정책 | §9.1 gmarket / auction 어댑터 | Phase 2 |

---

## 14. 본 문서 인용 가이드

- `docs/architecture/v1/features/markets.md` → §2 인터페이스 / §8 OAuth / §9 마켓별 차이.
- `docs/architecture/v1/features/registration.md` → §2 인터페이스 / §5 재시도·rate limit / §6 로깅 / §7 에러 매핑.
- `docs/architecture/v1/cross-cutting/credential-vault.md` → §8 OAuth 시퀀스 (토큰 저장 직전 단계).
- `docs/architecture/v1/cross-cutting/observability.md` → §6 로깅 규약.
- `docs/architecture/v1/testing.md` → §11 테스트 매트릭스 (본 문서가 어댑터별 8 케이스 제공).

본 문서 규칙과 `security.md` 가 충돌하면 `security.md` 우선. 본 문서 규칙과 `platform.md` 가 충돌하면 architect 합의 PR 로 양쪽 동시 갱신.

---

## 15. 개정 이력

| 일자 | 버전 | 변경 | 작성 |
|---|---|---|---|
| 2026-05-18 | v1.0 | 최초 작성. MarketAdapter 5메서드 / 공용 zod / mock-real 동등성 / 재시도·rate-limit 외부 위임 / 에러 매핑 / OAuth 시퀀스 / 마켓별 차이 매트릭스 / 테스트 매트릭스 정의. | backend |
| 2026-05-19 | v1.1 | **5마켓 MVP 확장 Wave 1**. `authenticate(input)` 의 input 을 4-way `AuthInput` discriminated union 으로 확장 (oauth_code / hmac_key / esm_jwt / api_key). `refreshToken` optional 명시. 반환 타입 `TokenSet` → `StoredCredential`. v1 정식 = 네이버 / 쿠팡 / G마켓 / 옥션 4개 활성, 11번가 = v2 (IP 화이트리스트). §9 마켓별 차이 매트릭스 5마켓 표로 확장. | backend + architect |
| 2026-05-22 | v1.3 | **11번가 v1 정식 진입**. AWS Lightsail Market Gateway (서울 리전, 고정 IP) 도입 결정으로 IP 화이트리스트 정책 해소 (`market-gateway.md`). v1 정식 = 5 마켓 전부. 모든 마켓 호출이 `_shared/gatewayFetch()` 경유. §9 매트릭스 11번가 컬럼 v1 정식화. O-9 미해결 사안 종결. | architect |
