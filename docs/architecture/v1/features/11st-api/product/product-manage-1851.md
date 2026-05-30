# Seller - 상품 - 옵션 수정 / 표준옵션 수정

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=81&apiSeq=1851&apiSpecType=1
> categoryNo: `81` · apiSeq: `1851` · 섹션: 상품 > 상품관리
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

옵션/표준옵션을 수정할 수 있습니다.
Seller Office에서 등록 및 수정이 가능합니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/prodservices/updateProductOption/[prdNo]` |
| Protocol | http |
| Version | 1.4 |
| 요청 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdNo` | 상품번호 | string | Y |  | 113214968 |  |

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `Product` | Product | object | Y |  |  |  |
| &nbsp;&nbsp;`optSelectYn` | 선택형 옵션 여부 | string |  |  | Y | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요. |
| &nbsp;&nbsp;`txtColCnt` | 고정값 | string |  |  | 1 | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요.<br>옵션을 등록하실 경우 1 고정값을 주셔야 합니다. |
| &nbsp;&nbsp;`optionAllQty` | 멀티옵션 일괄재고수량 설정 | string |  |  | 99 | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요.<br>"상품상세 옵션값 노출 방식 선택"을 생략하실 경우 등록순 옵션이 노출됩니다.<br>"멀티옵션" 방식이 아닌 "싱글옵션" 방식 일 경우는 Element는 생략해주셔야 합니다.<br>멀티옵션은 옵션별 재고 수량 설정이 api 에서는 불가합니다. 일괄설정만 가능. |
| &nbsp;&nbsp;`optionAllAddPrc` | 멀티옵션 옵션가 0원 설정 | string |  |  | 0 | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요.<br>"상품상세 옵션값 노출 방식 선택"을 생략하실 경우 등록순 옵션이 노출됩니다.<br>"멀티옵션" 방식이 아닌 "싱글옵션" 방식 일 경우는 Element는 생략해주셔야 합니다.<br>멀티옵션은 옵션별 옵션가 설정이 api 에서는 불가합니다. 0원만 입력 가능. |
| &nbsp;&nbsp;`optionAllAddWght` | 멀티옵션 일괄옵션추가무게 설정 | string | Y |  | 0 | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요.<br>"상품상세 옵션값 노출 방식 선택"을 생략하실 경우 등록순 옵션이 노출됩니다.<br>"멀티옵션" 방식이 아닌 "싱글옵션" 방식 일 경우는 Element는 생략해주셔야 합니다.<br>멀티옵션은 옵션별 옵션무게 설정이 api 에서는 불가합니다. 일괄설정만 가능. |
| &nbsp;&nbsp;`prdExposeClfCd` | 상품상세 옵션값 노출 방식 선택 | enum |  |  | 00 | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요. (코드값: 00=등록순, 01=옵션값 가나다순, 02=옵션값 가나다 역순, 03=옵션가격 낮은 순, 04=옵션가격 높은 순) |
| &nbsp;&nbsp;`optMixYn` | 전체옵션 조합여부 | enum |  |  | N | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요. (코드값: Y=정의한 전체 옵션값이 조합되어 멀티옵션으로 등록, N=옵션 매핑Key에 존재하는(선택 된) 값으로만 멀티 옵션 등록) |
| &nbsp;&nbsp;`ProductOption` | ProductOption | object[] |  |  |  | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요. |
| &nbsp;&nbsp;&nbsp;&nbsp;`useYn` | 옵션상태 | enum | Y |  | Y | 멀티옵션일 경우는 지원하지 않는 기능입니다. (코드값: Y=사용함, N=품절) |
| &nbsp;&nbsp;&nbsp;&nbsp;`colOptPrice` | 옵션가 | string | Y |  | 100 | 기본 판매가의 +100%/-50%까지 설정하실 수 있습니다.<br>옵션가격이 0원인 상품이 반드시 1개 이상 있어야 합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`colValue0` | 옵션값 | string | Y |  | 파랑/XXL | 50Byte 까지만 입력가능하며 특수 문자[&#39;,",%,&,<,>,#,†]는 입력할 수 없습니다.<br>한 상품안에서 옵션값은 중복이 될수 없습니다.<br><br>* 11번가 신규상품의 경우 옵션 값 30자까지 지정 가능합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`colCount` | 옵션재고수량 | string | Y |  | 99 | 멀티옵션일 경우는 일괄설정이 되므로 입력하시면 안됩니다.<br>옵션상태(useYn)가 N일 때만 0 입력 가능합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`colSellerStockCd` | 셀러재고번호 | string | Y |  | 0 | 셀러가 사용하는 재고번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`optionImage` | 옵션이미지 | string |  |  |  | 우아(OOAh)서비스 상품일 경우 옵션이미지 등록이 가능합니다. 이미지 등록은 URL로 입력해 주셔야 합니다.<br>*옵션이미지의 경우 첫번째 옵션에 해당하는 항목들 기준으로만 등록이 가능합니다.<br>ex) RED - S, RED-M, RED-L / BLUE-S, BLUE-M, BLUE-L => RED, BLUE시에만 옵션이미지 등록 |
| &nbsp;&nbsp;`ProductRootOption` | ProductRootOption | object[] |  |  |  | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요. |
| &nbsp;&nbsp;&nbsp;&nbsp;`colTitle` | 옵션명 | string | Y |  | 색상/사이즈 | 최대 공백포함 25자까지 입력가능하며 일반상품의 경우 특수 문자,[,&,;,",%,&,<,>,#,†,]는 입력할 수 없습니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`ProductOption` | ProductOption | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`colOptPrice` | 옵션가 | string | Y |  | 100 | 기본 판매가의 +100%/-50%까지 설정하실 수 있습니다.<br>옵션가격이 0원인 상품이 반드시 1개 이상 있어야 합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`colValue0` | 옵션값 | string | Y |  | 파랑/XXL | 50Byte 까지만 입력가능하며 특수 문자[&#39;,",%,&,<,>,#,†]는 입력할 수 없습니다.<br>한 상품안에서 옵션값은 중복이 될수 없습니다.<br><br>* 11번가 신규상품의 경우 옵션 값 30자까지 지정 가능합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`optionImage` | 옵션이미지 | string |  |  |  | 우아(OOAh)서비스 상품일 경우 옵션이미지 등록이 가능합니다. 이미지 등록은 URL로 입력해 주셔야 합니다.<br>*옵션이미지의 경우 첫번째 옵션에 해당하는 항목들 기준으로만 등록이 가능합니다.<br>ex) RED - S, RED-M, RED-L / BLUE-S, BLUE-M, BLUE-L => RED, BLUE시에만 옵션이미지 등록 |
| &nbsp;&nbsp;`ProductOptionExt` | ProductOptionExt | object |  |  |  | "옵션등록"을 설정 하지 않을시에는 Element를 모두 삭제해 주세요. |
| &nbsp;&nbsp;&nbsp;&nbsp;`ProductOption` | ProductOption | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`useYn` | 옵션상태 | enum | Y |  |  | 멀티옵션일 경우는 지원하지 않는 기능입니다. (코드값: Y=사용함, N=품절) |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`colOptPrice` | 옵션가 | string | Y |  | 100 | 기본 판매가의 +100%/-50%까지 설정하실 수 있습니다.<br>옵션가격이 0원인 상품이 반드시 1개 이상 있어야 합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`colOptCount` | 선택형 멀티옵션 재고수량 | string | Y |  | 100 | 옵션 조합여부 구분 값을 N으로 사용하는 경우, 해당 컬럼을 이용하여 재고수량의 입력이 가능합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`colCount` | 옵션재고수량 | string | Y |  | 99 | 멀티옵션일 경우는 일괄설정이 되므로 입력하시면 안됩니다.<br>옵션상태(useYn)가 N일 때만 0 입력 가능합니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`optWght` | 옵션추가무게 | string | Y |  | 0 | 배송 주체(dlvClf) 코드가 03(11번가 해외 배송)인 경우 또는 "전세계배송 상품" 인경우 옵션 등록시 필수입니다. <br>단위 g |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`colSellerStockCd` | 셀러재고번호 | string | Y |  | 0 | 셀러가 사용하는 재고번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`optionMappingKey` | 옵션매핑Key | string | Y |  | 색상:퓨터그레이†사이즈:XL | 멀티옵션의 조합된 옵션을 매핑하기 위한 Key(예: 옵션명1:옵션값1†옵션명2:옵션값2) |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`optionImage` | 옵션이미지 | string |  |  |  | 옵션이미지<br>우아(OOAh)서비스 상품일 경우 옵션이미지 등록이 가능합니다. 이미지 등록은 URL로 입력해 주셔야 합니다.<br>*옵션이미지의 경우 첫번째 옵션에 해당하는 항목들 기준으로만 등록이 가능합니다.<br>ex) RED - S, RED-M, RED-L / BLUE-S, BLUE-M, BLUE-L => RED, BLUE시에만 옵션이미지 등록 |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `Products` | Products | object | Y |  |  |  |
| &nbsp;&nbsp;`message` | 결과내용 | string | Y |  |  | OpenAPI Key 에 해당하는 유저가 없습니다. |
