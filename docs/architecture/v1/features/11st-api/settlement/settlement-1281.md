# 정산내역조회

> 출처: https://openapi.11st.co.kr/openapi/OpenApiGuide.tmall?categoryNo=151&apiSeq=1281&apiSpecType=1
> categoryNo: `151` · apiSeq: `1281` · 섹션: 정산 > 정산조회
> 추출 시점: 2026-05-30 · 11번가 셀러 OpenAPI (인증 세션 필요)

---

## 개요

기간별 정산내역을 조회할 수 있습니다. 
조회기간은 최대 31일이며, 모든 정산대상과목이 조회됩니다. 
조회데이터는 전일자 구매확정 기준, 정산예정금액으로 정산보류금액과 미수금이 반영되는 실제 송금금액과는 차이가 있을 수 있습니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `https://api.11st.co.kr/rest/settlement/settlementList/[startTime]/[endTime]` |
| Protocol | https |
| Version | 0.1 |
| 응답 형식 | xml |

## Request

### Path Variable

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `startTime` | 검색시작일 | string | Y |  | 20230101 | YYYYMMDD. 날짜포멧 : 년(4) 월(2) 일(2) |
| `endTime` | 검색종료일 | string | Y |  | 20230102 | YYYYMMDD. 날짜포멧 : 년(4) 월(2) 일(2) |

## Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:seStlDtlList` | ns2:seStlDtlList | object | Y |  |  |  |
| &nbsp;&nbsp;`abrdCnDlvCst` | 해외취소배송비 | string | Y |  |  |  |
| &nbsp;&nbsp;`addClmDlvCst` | 반품추가배송비 | string | Y |  |  |  |
| &nbsp;&nbsp;`bmClmFstDlvCst` | 도서산간초도배송비 | string | Y |  |  |  |
| &nbsp;&nbsp;`bmStlDlvCst` | 도서산간배송비 | string | Y |  |  |  |
| &nbsp;&nbsp;`cardDscSellerDfrmAmt` | 판매자부담 카드추가할인 | string | Y |  |  |  |
| &nbsp;&nbsp;`clmDlvCst` | 반품/교환 배송비 | string | Y |  |  |  |
| &nbsp;&nbsp;`clmFstDlvCst` | 초도배송비 | string | Y |  |  |  |
| &nbsp;&nbsp;`clmReqSeq` | 클레임번호 | string | Y |  |  |  |
| &nbsp;&nbsp;`cupnAmt` | 판매자할인쿠폰 | string | Y |  |  |  |
| &nbsp;&nbsp;`debaGtnStlAmt` | 알비백 보증금 | string | Y |  |  |  |
| &nbsp;&nbsp;`deductAmt` | 공제금액 | string | Y |  |  |  |
| &nbsp;&nbsp;`dlvAmt` | 선결제배송비 | string | Y |  |  |  |
| &nbsp;&nbsp;`dlvNo` | 배송번호 | string | Y |  |  |  |
| &nbsp;&nbsp;`feeTypeNm` | 서비스이용료 | string | Y |  |  | 동의/미동의/별도계약/고정 |
| &nbsp;&nbsp;`memId` | 회원ID | string | Y |  |  |  |
| &nbsp;&nbsp;`memNm` | 회원명 | string | Y |  |  |  |
| &nbsp;&nbsp;`optAmt` | 옵션가 | string | Y |  |  |  |
| &nbsp;&nbsp;`ordNo` | 주문번호 | string | Y |  |  |  |
| &nbsp;&nbsp;`ordPrdSeq` | 주문순번 | string | Y |  |  |  |
| &nbsp;&nbsp;`ordPrdSeq` | 주문순번 | string | Y |  |  |  |
| &nbsp;&nbsp;`ordQty` | 주문수량 | string | Y |  |  |  |
| &nbsp;&nbsp;`ordStlEndDt` | 결제완료일 | string | Y |  |  | YYYYMMDD. 날짜포멧 : 년(4) 월(2) 일(2) |
| &nbsp;&nbsp;`pocnfrmDt` | 구매확정일 | string | Y |  |  | YYYYMMDD. 날짜포멧 : 년(4) 월(2) 일(2) |
| &nbsp;&nbsp;`prdNm` | 상품명 | string | Y |  |  |  |
| &nbsp;&nbsp;`prdNo` | 상품번호 | string | Y |  |  |  |
| &nbsp;&nbsp;`sbdscFlctnStlAmt` | [정산]스토어묶음할인 | string | Y |  |  |  |
| &nbsp;&nbsp;`sbdscSellerDfrmAmtSum` | [공제]스토어묶음할인 | string | Y |  |  | (스토어묶음할인공제+변동할인공제) |
| &nbsp;&nbsp;`selFee` | 수수료 | string | Y |  |  |  |
| &nbsp;&nbsp;`selFixedFee` | 기본서비스이용료율 | string | Y |  |  | (0.00%) |
| &nbsp;&nbsp;`selPrc` | 판매가 | string | Y |  |  | (판매단가*(주문수량-취소수량)) |
| &nbsp;&nbsp;`selPrcAmt` | 판매금액합계 | string | Y |  |  | (판매가+옵션가+배송비+해외취소배송비+반품배송비) |
| &nbsp;&nbsp;`sellerCupnAmt` | 판매자기본할인금액 | string | Y |  |  |  |
| &nbsp;&nbsp;`sellerDfrmAppDlvAmt` | 지정택배이용료 | string | Y |  |  |  |
| &nbsp;&nbsp;`sellerDfrmDeferredAdFee` | 후불광고비 | string | Y |  |  |  |
| &nbsp;&nbsp;`sellerDfrmGblCnDlvCst` | 전세계배송 판매자책임반품 | string | Y |  |  |  |
| &nbsp;&nbsp;`sellerDfrmGblDlvFee` | 수출대행수수료 | string | Y |  |  |  |
| &nbsp;&nbsp;`sellerDfrmIntfreeFee` | 무이자할부수수료 | string | Y |  |  |  |
| &nbsp;&nbsp;`sellerDfrmMultiDscCst` | 복수구매할인금액 | string | Y |  |  |  |
| &nbsp;&nbsp;`sellerDfrmOcbAmt` | ocb공제금액 | string | Y |  |  |  |
| &nbsp;&nbsp;`sellerDfrmPntPrd` | 포인트공제금액 | string | Y |  |  |  |
| &nbsp;&nbsp;`sellerPrdNo` | 판매자상품코드 | string | Y |  |  |  |
| &nbsp;&nbsp;`seqNo` | NO | string | Y |  |  |  |
| &nbsp;&nbsp;`slctPrdOptNm` | 옵션명 | string | Y |  |  |  |
| &nbsp;&nbsp;`sndEndDt` | 발송완료일 | string | Y |  |  | (YYYY/MM/DD) |
| &nbsp;&nbsp;`stlAmt` | 정산금액 | string | Y |  |  | (정산금액 - 공제금액) |
| &nbsp;&nbsp;`stlDy` | 정산일 | string | Y |  |  | (YYYY/MM/DD) |
| &nbsp;&nbsp;`stlPlnDy` | 송금예정일 | string | Y |  |  | (YYYY/MM/DD) |
| &nbsp;&nbsp;`tmallApplyDscAmt` | 판매자추가할인 | string | Y |  |  |  |
| &nbsp;&nbsp;`tmallOverDscAmt` | 11번가추가할인 | string | Y |  |  |  |
| &nbsp;&nbsp;`trtEndDt` | 반품완료일자 | string | Y |  |  | (YYYY/MM/DD) |
| &nbsp;&nbsp;`totalCount` | 총갯수 | string | Y |  |  |  |

## Error Response

| 필드 | 한글명 | 타입 | 필수 | 길이 | 예시 | 설명 |
|---|---|---|---|---|---|---|
| `ns2:orders` | ns2:orders | object | Y |  |  |  |
| &nbsp;&nbsp;`ns2:result_code` | 결과코드 | enum | Y |  |  | (코드값: 0=조회된 결과가 없습니다., 2=최대 31일까지만 조회가능합니다., 1000=서버 점검중입니다.) |
| &nbsp;&nbsp;`ns2:result_text` | 결과내용 | string | Y |  | 조회된 결과가 없습니다. |  |

## Sample Code (java)

```java
import ***.HttpClient;
import ***.GetMethod;
public class test_api_get { //결제대기 내역
    public static void main(String[] args) {
        GetMethod Get = new GetMethod("https://api.11st.co.kr/ rest/settlement/settlementList/20131001/20131031");
        Get.setRequestHeader("openapikey", "<OPENAPI_KEY>"); //SampleKey 사용불가
        HttpClient httpclient = new HttpClient();
        try {
            httpclient.executeMethod(Get);
            System.out.println( "[MSG] StatusCode : " + Get.getStatusCode() );
            System.out.println( "[MSG] Result -Xml : " + Get.getResponseBodyAsString() );
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            Get.releaseConnection();
        }
    }
}
```

## Sample Code (php)

```php
<?php
    $ch = curl_init();
    $headers = array("Content-type: text/xml;charset=EUC-KR", "openapikey:<OPENAPI_KEY>")); //SampleKey 사용불가
    curl_setopt($ch, CURLOPT_URL, "https://api.11st.co.kr/ rest/settlement/settlementList/20131001/20131031");
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $return=curl_exec($ch);
    echo "[MSG] Result -Xml : \n";
    echo $return;
?>
```

## Sample Code (asp)

```asp
<%
    &#39;결제대기 내역
    set api = createobject("msxml2.serverXmlhttp")
    api.open "GET", "https://api.11st.co.kr/ rest/settlement/settlementList/20131001/20131031", false
    api.setRequestHeader "openapikey","<OPENAPI_KEY>" &#39;SampleKey 사용불가
    api.send

    &#39;response.write "[statusCode : "&api.status&"]"
    Response.Write api.responseText

    set api = nothing
    response.end
%>
```
