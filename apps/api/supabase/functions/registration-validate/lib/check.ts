/**
 * 마켓별 검증 + transformProduct 시뮬레이션.
 *
 * - registration.md §5.3 필수 필드 매트릭스 + §5.4 검증 우선순위 반영.
 * - 본 단계는 외부 마켓 API 호출 없음. adapter.transformProduct 만 호출 (순수 함수).
 */

import {
  getMarketAdapter,
  MarketError,
  type Logger,
  type MarketId,
  type MarketMapping,
  type Product,
} from '../../_shared/index.ts'
import type {
  ImageRow,
  MappingRow,
  MarketPreview,
  ProductRow,
  ValidationIssue,
} from './types.ts'

function toDomainProduct(p: ProductRow, images: ImageRow[]): Product {
  return {
    id: p.id,
    sellerId: p.seller_id,
    name: p.name,
    priceKrw: p.price,
    stock: 0,
    images: images.map((img) => ({
      url: img.url.startsWith('http') ? img.url : `https://placeholder/${img.url}`,
      order: img.sort_order,
    })),
    descriptionHtml: p.description_html ?? '',
    brand: p.brand ?? undefined,
    shippingFeeKrw: 0,
  }
}

function checkBasics(
  marketId: MarketId,
  product: ProductRow,
  images: ImageRow[],
  mapping: MappingRow,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (product.name.length < 2 || product.name.length > 100) {
    issues.push({
      marketId,
      code: 'product_name_invalid',
      field: 'name',
      message: '상품명은 2~100자여야 합니다',
    })
  }

  const minPrice = marketId === 'coupang' ? 1_000 : 100
  if (product.price < minPrice) {
    issues.push({
      marketId,
      code: 'product_price_invalid',
      field: 'price',
      message: `${marketId} 최소 판매가는 ${minPrice}원입니다`,
    })
  }

  if (!mapping.market_category_code) {
    issues.push({
      marketId,
      code: 'category_missing',
      field: 'market_category_code',
      message: '마켓 카테고리 코드가 누락되었습니다',
    })
  }

  if (!images.some((i) => i.role === 'main')) {
    issues.push({
      marketId,
      code: 'image_main_missing',
      field: 'product_images',
      message: '대표 이미지가 필요합니다',
    })
  }

  if (
    marketId === 'coupang' &&
    (!product.description_html || product.description_html.length < 10)
  ) {
    issues.push({
      marketId,
      code: 'description_required',
      field: 'description_html',
      message: '쿠팡은 상세 설명이 최소 10자 필요합니다',
    })
  }

  return issues
}

export function validateMarket(
  marketId: MarketId,
  product: ProductRow,
  images: ImageRow[],
  mapping: MappingRow | undefined,
  logger: Logger,
): { issues: ValidationIssue[]; preview: MarketPreview | null } {
  if (!mapping) {
    return {
      issues: [
        {
          marketId,
          code: 'mapping_not_found',
          field: 'product_market_mappings',
          message: '마켓 매핑이 존재하지 않습니다',
          hint: 'Step 3 에서 카테고리·매핑을 먼저 저장하세요',
        },
      ],
      preview: null,
    }
  }

  const issues = checkBasics(marketId, product, images, mapping)
  if (issues.length > 0) {
    return { issues, preview: null }
  }

  try {
    const adapter = getMarketAdapter(marketId)
    const domainProduct = toDomainProduct(product, images)
    const marketMapping: MarketMapping = {
      market: marketId,
      categoryId: mapping.market_category_code,
      transformedImageUrls: images.map((img) =>
        img.url.startsWith('http') ? img.url : `https://placeholder/${img.url}`,
      ),
      extra: mapping.market_options,
    }
    const payload = adapter.transformProduct(domainProduct, marketMapping)
    return {
      issues,
      preview: { marketId, payload, estimatedFee: null },
    }
  } catch (e) {
    if (e instanceof MarketError && e.code === 'validation') {
      issues.push({
        marketId,
        code: 'transform_failed',
        field: 'adapter',
        message: e.message,
      })
    } else {
      logger.error(
        { market: marketId, err: e instanceof Error ? e.message : 'unknown' },
        '← validate transform unexpected',
      )
      issues.push({
        marketId,
        code: 'transform_failed',
        field: 'adapter',
        message: '마켓 변환 시뮬레이션 실패',
      })
    }
    return { issues, preview: null }
  }
}
