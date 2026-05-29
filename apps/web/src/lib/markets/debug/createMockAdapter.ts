import {
  CategoryNodeSchema,
  CreateProductResultSchema,
  EsmGoodsCreateRequestSchema,
  EsmGoodsCreateResponseSchema,
  EsmSiteCatSchema,
  EsmTransformExtraSchema,
  MarketOrderSchema,
  MarketSubmitTrackingResultSchema,
  StoredCredentialSchema,
  TokenSetSchema,
  type AuthInput,
  type CategoryNode,
  type CreateProductResult,
  type FetchOrdersInput,
  type MarketCredentialKind,
  type MarketId,
  type MarketMapping,
  type MarketOrder,
  type MarketPayload,
  type MarketSubmitTrackingResult,
  type Product,
  type StoredCredential,
  type SubmitTrackingInput,
  type TokenSet,
} from '@/lib/schemas'
import { MarketError } from '../errors'
import type { MarketAdapter } from '../types'
import { getEsmRegistrationFields } from '../real/esm/registration-fields'

/**
 * Debug 모드 mock 어댑터.
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §4.2
 *
 * 본 모듈은 `if (useMock)` 가드 + dynamic import 안에서만 로드되어야 한다
 * (real 번들에 tree-shaking).
 *
 * 시나리오: `globalThis.__MOCK_SCENARIO__` 로 주입 (테스트·E2E 에서 사용).
 *   'happy' | '5xx' | '401' | '429' | 'timeout' | 'partial'
 *
 * v1 변경 (2026-05-19): authenticate(input) 의 4-way union 분기.
 *   - 네이버 (kind='oauth') → AuthInput.kind='oauth_code' 만 수용. StoredCredential.kind='oauth' 반환.
 *   - 쿠팡 (kind='hmac')   → AuthInput.kind='hmac_key'.  StoredCredential.kind='hmac'.
 *   - G마켓·옥션 (kind='esm_jwt') → AuthInput.kind='esm_jwt'. StoredCredential.kind='esm_jwt'.
 *   - 11번가 (kind='api_key') → AuthInput.kind='api_key' 수용. StoredCredential.kind='api_key' 반환 (다른 4마켓과 동등).
 *
 *   refreshToken 은 'oauth' 어댑터에만 정의.
 */

type Scenario = 'happy' | '5xx' | '401' | '429' | 'timeout' | 'partial'

function readScenario(): Scenario {
  const g = globalThis as { __MOCK_SCENARIO__?: Scenario }
  return g.__MOCK_SCENARIO__ ?? 'happy'
}

const MARKET_TO_KIND: Record<MarketId, MarketCredentialKind> = {
  naver: 'oauth',
  coupang: 'hmac',
  gmarket: 'esm_jwt',
  auction: 'esm_jwt',
  '11st': 'api_key',
}

function isEsmMarket(market: MarketId): boolean {
  return market === 'gmarket' || market === 'auction'
}

/**
 * ESM(G마켓·옥션) mock 카테고리 raw 응답 → EsmSiteCatSchema 통과 검증.
 * site-cats 의 raw 형태(siteCatCode/siteCatName/isLeaf)를 만들어 스키마 통과를 보장한 뒤
 * 공통 CategoryNode 트리로 정규화한다(PR-0 계약: mock raw 가 새 스키마 통과).
 */
function buildEsmMockCategoryTree(market: MarketId): CategoryNode[] {
  const siteType = market === 'gmarket' ? 2 : 1
  const rawSiteCat = EsmSiteCatSchema.parse({
    siteCatCode: '300004975',
    siteCatName: '패션의류',
    isLeaf: false,
    siteType,
    children: [
      {
        siteCatCode: '300004976',
        siteCatName: '여성의류',
        isLeaf: true,
        siteType,
      },
    ],
  })
  const childRaw = rawSiteCat.children?.[0]
  const node: CategoryNode = {
    id: rawSiteCat.siteCatCode,
    name: rawSiteCat.siteCatName,
    depth: 1,
    leaf: rawSiteCat.isLeaf,
    parentId: null,
    children: childRaw
      ? [
          {
            id: childRaw.siteCatCode,
            name: childRaw.siteCatName,
            depth: 2,
            leaf: childRaw.isLeaf,
            parentId: rawSiteCat.siteCatCode,
            children: [],
          },
        ]
      : [],
  }
  return [CategoryNodeSchema.parse(node)]
}

/**
 * ESM(G마켓·옥션) mock createProduct raw 응답 → EsmGoodsCreateResponseSchema 통과 검증.
 * siteDetail.{gmkt|iac}.SiteGoodsNo / goodsNo / resultCode 구조를 만들어 스키마 통과를 보장한 뒤
 * 호출 site 의 SiteGoodsNo 를 externalId 로 매핑(real 어댑터 동작과 동형).
 */
function buildEsmMockCreateResult(
  market: MarketId,
  status: 'succeeded' | 'partial',
): CreateProductResult {
  const isGmkt = market === 'gmarket'
  const siteGoodsNo = `${market.toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
  const raw = EsmGoodsCreateResponseSchema.parse({
    goodsNo: 1_000_000 + Math.floor(Math.random() * 1_000_000),
    siteDetail: isGmkt
      ? { gmkt: { SiteGoodsNo: siteGoodsNo, SiteGoodsComment: 'Success' } }
      : { iac: { SiteGoodsNo: siteGoodsNo, SiteGoodsComment: 'Success' } },
    resultCode: 0,
    message: null,
  })
  const externalId = isGmkt
    ? (raw.siteDetail?.gmkt?.SiteGoodsNo ?? siteGoodsNo)
    : (raw.siteDetail?.iac?.SiteGoodsNo ?? siteGoodsNo)
  const productUrl = isGmkt
    ? `https://item.gmarket.co.kr/Item?goodscode=${externalId}`
    : `https://itempage3.auction.co.kr/DetailView.aspx?itemno=${externalId}`
  return CreateProductResultSchema.parse({
    market,
    externalId,
    productUrl,
    status,
    warnings:
      status === 'partial'
        ? [
            {
              code: 'image_resized',
              message: '이미지 1장이 권장 해상도 미달로 자동 보정됨',
            },
          ]
        : [],
  })
}

/**
 * ESM(G마켓·옥션) mock transformProduct → 중첩 EsmGoodsCreateRequest 통과 검증.
 * real(buildEsmGoodsPayload)과 동형 구조. debug 모드엔 실제 배송 프로필 번호가
 * 없으므로, extra 에 placeNo/dispatchPolicyNo/officialNotice 가 없으면 mock 더미를
 * 채워 스키마 통과를 보장한다(real 은 오케스트레이터가 주입한 실번호 사용).
 */
function buildEsmMockGoodsPayload(
  market: MarketId,
  product: Product,
  mapping: MarketMapping,
): unknown {
  const site = market === 'gmarket' ? 'G' : 'A'
  const siteType = site === 'G' ? 2 : 1
  const extra = EsmTransformExtraSchema.parse(mapping.extra ?? {})

  const placeNo = extra.placeNo ?? 'MOCK-PLACE-001'
  const dispatchPolicyNo = extra.dispatchPolicyNo ?? 'MOCK-DISPATCH-001'
  const officialNotice = extra.officialNotice ?? {
    officialNoticeNo: 'MOCK-NOTICE-01',
    details: [{ code: 'material', value: '면 100%' }],
  }

  const urls = mapping.transformedImageUrls
  const images: Record<string, string> = { basicImgURL: urls[0] ?? '' }
  urls.slice(1, 15).forEach((url, idx) => {
    images[`addtionalImg${idx + 1}URL`] = url
  })

  const price = site === 'G' ? { Gmkt: product.priceKrw } : { Iac: product.priceKrw }
  const stock = site === 'G' ? { Gmkt: product.stock || 1 } : { Iac: product.stock || 1 }
  const sellingPeriod = site === 'G' ? { Gmkt: -1 } : { Iac: -1 }
  const dispatchPolicyNoObj =
    site === 'G' ? { gmkt: dispatchPolicyNo } : { iac: dispatchPolicyNo }

  return EsmGoodsCreateRequestSchema.parse({
    itemBasicInfo: {
      goodsName: { kor: product.name },
      category: { site: [{ siteType, catCode: mapping.categoryId }] },
    },
    itemAddtionalInfo: {
      price,
      stock,
      sellingPeriod,
      shipping: {
        type: 1,
        policy: { placeNo },
        dispatchPolicyNo: dispatchPolicyNoObj,
      },
      images,
      officialNotice,
      isVatFree: extra.isVatFree ?? false,
    },
  })
}

function buildHappyCredential(
  market: MarketId,
  kind: MarketCredentialKind,
  input: AuthInput,
): StoredCredential {
  switch (kind) {
    case 'oauth': {
      if (input.kind !== 'oauth_code') {
        throw new MarketError(
          'validation',
          `${market}: oauth_code input required (got ${input.kind})`,
          { market },
        )
      }
      const tokenSet = TokenSetSchema.parse({
        accessToken: 'mock_access_' + 'x'.repeat(40),
        refreshToken: 'mock_refresh_' + 'x'.repeat(40),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        scope: 'product.write',
        tokenType: 'Bearer',
      })
      return StoredCredentialSchema.parse({
        kind: 'oauth',
        payload: tokenSet,
        expiresAt: tokenSet.expiresAt,
      })
    }
    case 'hmac': {
      if (input.kind !== 'hmac_key') {
        throw new MarketError(
          'validation',
          `${market}: hmac_key input required (got ${input.kind})`,
          { market },
        )
      }
      return StoredCredentialSchema.parse({
        kind: 'hmac',
        payload: {
          accessKey: input.accessKey,
          secretKey: input.secretKey,
          vendorId: input.vendorId,
        },
      })
    }
    case 'esm_jwt': {
      if (input.kind !== 'esm_jwt') {
        throw new MarketError(
          'validation',
          `${market}: esm_jwt input required (got ${input.kind})`,
          { market },
        )
      }
      return StoredCredentialSchema.parse({
        kind: 'esm_jwt',
        payload: {
          masterId: input.masterId,
          secretKey: input.secretKey,
          sellerId: input.sellerId,
          site: input.site,
        },
      })
    }
    case 'api_key': {
      // 11번가 — 영구 키. AuthInput 의 api_key 입력에서 apiKey 만 추출 → StoredCredential.
      if (input.kind !== 'api_key') {
        throw new MarketError(
          'validation',
          `${market}: api_key input required (got ${input.kind})`,
          { market },
        )
      }
      return StoredCredentialSchema.parse({
        kind: 'api_key',
        payload: { apiKey: input.apiKey },
      })
    }
  }
}

export function createMockAdapter(market: MarketId): MarketAdapter {
  const credentialKind = MARKET_TO_KIND[market]

  const base: MarketAdapter = {
    market,
    credentialKind,

    async authenticate(input: AuthInput): Promise<StoredCredential> {
      const s = readScenario()
      if (s === '5xx')
        throw new MarketError('server', 'mock 5xx', { market })
      if (s === '401')
        throw new MarketError('unauthorized', 'mock 401', { market })
      if (s === '429')
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 1500,
        })
      if (s === 'timeout') {
        await new Promise((r) => setTimeout(r, 60_000))
        throw new MarketError('network', 'mock timeout', { market })
      }
      return buildHappyCredential(market, credentialKind, input)
    },

    async fetchCategoryTree(): Promise<CategoryNode[]> {
      // ESM(G마켓·옥션) 은 site-cats raw 응답 스키마(EsmSiteCatSchema) 통과 mock 사용.
      if (isEsmMarket(market)) {
        return buildEsmMockCategoryTree(market)
      }
      const tree: CategoryNode[] = [
        {
          id: 'C-100',
          name: '패션의류',
          depth: 1,
          leaf: false,
          parentId: null,
          children: [
            {
              id: 'C-100-10',
              name: '여성의류',
              depth: 2,
              leaf: true,
              parentId: 'C-100',
              children: [],
            },
          ],
        },
      ]
      return tree.map((n) => CategoryNodeSchema.parse(n))
    },

    transformProduct(
      product: Product,
      mapping: MarketMapping,
    ): MarketPayload {
      // ESM(G마켓·옥션) 은 real(buildEsmGoodsPayload)과 동형 중첩 페이로드
      // (EsmGoodsCreateRequestSchema 통과) 반환 — parity.
      if (isEsmMarket(market)) {
        return { market, raw: buildEsmMockGoodsPayload(market, product, mapping) }
      }
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
      }
    },

    async createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
      const s = readScenario()
      if (s === '5xx')
        throw new MarketError('server', 'mock 5xx', { market })
      if (s === '429')
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 2000,
        })
      // ESM(G마켓·옥션) 은 siteDetail.{gmkt|iac}.SiteGoodsNo 구조 raw 응답
      // (EsmGoodsCreateResponseSchema) 통과 mock 사용.
      if (isEsmMarket(market)) {
        return buildEsmMockCreateResult(market, s === 'partial' ? 'partial' : 'succeeded')
      }
      if (s === 'partial') {
        return CreateProductResultSchema.parse({
          market,
          externalId: 'MOCK-' + Math.random().toString(36).slice(2, 10),
          productUrl: `https://mock.${market}.example.com/p/123`,
          status: 'partial',
          warnings: [
            {
              code: 'image_resized',
              message: '이미지 1장이 권장 해상도 미달로 자동 보정됨',
            },
          ],
        })
      }
      return CreateProductResultSchema.parse({
        market,
        externalId: 'MOCK-' + Math.random().toString(36).slice(2, 10),
        productUrl: `https://mock.${market}.example.com/p/123`,
        status: 'succeeded',
        warnings: [],
      })
    },

    // ─────────────────────────────────────────────
    // v2 Extension (market-adapter.md §9)
    // ─────────────────────────────────────────────

    async fetchOrders(
      _input: FetchOrdersInput,
      _credential?: StoredCredential,
    ): Promise<MarketOrder[]> {
      const s = readScenario()
      if (s === '5xx')
        throw new MarketError('server', 'mock 5xx', { market })
      if (s === '401')
        throw new MarketError('unauthorized', 'mock 401', { market })
      if (s === '429')
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 1500,
        })
      if (s === 'timeout') {
        await new Promise((r) => setTimeout(r, 60_000))
        throw new MarketError('network', 'mock timeout', { market })
      }
      // happy / partial 둘 다 정상 응답 반환 (partial 은 createProduct 만 의미가 있음).
      const orders: MarketOrder[] = [
        {
          market,
          externalOrderId: `MOCK-${market.toUpperCase()}-0001`,
          buyerName: '홍길동',
          receiverName: '홍길동',
          receiverAddress: '서울특별시 강남구 테헤란로 1 타워 5F',
          receiverPhone: '010-1234-5678',
          productName: `mock ${market} 상품`,
          quantity: 2,
          orderAmount: 24_000,
          status: 'new_pay',
          paidAt: '2026-05-21T03:00:00+00:00',
        },
        {
          market,
          externalOrderId: `MOCK-${market.toUpperCase()}-0002`,
          buyerName: '김철수',
          receiverName: '김철수',
          receiverAddress: '부산광역시 해운대구 센텀로 99',
          receiverPhone: '010-9999-8888',
          productName: `mock ${market} 상품 B`,
          quantity: 1,
          orderAmount: 50_000,
          status: 'new_pay',
          paidAt: '2026-05-21T04:15:00+00:00',
        },
      ]
      return orders.map((o) => MarketOrderSchema.parse(o))
    },

    async submitTracking(
      input: SubmitTrackingInput,
      _credential?: StoredCredential,
    ): Promise<MarketSubmitTrackingResult> {
      const s = readScenario()
      if (s === '5xx')
        throw new MarketError('server', 'mock 5xx', { market })
      if (s === '401')
        throw new MarketError('unauthorized', 'mock 401', { market })
      if (s === '429')
        throw new MarketError('rate_limit', 'mock 429', {
          market,
          retryAfterMs: 1500,
        })
      if (s === 'timeout') {
        await new Promise((r) => setTimeout(r, 60_000))
        throw new MarketError('network', 'mock timeout', { market })
      }
      if (s === 'partial') {
        // 부분 실패 시나리오 — 마켓이 정상 거부 (예: 이미 발송됨).
        return MarketSubmitTrackingResultSchema.parse({
          ok: false,
          errorCode: 'already_dispatched',
          errorMessage: '해당 주문은 이미 발송 처리되었습니다',
        })
      }
      return MarketSubmitTrackingResultSchema.parse({
        ok: true,
        dispatchId: `MOCK-DISPATCH-${input.externalOrderId}`,
      })
    },
  }

  // ESM(G마켓·옥션) 만 동적 등록필드(배송 프로필 선택) 노출 — real 어댑터와 동형(parity).
  // 타 마켓은 메서드 미정의 → 호출측 `getRegistrationFields(adapter)` 가 [] 반환(하위호환).
  if (isEsmMarket(market)) {
    base.getRegistrationFields = () => getEsmRegistrationFields()
  }

  // OAuth 어댑터(네이버) 만 refreshToken 노출.
  if (credentialKind === 'oauth') {
    base.refreshToken = async (_refresh: string): Promise<TokenSet> => {
      const s = readScenario()
      if (s === '401')
        throw new MarketError('unauthorized', 'invalid_grant', { market })
      return TokenSetSchema.parse({
        accessToken: 'mock_access_rotated_' + 'x'.repeat(40),
        refreshToken: 'mock_refresh_rotated_' + 'x'.repeat(40),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        tokenType: 'Bearer',
      })
    }
  }

  return base
}
