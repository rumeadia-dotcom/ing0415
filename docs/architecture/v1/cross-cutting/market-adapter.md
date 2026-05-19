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

- **목적**: 마켓 API 의 변덕(엔드포인트·페이로드·rate limit·OAuth)을 5메서드 인터페이스 1장 뒤에 격리한다.
- **범위**: **v1 = 네이버 스마트스토어 1개만 실 구현 (2026-05-19 결정 — OQ-10)**. 쿠팡 / 11번가 / G마켓 / 옥션 = 인터페이스 stub + 단위 테스트만 유지, 호출 시 즉시 throw (v2 구현 보류). 쿠팡은 OpenAPI 가 HMAC 기반이므로 현 5메서드 OAuth 가정 인터페이스와 부정합 — v2 어댑터 인터페이스 확장 후 통합.
- **비범위**: 재시도·rate limit·이미지 변환·로깅·감사 — 어댑터 **바깥**(`registration-run` Edge Function 오케스트레이터 + `_shared/*`).

---

## 2. MarketAdapter 인터페이스 (5메서드, 강제)

신규 마켓 추가 = **이 인터페이스를 구현하는 1파일** (`src/lib/markets/<id>/adapter.ts`) + 단위 테스트.
6번째 메서드 추가는 본 문서 개정 절차로만 가능. 어댑터 내부에 fetch retry / 이미지 변환 / 큐 / Sentry 직접 호출 코드를 두는 PR 은 **차단**.

### 2.1 TypeScript 시그니처

```ts
// src/lib/markets/types.ts
import { z } from 'zod';
import type {
  TokenSet,
  CategoryNode,
  MarketPayload,
  CreateProductResult,
  MarketId,
  Product,
  MarketMapping,
} from '@/lib/schemas/market';

export interface MarketAdapter {
  /** 마켓 ID. 어댑터 인스턴스가 어느 마켓을 다루는지 명시. */
  readonly market: MarketId;

  /**
   * OAuth authorization_code → token 교환.
   * 입력: 마켓 콜백으로 전달된 인증 코드 (10분 내 1회 사용 가능).
   * 출력: TokenSet (access / refresh / expiresAt / scope).
   * 에러: MarketError('unauthorized' | 'validation' | 'network' | 'server' | 'unknown').
   */
  authenticate(code: string): Promise<TokenSet>;

  /**
   * refresh_token → token 갱신. 갱신된 refresh 가 회전(rotation) 발급되면 그대로 반환.
   * 에러: 'unauthorized' (invalid_grant / revoked) → 호출측에서 disconnected 처리.
   */
  refreshToken(refresh: string): Promise<TokenSet>;

  /**
   * 마켓 카테고리 트리. 캐시 정책·만료는 호출측(features/markets.md §카테고리 캐시) 담당.
   * 어댑터는 단순히 마켓 API 호출 + zod 검증 + 트리 정규화.
   */
  fetchCategoryTree(): Promise<CategoryNode[]>;

  /**
   * 도메인 Product + 마켓별 MarketMapping → 마켓 페이로드.
   * 순수 함수. 외부 호출 / I/O 금지. 이미지 변환 결과 URL 은 mapping 에 이미 들어있다고 가정.
   */
  transformProduct(product: Product, mapping: MarketMapping): MarketPayload;

  /**
   * 마켓에 상품 생성 요청. 결과는 externalId + productUrl + status.
   * 부분 성공이 마켓 측에서 있을 수 있으면 status='partial' + warnings 채움.
   */
  createProduct(payload: MarketPayload): Promise<CreateProductResult>;
}
```

### 2.2 입력 / 출력 zod 스키마 (`src/lib/schemas/market.ts`)

본 스키마는 BE/FE 공유 단일 소스. 마켓 API 응답은 어댑터 내부에서 본 스키마로 `parse` (예외 → `MarketError('validation')`).

```ts
// src/lib/schemas/market.ts
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

// ---------- TokenSet ----------
export const TokenSetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  // ISO 8601. 마켓 응답 expires_in(초)은 어댑터에서 절대시각으로 환산.
  expiresAt: z.string().datetime({ offset: true }),
  scope: z.string().optional(),
  tokenType: z.literal('Bearer').default('Bearer'),
});
export type TokenSet = z.infer<typeof TokenSetSchema>;

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
| `MarketId` | `src/lib/schemas/market.ts` | 모든 곳 |
| `TokenSet` | `src/lib/schemas/market.ts` | adapter, `features/markets` |
| `CategoryNode` | `src/lib/schemas/market.ts` | adapter, `features/registration` |
| `Product` | `src/lib/schemas/market.ts` | adapter, `features/registration` |
| `MarketMapping` | `src/lib/schemas/market.ts` | adapter, `features/registration` |
| `MarketPayload` | `src/lib/schemas/market.ts` | adapter |
| `CreateProductResult` | `src/lib/schemas/market.ts` | adapter, `features/registration` |
| `MarketAdapter` | `src/lib/markets/types.ts` | adapter, orchestrator |
| `MarketError` | `src/lib/markets/errors.ts` | adapter, orchestrator |

---

## 4. debug / real 어댑터 동등성

### 4.1 모드 분기 (단 1지점)

```ts
// src/lib/markets/index.ts
import { mode } from '@/lib/mode';
import type { MarketAdapter } from './types';
import type { MarketId } from '@/lib/schemas/market';

export async function getAdapter(market: MarketId): Promise<MarketAdapter> {
  if (mode === 'debug') {
    const { createMockAdapter } = await import('./mock/adapter');
    return createMockAdapter(market);
  }
  switch (market) {
    case 'naver': {
      const { createNaverAdapter } = await import('./naver/adapter');
      return createNaverAdapter();
    }
    case 'coupang':
    case '11st':
    case 'gmarket':
    case 'auction':
      // v1 = naver 1개만 활성. 나머지는 인터페이스 호환을 위해 stub 만 유지 (호출 시 즉시 throw).
      // 쿠팡 HMAC 부정합으로 v2 인터페이스 확장 시 통합 — 2026-05-19 결정 (OQ-10).
      throw new Error(`Adapter ${market} is not in v1 (오픈 준비중) — see CLAUDE.md MVP 범위`);
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
// src/lib/markets/mock/adapter.ts (요지)
import type { MarketAdapter } from '../types';
import {
  TokenSetSchema,
  CategoryNodeSchema,
  CreateProductResultSchema,
  type MarketId,
  type TokenSet,
  type CategoryNode,
  type MarketPayload,
  type CreateProductResult,
  type Product,
  type MarketMapping,
} from '@/lib/schemas/market';
import { MarketError } from '../errors';

type Scenario = 'happy' | '5xx' | '401' | '429' | 'timeout' | 'partial';

const SCENARIO: Scenario =
  (globalThis as { __MOCK_SCENARIO__?: Scenario }).__MOCK_SCENARIO__ ?? 'happy';

export function createMockAdapter(market: MarketId): MarketAdapter {
  return {
    market,
    async authenticate(_code: string): Promise<TokenSet> {
      if (SCENARIO === '5xx') throw new MarketError('server', 'mock 5xx', { market });
      if (SCENARIO === '401') throw new MarketError('unauthorized', 'mock 401', { market });
      if (SCENARIO === '429') throw new MarketError('rate_limit', 'mock 429', { market, retryAfterMs: 1500 });
      if (SCENARIO === 'timeout') {
        await new Promise((r) => setTimeout(r, 60_000));
        throw new MarketError('network', 'mock timeout', { market });
      }
      // happy / partial 은 동일 토큰 셋
      return TokenSetSchema.parse({
        accessToken: 'mock_access_' + 'x'.repeat(40),
        refreshToken: 'mock_refresh_' + 'x'.repeat(40),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        scope: 'product.write',
        tokenType: 'Bearer',
      });
    },
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
// src/lib/markets/__tests__/adapter-contract.test.ts
import { describe, it, expect } from 'vitest';
import { createMockAdapter } from '@/lib/markets/mock/adapter';
import {
  TokenSetSchema,
  CategoryNodeSchema,
  CreateProductResultSchema,
  ProductSchema,
  MarketMappingSchema,
} from '@/lib/schemas/market';

describe('MarketAdapter contract — mock(naver) happy path', () => {
  const adapter = createMockAdapter('naver');

  it('authenticate → TokenSetSchema 통과', async () => {
    const token = await adapter.authenticate('dummy_code');
    expect(() => TokenSetSchema.parse(token)).not.toThrow();
    expect(token.accessToken.length).toBeGreaterThan(10);
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

- 오케스트레이터: `supabase/functions/registration-run/index.ts`.
- 어댑터 호출 wrap: `supabase/functions/_shared/with-retry.ts`.
- 동시 호출 한도: `supabase/functions/_shared/limiter.ts` (마켓별 token bucket).

### 5.2 재시도 정책 (지수 백오프 + jitter)

```ts
// supabase/functions/_shared/with-retry.ts
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
| 11st / gmarket / auction | - | - | v2 |

```ts
// supabase/functions/_shared/limiter.ts
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
// supabase/functions/_shared/logger.ts (Edge)
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
// src/lib/markets/errors.ts
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

## 8. OAuth 흐름 (provider 별)

### 8.1 시퀀스 (ASCII)

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

## 9. 마켓별 차이 매트릭스 (v1: 네이버 스마트스토어만)

> v1 활성 = naver 1개. 쿠팡 / 11번가 / G마켓 / 옥션 = **v2 예정** (인터페이스 호환 stub).
> 잠정값은 Phase 2 통합 테스트 후 갱신. 갱신 시 본 문서 §13 미해결 사안 행 제거.

### 9.1 호출 / OAuth

| 항목 | 네이버 스마트스토어 (naver) — v1 활성 | 쿠팡 / 11st / gmarket / auction |
|---|---|---|
| OAuth 표준 | OAuth 2.0 Authorization Code (`type=SELF`) | **v2 예정** — 쿠팡은 HMAC, 그 외는 Phase 2 확인 |
| 토큰 endpoint | `https://api.commerce.naver.com/external/v1/oauth2/token` (확정, form-urlencoded) | v2 |
| `scope` | 상품 등록·조회 권한 (실제 키 이름 Phase 2 확인) | v2 |
| refresh TTL | 잠정 14일 | v2 |
| HTTP timeout (어댑터 fetch) | 15s | v2 |
| 일일 호출 한도 | Phase 2 실측 | v2 |
| RPS (동시 호출 한도, §5.3) | 3 | v2 |
| 429 헤더 | `Retry-After` (초) | v2 |

### 9.2 카테고리 트리

| 항목 | 네이버 스마트스토어 |
|---|---|
| 최대 깊이 | 4 (잠정) |
| 조회 방식 | 전체 트리 1회 조회 |
| 캐시 정책 | 24시간 TTL (호출측 책임) |
| 변경 통지 | webhook 없음 → polling |

> 쿠팡 / 11st / gmarket / auction 의 카테고리 트리 사양은 v2 인터페이스 확정 후 본 표에 행 추가.

### 9.3 이미지 규격

| 항목 | 네이버 스마트스토어 |
|---|---|
| 권장 해상도 | 1000 × 1000 이상 |
| 허용 포맷 | JPEG / PNG |
| 최대 용량 | 10 MB |
| 최대 장수 | 10 |
| 워터마크 정책 | 금지 (마켓 정책) |

> 이미지 변환 파이프라인은 본 문서 범위 밖. `features/registration.md` §이미지 파이프라인 참조.
> 쿠팡 등 v2 마켓별 이미지 규격은 v2 진입 직전 추가.

### 9.4 필수 필드 / quirks

| 항목 | 네이버 스마트스토어 |
|---|---|
| 필수 필드 | 카테고리 / 상품명 / 가격 / 재고 / 배송 / 이미지 / 인증정보(품목별) |
| 알려진 quirk | 상품명 한도 100자 (잠정), 특수문자 일부 거부 |
| 부분 성공 가능성 | 적음 |

### 9.5 mock 시나리오 매핑 (debug)

| 시나리오 | naver mock |
|---|---|
| happy | 성공 응답 |
| 5xx | `server` throw |
| 401 | `unauthorized` throw (`invalid_grant`) |
| 429 | `rate_limit` (retryAfterMs=1500) |
| timeout | `network` throw after 15s |
| partial | createProduct status='partial' + warnings (v2 다중 마켓 시뮬레이션용 케이스 — v1 단일 마켓에서는 의미 제한적) |

### 9.6 확장 정책 (v2 인터페이스 확장)

- **`authenticate` input 확장 필요**: 현재 `code: string` 으로 OAuth code 만 받음. **v2 어댑터 인터페이스 확장 — `authenticate` 의 input 을 `{kind:'oauth_code'|'hmac_key', ...}` union 으로 확대 필요 (쿠팡 HMAC 대응)**.
- 호환 보존: v1 stub 어댑터 (coupang / 11st / gmarket / auction) 는 5메서드 시그니처를 유지하되 호출 시 즉시 `MarketError('unknown')` throw. 인터페이스 확장 시 stub 의 시그니처도 union 으로 확대 적용.
- v2 진입 시점: 본 §확장 정책 → §9 표로 통합 + `MarketAdapter` 인터페이스 PR (architect + security 합의) + 마켓별 어댑터 본문 구현.

---

## 10. 신규 마켓 추가 절차

1. **인터페이스 구현 파일 1개**: `src/lib/markets/<id>/adapter.ts` — `MarketAdapter` 5메서드.
2. **마켓별 zod**: `src/lib/markets/<id>/schema.ts` — 마켓 API 요청/응답 검증 스키마.
3. **단위 테스트**: `src/lib/markets/<id>/__tests__/adapter.test.ts` — §11 테스트 매트릭스 8개 케이스 모두 통과.
4. **mock 어댑터 확장**: `src/lib/markets/mock/adapter.ts` 에 신규 마켓 시나리오 추가 (`§4.2`).
5. **`features/markets.md` 갱신**: 마켓 OAuth 설정 / 카테고리 캐시 / 이미지 규격 / 필수 필드 표 갱신.
6. **`__shared/limiter.ts` 갱신**: 동시 호출 한도.
7. **`getAdapter` 의 switch 에 추가**: `src/lib/markets/index.ts`.
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
- **zod**: Edge Function 도 동일 버전 사용. 프론트와 단일 소스 (`src/lib/schemas/market.ts`) 를 Edge Function 에서도 import (relative path 또는 import map).
- **로거**: pino (Deno-compatible build) 또는 자체 구조화 logger. `console.*` 직접 사용 금지.

---

## 13. 미해결 사안 (Phase 2 에서 결정)

| # | 사안 | 영향 | 결정 시점 |
|---|---|---|---|
| O-1 | 네이버 스마트스토어 실제 OAuth endpoint / scope 명 / refresh TTL | §8 / §9.1 갱신 | Phase 2 통합 시작 |
| O-2 | 쿠팡 OAuth 표준 준수 여부 (벤더 비표준 절차 가능성) | §8 어댑터 구현 분기 | Phase 2 |
| O-3 | 마켓별 실측 RPS / 일일 한도 | §5.3 `limiter.ts` | Phase 2 부하 테스트 |
| O-4 | 429 응답 헤더 포맷 (`Retry-After` vs 마켓 자체) | §7.2 `retryAfterMs` 환산 | Phase 2 |
| O-5 | 이미지 변환 파이프라인 멱등 키 설계 (S3 키 / Storage path) | `features/registration.md` 이미지 섹션 | Phase 2 |
| O-6 | Edge Function timeout 한도 확정 → 마켓당 호출 분할 단위 | §5.4 / `features/registration.md` 잡 분할 | Phase 1 운영 한도 확인 후 |
| O-7 | Vault vs pgcrypto envelope 최종 결정 — 토큰 저장 형식이 어댑터 직접 영향 없음 (호출측 책임), 단 마이그레이션 시 본 문서 §8 시퀀스 갱신 가능 | `security.md` §4.2 | Phase 1 |
| O-8 | 부분 성공(partial) 정의 — 쿠팡 외 다른 마켓에서도 적용 가능한지 | §7.1 `CreateProductResult.status` | Phase 2 |

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
