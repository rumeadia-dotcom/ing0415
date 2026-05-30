# 발송마감 템플릿 조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=43&apiSeq=6735&apiSpecType=1
> categoryNo: `43` · apiSeq: `6735` · 섹션: 상품 > 배송
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

등록한 발송마감 템플릿번호와 상세내용을 모두 조회할 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `http://api.11st.co.kr/rest/prodservices/sendCloseList` |
| Protocol | rest |
| Version | 1.0 |
| 응답 형식 | xml |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `productInformationTemplateList` |  | object | Y |  |  |  |
| &nbsp;&nbsp;`templateBOList` |  | object | Y |  |  |  |
| &nbsp;&nbsp;&nbsp;&nbsp;`memNo` |  | string | Y |  | 10000276 | 회원번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdInfoTmpltNm` |  | string | Y |  | 오전 9시까지, 토요일 오전 9시까지 주문완료 건 당일 발송처리 | 템플릿명 |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdInfoTmpltClfCd` |  | string | Y |  | 07 | 템플릿 구분코드 |
| &nbsp;&nbsp;&nbsp;&nbsp;`prdInfoTmpltNo` |  | string | Y |  | 344836 | 템플릿번호 |
| &nbsp;&nbsp;&nbsp;&nbsp;`repCloseTimeYn` |  | string | Y |  | Y | 대표마감시간 설정 유무 |
| &nbsp;&nbsp;&nbsp;&nbsp;`satPayCmplHm` |  | string | Y |  | 0900 | 토요일 발송마감 시간 |
| &nbsp;&nbsp;&nbsp;&nbsp;`satSendYn` |  | string | Y |  | Y | 토요일 발송 유무 |
| &nbsp;&nbsp;&nbsp;&nbsp;`sendClfCd` |  | string | Y |  | 02 | 발송방법(01:일반발송, 02:오늘발송, 03:재고확인 후 순차발송(소량재고/주문제작)) |
| &nbsp;&nbsp;&nbsp;&nbsp;`sendCmplTerm` |  | string | Y |  | 0 | 일반발송(1 ~ 2), 재고확인 후 순차발송 (3 ~ 7)<br> * 해외직구 상품은 최대 14일까지 조회가능 |
| &nbsp;&nbsp;&nbsp;&nbsp;`wkdayPayCmplHm` |  | string | Y |  | 0900 | 발송마감 시간 |
| &nbsp;&nbsp;&nbsp;&nbsp;`result_message` |  | string | Y |  | 성공 | 결과 |
