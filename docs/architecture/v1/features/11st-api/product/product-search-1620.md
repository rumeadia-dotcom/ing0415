# Seller - 상품 - 신규 상품 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=39&apiSeq=1620&apiSpecType=1
> categoryNo: `39` · apiSeq: `1620` · 섹션: 상품 > 상품조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

11번가에 등록된 상품의 정보를 상품번호로 조회 합니다. 상품번호는 상품등록시 받으실 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/prodmarketservice/prodmarket/[prdNo]` |
| Protocol | http |
| Version | 1.3 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `prdNo` | 상품번호 | string | Y |  | 45597077 | 상품등록시 받으실 수 있습니다. |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `Product` | Product | object | Y |  |  |  |
| &nbsp;&nbsp;`asDetail` | AS안내정보 | string | Y |  | . |  |
| &nbsp;&nbsp;`bndlDlvCnYn` | 묶음배송여부 | enum | Y |  | N | (코드값: Y=묶음배송, N=묶음배송아님) |
| &nbsp;&nbsp;`cuponcheck` | 즉시할인쿠폰 적용여부 | enum | Y |  | N | (코드값: Y=적용함, N=적용안함) |
| &nbsp;&nbsp;`dispCtgrNo` | 카테고리 번호 | string | Y |  | 4212 |  |
| &nbsp;&nbsp;`dispCtgrStatCd` | 카테고리 상태코드 | enum | Y |  | 03 | 11번가 시스템 코드입니다. (코드값: 03=카테고리번호가 전시중인 상태, 04=카테고리번호가 전시안함 상태) |
| &nbsp;&nbsp;`exchDlvCst` | 교환배송비 | string | Y |  | 2500 |  |
| &nbsp;&nbsp;`htmlDetail` | 상품상세정보 | string | Y |  | ..<table cellspacing="0" cellpadding="0" width="780" border="0"> <tbody> <tr><td style="font-weight: bold; font-size: 14… | 상품등록시 작성하신 상품상세정보 HTML |
| &nbsp;&nbsp;`imageKindChk` | 11번가 시스템 코드 | string | Y |  | 01 | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`message` | 처리결과 메시지 | string | Y |  | [45597077] 상품 정보가 정상적으로 조회되었습니다. |  |
| &nbsp;&nbsp;`optionAllAddPrc` | 조합형 옵션의 경우 일괄 옵션가 | string | Y |  | 0 | 상품등록시 옵션설정을 안하셨다면 무시하셔도 됩니다. |
| &nbsp;&nbsp;`optionAllQty` | 조합형 옵션의 경우 일괄 재고수량 | string | Y |  | 0 | 상품등록시 옵션설정을 안하셨다면 무시하셔도 됩니다. |
| &nbsp;&nbsp;`outsideYnIn` | 해외 반품/교환지 주소 여부 | enum | Y |  | N | (코드값: Y=반품/교환지가 해외, N=반품/교환지가 국내) |
| &nbsp;&nbsp;`outsideYnOut` | 해외 출고지 주소 | enum | Y |  | N | (코드값: Y=출고지가 해외, N=출고지가 국내) |
| &nbsp;&nbsp;`prdNm` | 상품명 | string | Y |  | 싸이닉 정품을 하나 더!!! 1+1 특급이벤트! |  |
| &nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  | 45597077 |  |
| &nbsp;&nbsp;`prcDscCmpExpYn` | 가격비교 사이트 할인 적용 여부 | enum | Y |  | Y | (코드값: Y=가격비교 사이트 할인 적용함, N=가격비교 사이트 할인 적용안함) |
| &nbsp;&nbsp;`proxyYn` | 대행업체여부 | enum | Y |  | N | (코드값: Y=대행업체, N=대행업체아님) |
| &nbsp;&nbsp;`rootCtgrNo` | 11번가 시스템 코드 | string | Y |  | 0 | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`rtngdDlvCst` | 반품배송비 | string | Y |  | 2300 |  |
| &nbsp;&nbsp;`selPrc` | 판매가 | string | Y |  | 12000 |  |
| &nbsp;&nbsp;`selPrdClfCd` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`dscAmtPercnt` | 할인수치 | string | Y |  | 100 | 기본즉시할인 설정한 경우에만 노출 |
| &nbsp;&nbsp;`cupnDscMthdCd` | 할인단위 | enum | Y |  | 01 | 기본즉시할인 설정한 경우에만 노출 (코드값: 01=원, 02=%) |
| &nbsp;&nbsp;`selStatCd` | 판매자상태 | enum | Y |  | 103 | (코드값: 101=승인대기, 102=승인전, 103=판매중, 104=품절, 105=전시중지, 106=판매정상종료, 108=판매금지) |
| &nbsp;&nbsp;`selStatNm` | 판매상태 | string | Y |  | 판매중 |  |
| &nbsp;&nbsp;`selTermUseYn` | 11번가 시스템 코드 | string | Y |  | Y | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`sellerItemEventYn` | 포인트 적립 여부 | enum | Y |  | N | (코드값: Y=포인트 적립함, N=포인트 적립안함) |
| &nbsp;&nbsp;`sellerPrdCd` | 판매자상품코드 | string | Y |  | crt555 | 상품등록시 등록한 판매자상품코드입니다. |
| &nbsp;&nbsp;`dlvClf` | 배송주체(배송유형). | enum | Y |  | 02 | 일반적으로 업체배송이고, 11번가 통합 출고지를 사용하는 경우 11번가 배송, 11번가 해외 통합 출고지를 사용하는 경우 11번가 해외배송이 됩니다. (코드값: 01=11번가 배송, 02=업체배송, 03=11번가 해외 배송) |
| &nbsp;&nbsp;`abrdCnDlvCst` | 해외 취소 배송비 | string | Y |  |  | 배송주체(유형) dlvClf이 03(11번가해외배송)인 경우, 설정되는 해외 취소 배송비입니다. |
| &nbsp;&nbsp;`abrdInCd` | 해외 입고 유형 | enum | Y |  |  | (코드값: 01=무료픽업, 02=판매자발송, 03=구매대행) |
| &nbsp;&nbsp;`prdWght` | 상품무게 | string | Y |  |  | 배송주체(유형) dlvClf이 03(11번가해외배송)인 경우 또는 "전세계배송 상품" 인경우 설정되는 상품무게입니다. 조합형 옵션의 경우 일괄 상품무게 추가. 옵션설정을 안하셨다면 무시하셔도 됩니다. |
| &nbsp;&nbsp;`validateMsg` | 11번가 시스템 코드 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`gftPackTypCd` | 선물포장 유형코드 | enum |  |  | 01 | (코드값: 01=불가, 02=선물포장, 03=포장재동봉, 04=선물포장+포장재동봉) |
| &nbsp;&nbsp;`gblDlvYn` | 전세계배송 이용여부 | enum | Y |  | N | (코드값: Y=이용, N=이용안함) |
| &nbsp;&nbsp;`ntNo` | 생산지국가코드(통관용) | string | Y |  |  | http://soffice.11st.co.kr/download/product/nationList.xls 참초 |
| &nbsp;&nbsp;`gblHsCode` | 전세계배송 HSCode | string | Y |  |  | 해외현지 통관용으로 신고되는 HSCode 입니다.(http://soffice.11st.co.kr/download/product/gblHscodeList.xls) 참조 |
| &nbsp;&nbsp;`aplBgnDy` | 판매시작일 | string | Y |  | 2013-01-01 00:00:00 |  |
| &nbsp;&nbsp;`aplEndDy` | 판매종료일 | string | Y |  | 2013-02-01 23:59:59 |  |
| &nbsp;&nbsp;`shopNo` | 상점번호 | string | Y |  |  |  |
| &nbsp;&nbsp;`ntShortNm` | 원산지 국가 번호 | string | Y |  |  |  |
| &nbsp;&nbsp;`preSelPrc` | 수정 전 판매가 | string | Y |  |  |  |
| &nbsp;&nbsp;`hopeShpPntRt` | 희망후원 설정율 | string | Y |  |  |  |
| &nbsp;&nbsp;`hopeShpPnt` | 희망후원 설정액 | string | Y |  |  |  |
| &nbsp;&nbsp;`hopeShpWyCd` | 적립단위 코드 | enum | Y |  |  | (코드값: 01=%, 02=원) |
| &nbsp;&nbsp;`selMnbdNckNm` | 닉네임 | string | Y |  |  | 무시 하셔도 됩니다. 11번가 시스템 코드 |
| &nbsp;&nbsp;`stdPrdYn` | 신규상품여부 | string | Y |  | Y/N | 11번가 신규상품 여부를 Y/N으로 내려드립니다. |
| &nbsp;&nbsp;`nResult` | 11번가 시스템 코드 | string | Y |  |  |  |
| &nbsp;&nbsp;`cupnUseLmtDyYn` | 할인 적용기간 설정여부 | enum |  |  |  | "기본즉시할인"을 설정 하는 경우 (코드값: Y=설정함, N=설정안함) |
| &nbsp;&nbsp;`cupnIssEndDy` | 할인적용기간 종료일 | string |  |  |  |  |
| &nbsp;&nbsp;`ProductTag` | 태그 목록 | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`tagName` | 태그 | string[] |  |  |  |  |
