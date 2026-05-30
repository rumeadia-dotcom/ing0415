# Seller - 상품 - 셀러 상품 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=39&apiSeq=1621&apiSpecType=1
> categoryNo: `39` · apiSeq: `1621` · 섹션: 상품 > 상품조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

11번가에 등록된 상품의 정보를 판매자 상품코드로 조회 합니다. 상품등록시 판매자 상품코드를 등록한 코드입니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/prodmarketservice/sellerprodcode/[sellerprdcd]` |
| Protocol | http |
| Version | 1.1 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `sellerprdcd` | 판매자상품코드 | string | Y |  | ctr555 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:products` | ns2:products | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:product` | ns2:product | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`bndlDlvCnYn` | 묶음배송여부 | enum | Y |  | N | (코드값: Y=묶음배송, N=묶음배송아님) |
| &nbsp;&nbsp;&nbsp;&nbsp;`cuponcheck` | 즉시할인쿠폰 적용여부 | enum | Y |  | N | (코드값: Y=적용함, N=적용안함) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dispCtgrNo` | 카테고리 번호 | string | Y |  | 19021 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`dispCtgrStatCd` | 카테고리 상태코드 | enum | Y |  | 03 | 11번가 시스템 코드입니다. (코드값: 03=카테고리번호가 전시중인 상태, 04=카테고리번호가 전시안함 상태) |
| &nbsp;&nbsp;&nbsp;&nbsp;`exchDlvCst` | 교환배송비 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`imageKindChk` | 11번가 시스템 코드 | string | Y |  | 01 | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`optionAllAddPrc` | 조합형 옵션의 경우 일괄 옵션가. | string | Y |  | 0 | 상품등록시 옵션설정을 안하셨다면 무시하셔도 됩니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`optionAllQty` | 조합형 옵션의 경우 일괄 재고수량 | string | Y |  | 0 | 상품등록시 옵션설정을 안하셨다면 무시하셔도 됩니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`outsideYnIn` | 해외 반품/교환지 주소 여부 | enum | Y |  | N | (코드값: Y=반품/교환지가 해외, N=반품/교환지가 국내) |
| &nbsp;&nbsp;&nbsp;&nbsp;`outsideYnOut` | 해외 출고지 주소 | enum | Y |  | N | (코드값: Y=출고지가 해외, N=출고지가 국내) |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y |  | 판매자 상품코드 테스트(구매불가) |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  | 45705741 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prcDscCmpExpYn` | 가격비교 사이트 할인 적용 여부 | enum | Y |  | Y | (코드값: Y=가격비교 사이트 할인 적용함, N=가격비교 사이트 할인 적용안함) |
| &nbsp;&nbsp;&nbsp;&nbsp;`proxyYn` | 대행업체여부 | enum | Y |  | N | (코드값: Y=대행업체, N=대행업체아님) |
| &nbsp;&nbsp;&nbsp;&nbsp;`rootCtgrNo` | 11번가 시스템 코드 | string | Y |  | 0 | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`rtngdDlvCst` | 반품배송비 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`selPrc` | 판매가 | string | Y |  | 100000000 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`selPrdClfCd` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`selStatCd` | 판매자상태 | enum | Y |  | 103 | (코드값: 101=승인대기, 102=승인전, 103=판매중, 104=품절, 105=전시중지, 106=판매정상종료, 108=판매금지) |
| &nbsp;&nbsp;&nbsp;&nbsp;`selStatNm` | 판매자상태 이름 | string | Y |  | 판매중 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`selTermUseYn` | 11번가 시스템 코드 | string | Y |  | Y | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerItemEventYn` | 포인트 적립 여부 | enum | Y |  | N | (코드값: Y=포인트 적립함, N=포인트 적립안함) |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerPrdCd` | 판매자상품코드 | string | Y |  | ctr555 | 상품등록시 등록한 판매자상품코드입니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`validateMsg` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`gftPackTypCd` | 선물포장 유형코드 | enum |  |  |  | (코드값: 01=불가, 02=선물포장, 03=포장재동봉, 04=선물포장+포장재동봉) |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdWght` | 상품무게 | string | Y |  |  | "전세계배송 상품" 인경우 설정되는 상품무게입니다. 조합형 옵션의 경우 일괄 상품무게 추가. 옵션설정을 안하셨다면 무시하셔도 됩니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblDlvYn` | 전세계배송 이용여부 | enum | Y |  | N | (코드값: Y=이용, N=이용안함) |
| &nbsp;&nbsp;&nbsp;&nbsp;`ntNo` | 생산지국가코드(통관용) | string | Y |  |  | (http://soffice.11st.co.kr/download/product/nationList.xls) 참조 |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblHsCode` | 전세계배송 HSCode | string | Y |  |  | 해외현지 통관용으로 신고되는 HSCode 입니다.(http://soffice.11st.co.kr/download/product/gblHscodeList.xls) 참조 |
| &nbsp;&nbsp;&nbsp;&nbsp;`aplBgnDy` | 판매시작일 | string | Y |  | 2013-01-01 00:00:00 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`aplEndDy` | 판매종료일 | string | Y |  | 2013-02-01 23:59:59 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`stdPrdYn` | 신규상품여부 | string | Y |  | Y/N | 11번가 신규상품 여부입니다. |
