# cross-cutting/shipping-fee-model.md — 배송비 모델 (4 마켓 비교 + 2-레이어 결정)

> 상품 등록 시 "배송비/배송조건"을 우리 서비스가 어떻게 모델링하고 마켓별로 어떻게 매핑하는지에 대한 영구 설계 결정.
> 의존: `cross-cutting/market-adapter.md` (5 메서드 인터페이스 — `transformProduct` 단일 출처), `features/registration.md` §3.2 `shipping_policies`, `features/esm.md` §3 `esm_shipping_profiles`, `features/settings-shipping.md` §5.4.
> 소관: backend + architect 주도, frontend / qa / security 리뷰.
> 작성 근거: 2026-05-30 4 마켓(쿠팡/ESM/네이버/11번가) 배송비 API 모델 조사.

---

## 0. 문제 정의 (왜 이 문서가 필요한가)

상품 등록 1단계에서 셀러가 고르는 **배송 정책(`shipping_policies`)** 과 ESM 전용 **배송 프로필(`esm_shipping_profiles`)** 이 기능적으로 겹쳐 보인다는 의문에서 출발. 4 마켓의 실제 배송비 API 를 조사한 결과, 둘은 **중복이 아니라 직교(orthogonal)** 하는 두 관심사이며, 현재 코드가 이 둘을 **잘못된 축으로 분리**해 둔 것이 진단이다.

배송에는 직교하는 두 가지가 섞여 있다:

- **(가) 요금 의도 (fee intent)** — 무료/유료/조건부무료/착불, 기본배송비, 무료조건금액, 반품·교환비, 도서산간 추가비. **마켓 무관한 셀러 의도**. → `shipping_policies` 의 책임.
- **(나) 물류 참조 (logistics reference)** — 출고지/반품지 주소, 발송 타이밍. **모든 마켓이 계정 단위 사전 생성 리소스를 요구**. → `esm_shipping_profiles`(현재 ESM 한정)의 책임이지만 사실 보편 패턴.

---

## 1. 4 마켓 배송비 모델 조사 결과 (2026-05-30)

핵심 발견: **4 마켓 전부 하이브리드**다. 배송비 *금액/조건*은 대부분 등록 페이로드에 인라인으로 넣지만, **출고지·반품지 주소는 예외 없이 "사전 생성한 리소스를 참조"** 한다. ESM 만 배송비까지 사전 정책에 박는 극단.

| 마켓 | 배송비 금액·조건 | 출고지/반품지 | 묶음배송 | 도서산간 | 우리 코드 현재 |
|---|---|---|---|---|---|
| **쿠팡** | **인라인** — `deliveryChargeType`(FREE/NOT_FREE/CONDITIONAL_FREE/CHARGE_RECEIVED) + `deliveryCharge` + `freeShipOverAmount` + `deliveryChargeOnReturn` + `returnCharge` | **코드 참조 (선행 생성)** `outboundShippingPlaceCode` / `returnCenterCode` | 인라인 플래그 `unionDeliveryType`(UNION/NOT_UNION) | **출고지 리소스**의 `remoteInfos.jeju/notJeju` | `shippingFee` 숫자만, 출고지/반품지 **미전송** |
| **ESM** | **참조** — 묶음배송비정책 `bundle.deliveryTmplId`(3단계서 fee 고정), *상품별배송비(`feeType:2`)일 때만 `each.fee` 인라인* | **번호 참조** 4단계 선행 (주소록`addrNo`→출하지`placeNo`→묶음배송비`policyNo`→발송정책`dispatchPolicyNo`) | 묶음배송비정책 | 출하지의 `jeju/backwoodsAdditionalShippingFee` | `esm_shipping_profiles` 참조 ✓ |
| **네이버** | **인라인** — `deliveryFee.deliveryFeeType` + `baseFee` + `freeConditionalAmount` + 수량별 | **주소록 ID 참조** `shippingAddressId` / `returnAddressId` | **그룹 ID 참조 (사전 생성)** `deliveryBundleGroupId` | 인라인 `deliveryFeeByArea`(AREA_2/AREA_3) | `deliveryFeeType`(FREE/PAID)+`baseFee`만, 반품/주소/묶음 **미전송** |
| **11번가** | **인라인** — `dlvCstInstBasiCd`(배송비종류 01무료/02고정/03조건부무료/04수량차등/05개당) + `dlvCst1`/`dlvCst3`/`dlvCst4` + `PrdFrDlvBasiAmt`(조건금액) + `dlvCstPayTypCd`(선/착불) + `rtngdDlvCst`(반품)/`exchDlvCst`(교환) | **시퀀스 참조 (선행 조회)** `addrSeqOut`/`addrSeqIn` (출고지 1014/1691·반품지 1015/1692·등록 6701/6702 의 `addrSeq`) | `bndlDlvCnYn` 플래그 | `jejuDlvCst`/`islandDlvCst` 인라인 | **placeholder** — 구 어댑터 `dlvCst`(존재 안 함), 출고지/반품지 미전송 |

### 1.1 마켓별 세부 (조사 출처)

**쿠팡** (로컬 문서 `features/coupang-api/`):
- 배송비는 `product/상품-생성.md` 페이로드 인라인. `deliveryChargeType` enum 4종, 유형별 동반 필드 강제.
- 제약: `returnCharge` 는 `deliveryChargeOnReturn` 대비 100~150%만. `freeShipOverAmount=19800` 이면 초도반품배송비 0원 강제. 묶음배송은 동일 출고지만 + 착불 불가.
- 출고지(`logistics/출고지-생성.md`)·반품지(`logistics/반품지-생성.md`)는 선행 생성 별도 리소스. 반품지는 택배사 계약 없으면 `"NO_RETURN_CENTERCODE"` + 인라인 가능.
- 도서산간 금액은 **출고지 리소스**의 `remoteInfos.jeju/notJeju`(EPOST 0/100~400, 일반 0/1,000~ 단위, 문서 내 상한 불일치 8,000 vs 20,000).

**ESM** (로컬 문서 `features/esm-api/`):
- 배송비는 기본 **참조**. 4단계 선행 생성 후 `POST /item/v1/goods` 의 `shipping.policy.placeNo` + `feeType` + (`feeType:1`→`bundle.deliveryTmplId` / `feeType:2`→`each.fee`) + `dispatchPolicyNo.{gmkt|iac}`.
- **본배송비는 3단계(묶음배송비 정책)에서 고정**, 추가배송비는 2단계(출하지)에서 고정, **발송정책(4단계)엔 배송비 없음**(발송 타이밍만).
- 사이트 공유: 주소록/출하지/묶음배송비는 마스터 공용, **발송정책만 G마켓·옥션 사이트별 별도**(사이트별 토큰 호출, 등록 시 `gmkt`/`iac` 각각).
- 4단계 자동채번 + 멱등 아님 → 부분 생성 시 고아 리소스 위험 (esm.md §3.1).

**네이버** (웹 — GitHub `commerce-api-naver/commerce-api` Discussions #241/#246/#1922/#1469):
- 배송비 본체는 `originProduct.deliveryInfo.deliveryFee` 인라인 (`deliveryFeeType`, `baseFee`, `freeConditionalAmount`, 수량별, `deliveryFeePayType` PREPAID/COLLECT_OR_PREPAID).
- 반품/교환비도 `claimDeliveryInfo.returnDeliveryFee`/`exchangeDeliveryFee` 인라인.
- **묶음배송 그룹**은 사전 생성 리소스 `deliveryBundleGroupId` 참조(전용 등록 API 존재 여부는 불확실 — 판매자센터 생성 추정). **출고지/반품지는 주소록 ID** `shippingAddressId`/`returnAddressId` 참조(주소록 조회 API 명확).
- 도서산간은 `deliveryFeeByArea`(AREA_2/AREA_3) 인라인.
- ⚠ 불확실: `deliveryFeeType` 전체 enum(FREE/PAID만 확정), `deliveryFeePayType` COLLECT 단독값, 묶음그룹 전용 API — 정식 spec(apicenter) 직접 확인 권장.

**11번가** (로컬 문서 `features/11st-api/` — 2026-05-30 셀러 OpenAPI spec import #265 로 **XML 필드명·코드값 확정**):
- 배송비는 상품등록(`POST /rest/prodservices/product`, apiSeq 1003) 페이로드 인라인. `dlvCstInstBasiCd`(배송비 종류 enum: 01무료/02고정/03상품조건부무료/04수량별차등/05개당/07판매자조건부/09통합출고지/10해외) + 유형별 동반 필드(`dlvCst1` 고정·조건부, `dlvCst3` 수량차등 `5000^3000^…`, `dlvCst4` 개당, `PrdFrDlvBasiAmt` 조건금액) + `dlvCstPayTypCd`(01선·착불 가능/02착불/03선결제) + `bndlDlvCnYn`(묶음 Y/N).
- 반품/교환: `rtngdDlvCst`(반품배송비)·`exchDlvCst`(교환배송비 왕복)·`rtngdDlvCd`(초기무료시 부과방법). 도서산간: `jejuDlvCst`/`islandDlvCst` 인라인.
- **출고지/반품지는 시퀀스코드(`addrSeq`) 선행 조회 후 `addrSeqOut`/`addrSeqIn` 으로 전송**(미등록 시 기본주소 자동설정되나 권장 안 함). 조회: 출고지 목록 `GET /rest/areaservice/outboundarea`(1014)/단건 `POST .../getOutAddressInfo/{addrSeq}`(1691), 반품지 1015/1692, 등록 6701/6702. 응답 `ns2:inOutAddress.addrSeq`.
- ✅ 구 어댑터가 쓰던 `dlvCst` 단일 필드는 **실제 spec 에 존재하지 않음**(§4 갱신). 어댑터 재구현은 `features/11st.md` 마스터.

---

## 2. 확정 결정 — 2-레이어 모델 (2026-05-30, 사용자 승인)

배송 관심사를 직교하는 두 레이어로 재정립한다.

### Layer 1 — 배송 정책 (요금 의도, 마켓 무관 단일 소스)

`shipping_policies` 를 **모든 마켓 배송비 필드의 합집합** 수준으로 enrich. 셀러당 N개, 상품·마켓 무관하게 재사용. `transformProduct` 가 각 마켓 인라인 필드로 매핑.

| 우리 필드 (Layer 1) | 의미 | 쿠팡 매핑 | 네이버 매핑 | 11번가 매핑 (spec 확정) | ESM 매핑 |
|---|---|---|---|---|---|
| `feeType` | free / paid / conditional_free / charge_on_delivery | `deliveryChargeType` | `deliveryFeeType` | `dlvCstInstBasiCd`(01/02/03/05) | 묶음배송비정책 `feeType`(생성 시) |
| `baseFee` | 기본배송비(원) | `deliveryCharge` | `baseFee` | `dlvCst1`(고정·조건부) / `dlvCst4`(개당) | `fee`(생성 시) |
| `freeThreshold` | 조건부무료 기준금액 | `freeShipOverAmount` | `freeConditionalAmount` | `PrdFrDlvBasiAmt` | `shippingFee[].condition`(생성 시) |
| `returnFee` | 반품배송비 | `returnCharge` | `claimDeliveryInfo.returnDeliveryFee` | `rtngdDlvCst` (+ `exchDlvCst` 교환) | `returnAndExchange.fee` |
| `initialReturnFee` | 초도반품배송비(무료배송 시) | `deliveryChargeOnReturn` | (해당 없음) | `rtngdDlvCd`(부과방법 01왕복/02편도) | (해당 없음) |
| `areaSurcharge` | 제주/도서산간 추가비 | 출고지 `remoteInfos`(Layer 2) | `deliveryFeeByArea` | `jejuDlvCst`/`islandDlvCst`(인라인) | 출하지(Layer 2) |
| `bundleAllowed` | 묶음배송 허용 | `unionDeliveryType` | `deliveryBundleGroupUsable` | `bndlDlvCnYn`(Y/N) | 묶음배송비정책 |

> **ESM 특이 (조회형 전환 후)**: ESM 은 배송비를 사전 정책(`dispatchPolicyNo`/묶음배송비)에 박으므로, **배송비 금액은 셀러가 ESM Plus 에서 정책 생성 시 이미 입력**한다. 따라서 ESM 은 Layer 1 fee 를 `transformProduct` 에서 인라인 매핑하지 않고, 셀러가 select 한 정책 번호에 묶인 금액을 그대로 따른다(우리 Layer 1 fee 는 ESM 에선 비적용 — 정보성). 인라인 매핑은 쿠팡/네이버/11번가 한정. (생성형 시절엔 "프로필 생성 시점에 Layer 1 fee 소비" 였으나, 조회형 전환으로 우리가 생성하지 않으므로 해당 흐름 폐기.)

### Layer 2 — 마켓별 배송 리소스 (출고지/반품지/발송 참조) — **조회형 단일 표준 (2026-05-30 결정)**

**5마켓 전부 "셀러가 마켓 콘솔에서 만든 배송 리소스를 우리가 조회 → select" 하는 조회형으로 통일한다.** 마켓별 조회 API 가 전부 존재함이 spec 으로 확인됐다(아래 표). 우리 앱이 출고지/반품지/배송정책을 **생성하지 않는다** — DB 에 배송 참조 테이블도 두지 않는다(조회 결과는 호출측 24h 캐시).

| 마켓 | Layer 2 참조값 | 조회 API (셀러 콘솔 선행 등록분) |
|---|---|---|
| 쿠팡 | `outboundShippingPlaceCode`, `returnCenterCode` | 출고지/반품지 조회 API (Wing 등록분) |
| 네이버 | `shippingAddressId`, `returnAddressId`, `deliveryBundleGroupId` | 주소록 조회 API (스마트스토어센터 등록분) |
| 11번가 | `addrSeqOut`/`addrSeqIn` | `GET /rest/areaservice/outboundarea`(1014)·반품지(1015) |
| ESM | `placeNo`, `dispatchPolicyNo`(사이트별), `addrNo` | `GET /item/v1/shipping/places`(17 전체조회)·`/shipping/dispatch-policies`(19 전체조회) |

> **⚠️ ESM 전환 (2026-05-30 결정 — B안)**: ESM 은 현재 **생성형**(우리 앱이 4단계 `POST` 로 출하지·발송정책 생성 → `esm_shipping_profiles` 테이블 저장)으로 구현돼 있으나, ESM 도 위 GET 조회 API(17/19 전체조회 확인)가 전부 있어 조회형이 성립한다. **생성형은 API 강제가 아니라 제품 결정이었고, 4단계 순차생성·고아 리소스·`status='error'` 추적(QA-313)·테이블+RLS 의 복잡도 전부가 거기서 나왔다.** → ESM 도 조회형으로 전환하고 `esm_shipping_profiles` 테이블·생성 Edge·생성 UI 를 deprecate 한다. 로드맵은 `features/esm.md` "전환 결정" 절. **신규 마켓(11/네이버/쿠팡)은 처음부터 조회형** — 생성형을 템플릿으로 삼지 않는다.

→ **배송 정책(Layer 1) = 요금 의도 단일 소스 / 배송 리소스(Layer 2) = 마켓 콘솔 선행 등록분 조회·선택**. 둘은 직교. 등록 시 (가)는 상품 1단계 배송 정책에서, (나)는 마켓별 카드의 조회형 select 에서.

---

## 3. 현재 코드의 갭 (이 결정으로 드러난 위험)

1. **워커 fee 0원 하드코딩** — `registration-market-worker/lib/data-load.ts:181` + `registration-validate/lib/check.ts:38` 이 `shippingFeeKrw: 0` 고정. `shipping_policy_id` 를 SELECT 하면서도 fee 로 해소(resolve)하지 않음 → 네이버/쿠팡/11번가가 셀러가 고른 배송비를 무시하고 0(무료)으로 등록될 수 있음. **버그.**
2. **쿠팡/네이버 어댑터가 출고지/반품지 미전송** — 두 마켓은 `outboundShippingPlaceCode`/`returnCenterCode`(쿠팡), `shippingAddressId`/`returnAddressId`(네이버)가 필수. 현재 어댑터는 배송비만 보냄 → real 실호출 시 거부. 11번가도 동일(미전송). → Layer 2 조회형 select 로 일괄 해소.
3. **배송 정책 스키마 빈약** — `ShippingPolicyFormSchema` 는 `method`/`fee`/`etaDays`/`isDefault` flat. 조건부무료·반품비·도서산간·feeType 을 표현 못 함.
4. **ESM 만 생성형 (Layer 2 모델 분기)** — `esm_shipping_profiles` 테이블 + 4단계 생성 Edge + 생성 UI 가 나머지 마켓의 조회형과 다른 축으로 분기. 마켓별 Layer 2 모델이 둘로 갈려 유지·테스트 부담 + 신규 마켓이 잘못된 템플릿(생성형) 따를 위험. → ESM 조회형 전환으로 단일화(§4-5).

---

## 4. 구현 순서 (제안)

1. **버그픽스** — 워커/validate 가 `shipping_policy_id` → `shipping_policies` 조회 → `product.shippingFeeKrw`(및 후속 필드) 주입. 0원 하드코딩 제거.
2. **Layer 1 enrich** — `shipping_policies` 마이그레이션 + `ShippingPolicyFormSchema` 에 `feeType`/`freeThreshold`/`returnFee`/`initialReturnFee`/`areaSurcharge`/`bundleAllowed` 추가. `SettingsPoliciesPage` 폼 확장.
3. **어댑터 매핑** — 각 `transformProduct`(쿠팡/네이버/11번가)가 §2 Layer 1 표대로 인라인 필드 매핑. parity.spec 갱신. (ESM 은 fee 가 정책에 묶여 인라인 비대상.)
4. **Layer 2 조회형 단일화** — 5마켓 전부 "마켓 콘솔 선행 등록분 조회 → select". 마켓별 조회 Edge(11번가 `outboundarea`, ESM `/shipping/places`·`/dispatch-policies` 전체조회, 쿠팡 출고지/반품지 조회, 네이버 주소록 조회) + `getRegistrationFields` select 의 `optionsSource` 를 마켓별 lookup 으로. **배송 참조 DB 테이블 없음**(조회 결과는 호출측 24h 캐시).
5. **ESM 생성형 deprecate** — `esm_shipping_profiles` 테이블 + 생성 Edge `esm-shipping-profile`(4단계) + 생성 UI(`SettingsShippingEsmProfilesPage` 등)를 제거하고 ESM 도 4번의 조회형으로 전환. 상세 로드맵·코드 blast radius 는 `features/esm.md` "전환 결정(생성형→조회형)" 절.

현재 어댑터가 쓰는 필드: 네이버 `deliveryInfo.deliveryFee.{deliveryFeeType,baseFee}`(`real/naver/index.ts:496`), 쿠팡 `shippingFee`(`real/coupang/index.ts:378`). ⚠️ 11번가는 `eleven-st-map.ts:158` 이 `dlvCst` 를 쓰지만 **실제 spec 에 없는 필드**(spec import #265 확인) — 재구현 시 `dlvCstInstBasiCd`+`dlvCst1/3/4` 로 교체. `features/11st.md` 마스터.

---

## 5. 출처

- 쿠팡: 로컬 `docs/architecture/v1/features/coupang-api/{product/상품-생성.md, logistics/출고지-생성.md, logistics/반품지-생성.md, logistics/출고지-조회.md, logistics/반품지-단건-조회.md}`
- ESM: 로컬 `docs/architecture/v1/features/esm-api/product/{16,17,18,19,20,195}.md`
- 네이버: GitHub `commerce-api-naver/commerce-api` Discussions [#241](https://github.com/commerce-api-naver/commerce-api/discussions/241) / [#246](https://github.com/commerce-api-naver/commerce-api/discussions/246) / [#1922](https://github.com/commerce-api-naver/commerce-api/discussions/1922) / [#1469](https://github.com/commerce-api-naver/commerce-api/discussions/1469), 정식 레퍼런스 `https://apicenter.commerce.naver.com/`(봇 차단 — 직접 확인 권장)
- 11번가: 로컬 `docs/architecture/v1/features/11st-api/product/{product-manage-1003.md(상품등록), shipping-1014.md/1691.md(출고지), shipping-1015.md/1692.md(반품지), category-1001.md}` (2026-05-30 셀러 OpenAPI spec import #265). XML 필드명·코드값 확정.

## 6. 미해결 사안

- 네이버 `deliveryFeeType`/`deliveryFeePayType` 전체 enum, 묶음그룹 전용 API 존재 여부 — apicenter spec 직접 확인 필요.
- ~~11번가 배송비 XML 필드명·코드값~~ — **해소 (2026-05-30, spec import #265)**. `dlvCstInstBasiCd`/`dlvCst1/3/4`/`PrdFrDlvBasiAmt`/`jejuDlvCst`/`islandDlvCst`/`rtngdDlvCst`/`exchDlvCst` 확정. 어댑터 반영은 `features/11st.md` 재구현 트랙.
- ~~Layer 2 일반화 방식: 단일 범용 테이블 vs 마켓별 동형 테이블~~ — **해소 (2026-05-30, B안 결정)**. **테이블 없는 조회형으로 단일화** (5마켓 전부 마켓 콘솔 선행 등록분 조회·select). ESM 생성형(`esm_shipping_profiles`)은 deprecate → `features/esm.md` 전환 로드맵.
- 쿠팡/네이버 출고지·반품지 **조회 API 응답 스키마** 확정 — 쿠팡 출고지/반품지 조회, 네이버 주소록 조회 응답 필드 (real 검증 트랙에서 캡처).
- 쿠팡 신규 셀러 출고지 0개 시 fallback(마켓 콘솔 안내 vs 생성 API) — v1 은 콘솔 안내.
- 쿠팡 도서산간 일반 택배사 상한(8,000 vs 20,000 문서 불일치) 현행값.
