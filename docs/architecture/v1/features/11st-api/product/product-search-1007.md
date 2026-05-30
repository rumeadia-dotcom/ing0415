# Seller - 상품 - 다중 상품 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=39&apiSeq=1007&apiSpecType=1
> categoryNo: `39` · apiSeq: `1007` · 섹션: 상품 > 상품조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

11번가에 등록된 상품의 목록을 조회 합니다. 데이터 양이 많을 경우 정상 출력하지 못할수 있기 때문에 조회 조건 설정 부탁드립니다. 
limit는 가능한 작게 해주세요. (일괄 최대 500개 목록 조회 가능)

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `http://api.11st.co.kr/rest/prodmarketservice/prodmarket` |
| Protocol | http |
| Version | 1.2 |
| 요청 형식 | xml |
| 응답 형식 | xml |

## Request

### Request Body

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `SearchProduct` | SearchProduct | object | Y |  |  |  |
| &nbsp;&nbsp;`category1` | 대카테고리 | string |  |  |  |  |
| &nbsp;&nbsp;`category2` | 중카테고리 | string |  |  |  |  |
| &nbsp;&nbsp;`category3` | 소카테고리 | string |  |  |  |  |
| &nbsp;&nbsp;`category4` | 세카테고리 | string |  |  |  |  |
| &nbsp;&nbsp;`prdNo` | 상품번호 | string |  |  |  |  |
| &nbsp;&nbsp;`prdNm` | 상품명 | string |  |  |  |  |
| &nbsp;&nbsp;`selStatCd` | 판매상태 | enum |  |  |  | (코드값: 101=승인대기, 102=승인전, 103=판매중, 104=품절, 105=전시중지, 106=판매정상종료, 108=판매금지) |
| &nbsp;&nbsp;`selMthdCd` | 판매형태 | enum |  |  |  | (코드값: 01=고정가판매, 02=공동구매) |
| &nbsp;&nbsp;`schDateType` | 조회일자 타입 | enum |  |  |  | (코드값: 1=상품생성일 기준 조회, 2=상품판매일 기준 조회, 3=판매종료일 기준 조회, 4=상품수정일 기준 조회) |
| &nbsp;&nbsp;`schBgnDt` | 검색시작일 | string |  |  |  | 반드시 조회일자 타입과 동반되어야함. |
| &nbsp;&nbsp;`schEndDt` | 검색종료일 | string |  |  |  | 반드시 조회일자 타입과 동반되어야함. |
| &nbsp;&nbsp;`limit` | 목록갯수 | string | Y |  | 10 | 데이터의 양이 많은 경우 출력하지 못할 수도 있습니다. |
| &nbsp;&nbsp;`start` | 검색된 목록의 가져올 시작 순번 | string |  |  | 7 |  |
| &nbsp;&nbsp;`end` | 검색된 목록의 가져올 마지막 순번 | string |  |  | 17 |  |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:products` | ns2:products | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:product` | ns2:product | object[] | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`cuponcheck` | 즉시할인쿠폰 적용여부 | enum | Y |  | N | (코드값: Y=적용함, N=적용안함) |
| &nbsp;&nbsp;&nbsp;&nbsp;`dispCtgrNo` | 카테고리 번호 | string | Y |  | 19021 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`exchDlvCst` | 교환배송비 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`imageKindChk` | 11번가 시스템 코드 | string | Y |  | 01 | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNm` | 상품명 | string | Y |  | 판매자 상품코드 테스트(구매불가) |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  | 45705741 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`proxyYn` | 대행업체여부 | enum | Y |  | N | (코드값: Y=대행업체, N=대행업체아님) |
| &nbsp;&nbsp;&nbsp;&nbsp;`rootCtgrNo` | 11번가 시스템 코드 | string | Y |  | 0 | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`rtngdDlvCst` | 반품배송비 | string | Y |  | 0 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`selPrc` | 판매가 | string | Y |  | 100000000 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`selStatCd` | 판매자상태 | enum | Y |  | 103 | (코드값: 101=승인대기, 102=승인전, 103=판매중, 104=품절, 105=전시중지, 106=판매정상종료, 107=판매강제종료, 108=판매금지) |
| &nbsp;&nbsp;&nbsp;&nbsp;`selStatNm` | 판매자상태 이름 | string | Y |  | 판매중 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`sellerPrdCd` | 판매자상품코드 | string | Y |  | ctr555 | 상품등록시 등록한 판매자상품코드입니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`validateMsg` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdWght` | 상품무게 | string | Y |  |  | "전세계배송 상품" 인경우 설정되는 상품무게입니다. 조합형 옵션의 경우 일괄 상품무게 추가. 옵션설정을 안하셨다면 무시하셔도 됩니다. |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblDlvYn` | 전세계배송 이용여부 | enum | Y |  | N | (코드값: Y=이용, N=이용안함) |
| &nbsp;&nbsp;&nbsp;&nbsp;`gblHsCode` | 전세계배송 HSCode | string | Y |  |  | 해외현지 통관용으로 신고되는 HSCode 입니다.(http://soffice.11st.co.kr/download/product/gblHscodeList.xls) 참조 |
| &nbsp;&nbsp;&nbsp;&nbsp;`aplBgnDy` | 판매시작일 | string | Y |  | 2013-01-01 00:00:00 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`aplEndDy` | 판매종료일 | string | Y |  | 2013-02-01 23:59:59 |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`stdPrdYn` | 단일상품여부 | string | Y |  | Y/N | 11번가 단일상품 여부 |
| &nbsp;&nbsp;&nbsp;&nbsp;`ProductTag` | 태그 목록 | object |  |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`tagName` | 태그 | string[] |  |  |  |  |
