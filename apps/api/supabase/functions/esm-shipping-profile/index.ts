/**
 * Edge Function: esm-shipping-profile
 *
 * 마스터:
 *   - docs/architecture/v1/features/esm.md §3 / §3.1 / §4.5 (배송 프로필 — PR-3)
 *   - esm-api/product/16.md (주소록) / 17.md (출하지) / 18.md (묶음배송비) / 19.md (발송정책)
 *
 * 역할:
 *   ESM(G마켓/옥션) 배송 선행값을 사전 1회 생성·재사용하는 "배송 프로필"을 만든다.
 *   상품등록 폼(PR-4)은 이 프로필을 드롭다운에서 선택만 — 폼 안에서 생성 API 호출 금지
 *   (실패 시 고아 정책 방지, esm.md §1.3).
 *
 * 처리 시퀀스 (POST):
 *   1. authenticated 셀러 JWT 검증 → sellerId
 *   2. body = EsmShippingProfileCreateInputSchema zod parse
 *   3. market_account 소유권 검증 (seller_id 일치 + market_id gmarket/auction + site 일치)
 *   4. ESM 자격증명 복호화 (loadCredential — esm_jwt kind)
 *   5. ESM 4단계 생성 (모두 Lightsail Gateway 경유 + ESM JWT Bearer):
 *        ① POST /item/v1/sellers/address          → addrNo
 *        ② POST /item/v1/shipping/places           → placeNo
 *        ③ POST /item/v1/shipping/policies         → (bundle)policyNo
 *        ④ POST /item/v1/shipping/dispatch-policies → dispatchPolicyNo
 *   6. service_role 로 esm_shipping_profiles INSERT (번호만 — PII 는 ESM 측에만)
 *   7. 응답: EsmShippingProfileSchema
 *
 * 강제 (Backend INTJ 원칙 / CLAUDE.md):
 *   - 모든 ESM 호출은 gatewayFetch 경유 (raw fetch 금지). timeout 명시. step 단위 retry 없음
 *     (배송 프로필 생성은 멱등이 아님 — 중복 생성 방지 위해 단발. 부분 실패 시 status='error').
 *   - 토큰 / secretKey / 주소 / 전화 / 이름(PII)은 로그 절대 금지. sellerId(UUID) / 길이만.
 *   - PII(주소/전화/이름)는 ESM 4단계 호출 바디에만 존재. DB 엔 번호(addr_no/place_no/...)만.
 *   - service_role 정당화: 셀러 JWT 로 ownership 검증 + market_account 소유 확인 후
 *     자기 계정 한정 INSERT. 타 셀러 row 생성 불가.
 *
 * 의존 (배포 순서):
 *   - 마이그레이션 20260530000001_esm_shipping_profiles.sql 가 먼저 적용되어야 함.
 *   - Gateway allowlist 에 sa2.esmplus.com (gateway-sign.ts + Lightsail main.ts 미러) 필요.
 */

import { z } from 'npm:zod@3.23.8'
import {
  EsmShippingProfileCreateInputSchema,
  EsmShippingProfileSchema,
  type EsmProfileSite,
} from '../_shared/schemas.ts'
import {
  HttpError,
  HttpErrors,
  MarketError,
  appendAudit,
  getServiceClient,
  getUserClient,
  loadCredential,
  ok,
  parseBody,
  withRequest,
  type Logger,
} from '../_shared/index.ts'
import { gatewayFetch } from '../_shared/gatewayFetch.ts'
import { buildEsmJwt } from '../_shared/market-adapters/esm-jwt.ts'
import {
  buildErrorRowMeta,
  parseFailedStep,
  type EsmProfileStep,
  type PartialProfileNumbers,
} from './lib/error-row.ts'

const ESM_API_BASE = 'https://sa2.esmplus.com/item/v1'
const STEP_TIMEOUT_MS = 15_000

// market_id ↔ site ↔ gateway market.
const SITE_BY_MARKET: Record<string, EsmProfileSite> = {
  gmarket: 'G',
  auction: 'A',
}

// ─────────────────────────────────────────────
// ESM 4단계 응답 스키마 (esm-api/product/16~19.md)
// ─────────────────────────────────────────────

const AddressCreateResSchema = z
  .object({
    addrNo: z.union([z.number(), z.string()]).optional(),
    resultCode: z.union([z.number(), z.string()]).optional(),
    message: z.string().nullable().optional(),
  })
  .passthrough()

const PlaceCreateResSchema = z
  .object({
    placeNo: z.union([z.number(), z.string()]).optional(),
    resultCode: z.union([z.number(), z.string()]).optional(),
    message: z.string().nullable().optional(),
  })
  .passthrough()

const PolicyCreateResSchema = z
  .object({
    policyNo: z.union([z.number(), z.string()]).optional(),
    placeNo: z.union([z.number(), z.string()]).optional(),
    resultCode: z.union([z.number(), z.string()]).optional(),
    message: z.string().nullable().optional(),
  })
  .passthrough()

const DispatchPolicyCreateResSchema = z
  .object({
    dispatchPolicyNo: z.union([z.number(), z.string()]).optional(),
    resultCode: z.union([z.number(), z.string()]).optional(),
    message: z.string().nullable().optional(),
  })
  .passthrough()

// ─────────────────────────────────────────────
// 셀러 JWT 해석
// ─────────────────────────────────────────────

async function resolveSellerId(req: Request): Promise<string> {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    throw HttpErrors.unauthorized('missing_token', 'Authorization required')
  }
  const token = auth.slice('bearer '.length).trim()
  if (token.length < 10) {
    throw HttpErrors.unauthorized('invalid_token', 'token format invalid')
  }
  const supabase = getUserClient(token)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
  }
  return data.user.id
}

// ─────────────────────────────────────────────
// market_account 소유권 + ESM credential 해석
// ─────────────────────────────────────────────

interface ResolvedAccount {
  marketId: string
  credentialId: string
  site: EsmProfileSite
}

async function resolveMarketAccount(opts: {
  marketAccountId: string
  sellerId: string
  expectedSite: EsmProfileSite
}): Promise<ResolvedAccount> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('market_accounts')
    .select('id, seller_id, market_id, credential_id, status')
    .eq('id', opts.marketAccountId)
    .maybeSingle()

  if (error || !data) {
    throw HttpErrors.notFound('market_account_not_found', 'market account not found')
  }
  // ownership — 타 셀러 계정에 프로필 생성 금지.
  if (data.seller_id !== opts.sellerId) {
    throw HttpErrors.forbidden('forbidden', 'not your market account')
  }
  const site = SITE_BY_MARKET[data.market_id as string]
  if (!site) {
    throw HttpErrors.badRequest(
      'not_esm_market',
      'market account is not an ESM (gmarket/auction) account',
    )
  }
  if (site !== opts.expectedSite) {
    throw HttpErrors.badRequest(
      'site_mismatch',
      `site mismatch — account=${site}, input=${opts.expectedSite}`,
    )
  }
  if (typeof data.credential_id !== 'string') {
    throw HttpErrors.internal('credential_missing', 'market account has no credential')
  }
  return {
    marketId: data.market_id as string,
    credentialId: data.credential_id,
    site,
  }
}

// ─────────────────────────────────────────────
// ESM 단일 호출 (gateway 경유 + JWT Bearer + 응답 파싱)
// ─────────────────────────────────────────────

async function esmPost<T extends z.ZodTypeAny>(opts: {
  market: string
  path: string
  body: unknown
  token: string
  schema: T
  step: string
  sellerId: string
  correlationId: string
  logger: Logger
}): Promise<z.infer<T>> {
  const { market, path, body, token, schema, step, sellerId, correlationId, logger } = opts
  const url = `${ESM_API_BASE}${path}`

  logger.info(
    { market, method: 'POST', step, url: path, sellerId, correlationId },
    '→ market request',
  )

  let response: Response
  try {
    response = await gatewayFetch(market, url, {
      correlationId,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `Bearer ${token}`,
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify(body),
      timeoutMs: STEP_TIMEOUT_MS,
    })
  } catch (e) {
    // gatewayFetch 는 네트워크 / gateway 거부 시 MarketError throw.
    logger.error(
      {
        market,
        step,
        sellerId,
        correlationId,
        marketErrorCode: e instanceof MarketError ? e.code : 'network',
      },
      '← market error',
    )
    throw HttpErrors.internal(
      `esm_${step}_failed`,
      `ESM ${step} 호출 실패 (네트워크/게이트웨이)`,
    )
  }

  const text = await response.text().catch(() => '')
  logger.info({ market, step, status: response.status, correlationId }, '← market response')

  if (!response.ok) {
    throw HttpErrors.badGateway(
      `esm_${step}_http_${response.status}`,
      `ESM ${step} 응답 ${response.status}`,
    )
  }

  let raw: unknown
  try {
    raw = text.length === 0 ? {} : JSON.parse(text)
  } catch {
    throw HttpErrors.badGateway(`esm_${step}_invalid_json`, `ESM ${step} 응답이 JSON 이 아님`)
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw HttpErrors.badGateway(
      `esm_${step}_schema_mismatch`,
      `ESM ${step} 응답 스키마 불일치`,
    )
  }
  return parsed.data
}

function requireNo(value: number | string | undefined, step: string): string {
  if (value === undefined || value === null || `${value}`.trim() === '') {
    throw HttpErrors.badGateway(
      `esm_${step}_no_missing`,
      `ESM ${step} 응답에 식별 번호가 없습니다`,
    )
  }
  return String(value)
}

// dispatchType → ESM 발송정책 등록 규칙 (esm-api/product/19.md).
// A=당일(마감시간 필수 11~18시) / B=순차(준비일 2~4) / C=해외(준비일 2) /
// E=주문제작(준비일 10) / D,F=필수값 없음.
function buildDispatchBody(dispatchType: string): Record<string, unknown> {
  switch (dispatchType) {
    case 'A':
      return { dispatchType, dispatchCloseTime: '15:00' }
    case 'B':
      return { dispatchType, readyDurationDay: 2 }
    case 'C':
      return { dispatchType, readyDurationDay: 2 }
    case 'E':
      return { dispatchType, readyDurationDay: 10 }
    default:
      // D / F — 필수 설정 값 없음.
      return { dispatchType }
  }
}

// ─────────────────────────────────────────────
// 부분 실패 시 status='error' row 적재 (고아 추적 — QA-313 / esm.md §1.3 §3)
// ─────────────────────────────────────────────
//
// ESM 4단계 중 일부 성공 후 뒷단계가 실패하면 ESM 측에 고아 리소스(addrNo/placeNo 등)가
// 남는다. throw 만 하면 우리 DB 에 흔적이 없어 영원히 추적 불가 → status='error' row 를
// service_role 로 적재한다(확보된 번호 + PII-free raw_meta). best-effort: 이 적재가 실패해도
// 원래 에러를 가리지 않고 그대로 re-throw 한다.
async function recordErrorProfile(opts: {
  sellerId: string
  marketAccountId: string
  site: EsmProfileSite
  profileLabel: string
  dispatchType: string
  shippingFee: number
  feeType: number
  partial: PartialProfileNumbers
  failedStep: EsmProfileStep
  errorCode: string
  market: string
  correlationId: string
  logger: Logger
}): Promise<void> {
  const { partial, failedStep, errorCode } = opts
  const rawMeta = buildErrorRowMeta({ failedStep, errorCode })
  try {
    const supabase = getServiceClient()
    const { error: insertError } = await supabase.from('esm_shipping_profiles').insert({
      seller_id: opts.sellerId,
      market_account_id: opts.marketAccountId,
      site: opts.site,
      profile_label: opts.profileLabel,
      // 성공분만 — 아직 못 받은 번호는 NULL (마이그레이션 partial CHECK 가 error 일 때 허용).
      addr_no: partial.addrNo ?? null,
      place_no: partial.placeNo ?? null,
      bundle_policy_no: partial.bundlePolicyNo ?? null,
      dispatch_policy_no: null, // dispatch 단계까지 못 갔거나 dispatch 가 실패 → 항상 NULL.
      dispatch_type: opts.dispatchType,
      shipping_fee: opts.shippingFee,
      fee_type: opts.feeType,
      raw_meta: rawMeta, // PII 없음: failedStep / errorCode / completedSteps 만.
      status: 'error',
    })
    if (insertError) {
      // 동일 라벨 unique 충돌(23505) 등 — error row 적재 실패는 로그만 남기고 삼킨다.
      logger.error(
        {
          market: opts.market,
          sellerId: opts.sellerId,
          correlationId: opts.correlationId,
          failedStep,
          errorCode,
          rpcError: insertError.code ?? 'unknown',
        },
        '← esm shipping profile error-row insert failed',
      )
      return
    }
    logger.info(
      {
        market: opts.market,
        sellerId: opts.sellerId,
        correlationId: opts.correlationId,
        failedStep,
        errorCode,
        completedSteps: rawMeta.completedSteps,
      },
      '← esm shipping profile error row recorded (orphan tracking)',
    )
  } catch (e) {
    logger.error(
      {
        market: opts.market,
        sellerId: opts.sellerId,
        correlationId: opts.correlationId,
        failedStep,
        errorCode,
        err: e instanceof Error ? e.name : 'unknown',
      },
      '← esm shipping profile error-row insert threw',
    )
  }
}

// ─────────────────────────────────────────────
// Edge Function entry
// ─────────────────────────────────────────────

export default Deno.serve(
  withRequest('esm-shipping-profile', async ({ req, logger, correlationId }) => {
    if (req.method !== 'POST') {
      throw HttpErrors.badRequest('method_not_allowed', 'POST required')
    }

    const body = await parseBody(req, EsmShippingProfileCreateInputSchema)
    const sellerId = await resolveSellerId(req)

    // 1) market_account 소유권 + site 검증.
    const account = await resolveMarketAccount({
      marketAccountId: body.marketAccountId,
      sellerId,
      expectedSite: body.site,
    })
    const market = account.marketId // 'gmarket' | 'auction' (gateway market)

    // 2) ESM 자격증명 복호화 → JWT 발급.
    const cred = await loadCredential({
      credentialId: account.credentialId,
      correlationId,
      logger,
    })
    if (cred.credentialKind !== 'esm_jwt') {
      throw HttpErrors.badRequest(
        'credential_kind_mismatch',
        `expected esm_jwt credential, got ${cred.credentialKind}`,
      )
    }
    const p = cred.payload as {
      masterId?: string
      secretKey?: string
    }
    if (!p.masterId || !p.secretKey) {
      throw HttpErrors.internal('credential_malformed', 'ESM credential malformed')
    }
    const { token } = await buildEsmJwt({
      masterId: p.masterId,
      secretKey: p.secretKey,
      site: body.site,
    })

    logger.info(
      {
        market,
        sellerId,
        site: body.site,
        profileLabelLen: body.profileLabel.length,
        correlationId,
      },
      '→ esm shipping profile create (4-step)',
    )

    // ── 3) ESM 4단계 생성 ────────────────────────────────────────────────
    // 단계 진행 중 확보된 번호를 추적한다(부분 실패 시 error row 적재용 — QA-313).
    // 어느 단계든 실패하면 ESM 측에 고아 리소스가 남으므로 throw 전에 status='error'
    // row 를 적재(확보 번호 + PII-free meta)한 뒤 원래 에러를 그대로 re-throw.
    const partial: PartialProfileNumbers = {}
    let addrNo: string
    let placeNo: string
    let bundlePolicyNo: string | null
    let dispatchPolicyNo: string
    try {
      // ① 주소록 (esm-api/product/16.md). PII 는 이 바디에만 — DB 저장 금지.
      const addrRes = await esmPost({
        market,
        path: '/sellers/address',
        body: {
          addrName: body.profileLabel,
          representativeName: body.address.contactName,
          zipCode: body.address.zipCode,
          addr1: body.address.addressMain,
          addr2: body.address.addressDetail ?? '',
          homeTel: body.address.contactPhone,
          cellPhone: body.address.contactPhone,
          isVisitAndTakeAddr: false,
          isReturnAddr: true,
          isGlobalSeller: false,
        },
        token,
        schema: AddressCreateResSchema,
        step: 'address',
        sellerId,
        correlationId,
        logger,
      })
      addrNo = requireNo(addrRes.addrNo, 'address')
      partial.addrNo = addrNo

      // ② 출하지 (esm-api/product/17.md).
      const placeRes = await esmPost({
        market,
        path: '/shipping/places',
        body: {
          placeName: body.profileLabel,
          addrNo: Number(addrNo),
          isSetAdditionalShippingFee: false,
          isDefaultShippingPlace: false,
          imposeType: 1,
        },
        token,
        schema: PlaceCreateResSchema,
        step: 'place',
        sellerId,
        correlationId,
        logger,
      })
      placeNo = requireNo(placeRes.placeNo, 'place')
      partial.placeNo = placeNo

      // ③ 묶음배송비 정책 (esm-api/product/18.md).
      //    feeType: 1=무료 / 2=유료 (ESM 정책구분). 우리 fee_type(1=묶음/2=상품별)과 의미가
      //    다르므로 shipping_fee 금액으로 무료/유료를 판정한다(0=무료, >0=유료).
      const isPaid = body.shippingFee > 0
      const policyRes = await esmPost({
        market,
        path: '/shipping/policies',
        body: {
          feeType: isPaid ? 2 : 1,
          fee: body.shippingFee,
          isPrepayment: true,
          isCashOnDelivery: false,
          placeNo: Number(placeNo),
          isDefault: true,
          shippingFee: [{ condition: 0 }],
        },
        token,
        schema: PolicyCreateResSchema,
        step: 'policy',
        sellerId,
        correlationId,
        logger,
      })
      // policyNo 는 옵션 — 일부 사이트는 placeNo 만 반환. 누락 시 null 저장.
      bundlePolicyNo =
        policyRes.policyNo !== undefined && `${policyRes.policyNo}`.trim() !== ''
          ? String(policyRes.policyNo)
          : null
      partial.bundlePolicyNo = bundlePolicyNo

      // ④ 발송정책 (esm-api/product/19.md).
      const dispatchRes = await esmPost({
        market,
        path: '/shipping/dispatch-policies',
        body: buildDispatchBody(body.dispatchType),
        token,
        schema: DispatchPolicyCreateResSchema,
        step: 'dispatch',
        sellerId,
        correlationId,
        logger,
      })
      dispatchPolicyNo = requireNo(dispatchRes.dispatchPolicyNo, 'dispatch')
    } catch (e) {
      // 부분 실패 — ESM 측 고아 리소스 추적용 error row 적재 후 re-throw.
      // failedStep 은 HttpError.code(`esm_<step>_*`)에서 역산. fallback 은 마지막 미완료 단계.
      const errorCode = e instanceof HttpError ? e.code : 'esm_step_unknown'
      const failedStep: EsmProfileStep =
        parseFailedStep(errorCode) ??
        (partial.placeNo === undefined
          ? partial.addrNo === undefined
            ? 'address'
            : 'place'
          : partial.bundlePolicyNo === undefined
            ? 'policy'
            : 'dispatch')
      await recordErrorProfile({
        sellerId,
        marketAccountId: body.marketAccountId,
        site: body.site,
        profileLabel: body.profileLabel,
        dispatchType: body.dispatchType,
        shippingFee: body.shippingFee,
        feeType: body.feeType,
        partial,
        failedStep,
        errorCode,
        market,
        correlationId,
        logger,
      })
      throw e
    }

    // ── 4) DB 저장 (service_role, 번호만 — PII 미저장) ────────────────────
    const supabase = getServiceClient()
    const { data: inserted, error: insertError } = await supabase
      .from('esm_shipping_profiles')
      .insert({
        seller_id: sellerId,
        market_account_id: body.marketAccountId,
        site: body.site,
        profile_label: body.profileLabel,
        addr_no: addrNo,
        place_no: placeNo,
        bundle_policy_no: bundlePolicyNo,
        dispatch_policy_no: dispatchPolicyNo,
        dispatch_type: body.dispatchType,
        shipping_fee: body.shippingFee,
        fee_type: body.feeType,
        status: 'active',
      })
      .select(
        'id, seller_id, market_account_id, site, profile_label, addr_no, place_no, ' +
          'bundle_policy_no, dispatch_policy_no, dispatch_type, shipping_fee, fee_type, ' +
          'status, created_at, updated_at',
      )
      .single()

    if (insertError || !inserted) {
      logger.error(
        { market, sellerId, correlationId, rpcError: insertError?.code ?? 'unknown' },
        '← esm shipping profile insert error',
      )
      // 중복 라벨 (unique 위반) 은 사용자 입력 오류 → 409.
      if (insertError?.code === '23505') {
        throw HttpErrors.conflict(
          'profile_label_duplicate',
          '동일 라벨의 배송 프로필이 이미 존재합니다',
        )
      }
      throw HttpErrors.internal('profile_store_failed', '배송 프로필 저장 실패')
    }

    await appendAudit({
      category: 'shipping',
      event: 'esm_shipping_profile_created',
      sellerId,
      meta: { market, site: body.site, profileId: inserted.id },
      correlationId,
      logger,
    })

    logger.info(
      { market, sellerId, profileId: inserted.id, correlationId },
      '← esm shipping profile created',
    )

    const responseBody = EsmShippingProfileSchema.parse({
      id: inserted.id,
      sellerId: inserted.seller_id,
      marketAccountId: inserted.market_account_id,
      site: inserted.site,
      profileLabel: inserted.profile_label,
      addrNo: inserted.addr_no,
      placeNo: inserted.place_no,
      bundlePolicyNo: inserted.bundle_policy_no,
      dispatchPolicyNo: inserted.dispatch_policy_no,
      dispatchType: inserted.dispatch_type,
      shippingFee: inserted.shipping_fee,
      feeType: inserted.fee_type,
      status: inserted.status,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    })

    return ok(responseBody, { correlationId })
  }),
)
