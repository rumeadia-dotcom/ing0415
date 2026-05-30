# G마켓 · 옥션 (ESM) Open API — 가이드

> 출처: <https://etapi.gmarket.com/pages/API-%EA%B0%80%EC%9D%B4%EB%93%9C>
> 마켓: G마켓 · 옥션 (ESM Plus 통합 셀러 플랫폼)
> 추출 시점: 2026-05-29

이 디렉토리(`esm-api/`)는 G마켓·옥션 ESM Trading(Selling) OpenAPI 의 영구 spec 인덱스다. ESM Plus 는 G마켓·옥션 공용 플랫폼이라 두 마켓이 동일 spec 을 공유한다. 섹션별 article 목록은 [`docs/handoff/esm-api-index.md`](../../../../handoff/esm-api-index.md) 참조.

> ⚠️ 본문 내 kakaocdn 이미지 URL 은 만료 서명(`expires=...`)이 붙어 있어 시간이 지나면 깨질 수 있다. 이미지는 보조 참조용이며, 정확한 내용은 출처 URL 확인.

---

### **1. API 사용 관련**

- 지마켓, 옥션 판매자 회원이어야 하며 ESM+ 로그인하여 마스터 ID 도 생성되어야 합니다.
- 셀링툴 업체 경우도 업체 사업자 정보로 지마켓, 옥션 사이트별 판매자 회원 가입 필수 입니다. 업체 사업자로 가입하지 않은 경우 권한 부여 불가합니다.
- 신청 승인은 사이트 검색성능 및 서비스 안정성을 저해하지 않는 수준 내 내부 지원 리소스 한도 내에서 가능합니다.
- 내부 사정에 따라 신청 하였으나 권한 부여 거절될 수 있음을 미리 양해 부탁 드립니다.
- 궁금하신 점은 [etapihelp@gmail.com](mailto:etapihelp@gmail.com) 메일로 주시면 확인 후 순차적으로 회신 드릴 예정입니다.

|  |
| --- |
| **[사용 신청 메일 Sample]** |
| - 개발 API 범위 : 상품 관리, 주문/클레임 관리, CS (문의 응대) 관리, 정산 관리 - ESM 마스터 ID :  - 서비스 중인 사이트 Url : (자사 사이트 또는 판매 상품 확인 가능 url) - 최근 3개월 매출 규모 :   - API 개발 기간 : \*\*년 \*월 \*일 ~ \*\*년 \*월 \*일  ※ 셀링툴 서비스사 경우 소개 자료 및 현재 이용중인 G마켓/옥션 사이트별 각각 판매자 수 공유 필요 |

### **2. API 개발 가이드**

- API는 상품/주문/배송/클레임/정산/CS/서비스 별로 구성되어 있으며 가이드는 상단 메뉴별로 확인하실 수 있습니다.
- API 개발 완료 후 개발 사항 테스트 완료되면 일정 협의하여 운영에서 실사용하실 수 있습니다.

### **3. API 이해하기**

|  |
| --- |
| **Description** |
| ESM Trading API를 사용하기 위해서는 Header에 아래 내용을 참고한 인증값을 설정합니다. (모든 API 동일) ESM Trading API 인증은 정상적으로 발급된 키의 사용자인지, 허용된 서버(IP address)에서 전달된 요청인지, 요청이 전달되는 과정에서 악의적으로 요청이 오염되었는지를 체크합니다. 권한은 인증된 사용자라 해도 특정 리소스(API)에 접근이 허용된 사용자인지를 판단합니다. 따라서, API를 사용할 때는 인증 및 권한도 부여받아야 합니다 |

#### 

#### **API 인증방식**

public/private key를 이용한 JWT 인증 방식([JWT](https://jwt.io/introduction/) 참고)

- HMAC 해싱 방식으로 생성된 비밀키(Secret Key)를 사용자에게 발행하며 Secret Key로 header와 payload를 해싱한 signature를 생성해서 JWT(JSON Web Token)을 만들어 이를 Http 헤더를 통해 API 인증 서버로 전송하는 방식으로 처리됩니다.
- 이런 과정을 통해 획득한 key pair를 사용해서 클라이언트는 API 인증 서버가 요구하는 값을 Base64로 인코딩하고 Signature를 생성해 API 호출 시 Header를 통해 전달합니다. Selling API는 호출 직전에 인증 및 권한을 체크하기 위해 인증 시스템이 요청을 확인하고 API의 사용 가능 여부를 판단합니다. 인증/권한 체크에서 실패가 떨어지면 인증 시스템은 요청을 중간에 차단하고 바로 UnAuthorization 오류를 클라이언트에 전달합니다. 하지만 인증/권한 체크가 통과하면 클라이언트의 요청은 호출한 API로 전달되고 그 결과가 클라이언트에 리턴됩니다.

![](https://blog.kakaocdn.net/dna/lLy2Z/btrJLTJrrLl/AAAAAAAAAAAAAAAAAAAAACJ0EzWYCDzjHHG90mKTiLEulev17ZoZ-IMPGeu5sE1u/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1780239599&allow_ip=&allow_referer=&signature=s%2FKU7t%2FwqwBlxhCg4zoNvN6cN3o%3D)

인증 도식화

#### API 인증 토큰 구성 및 Sample Code

인증 토큰은 아래와 같이, Header와 Payload, Signature를 “.” 으로 연결하는 형태로 구성됩니다.

![](https://blog.kakaocdn.net/dna/8Hzjr/btrJHez5TEA/AAAAAAAAAAAAAAAAAAAAADDx3rYeQMIwimHhZzjlm1lWujepIzbUOI5naUSb3Skr/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1780239599&allow_ip=&allow_referer=&signature=nEHBtLalMIv63ZkzI8MszXwtxTY%3D)

Header는 해싱(hashing) 알고리즘을 정의하는 정보와 사용자의 Identity를 나타내는 값으로 구성되며, 아래와 같이 json 포맷으로 표현하고 base64로 인코딩합니다.

```
{
	"alg": "HS256", // 인증 알고리즘
	"typ": "JWT", // 인증방식
	"kid": "{master id}" // ESM+ Master ID 입력
}
```

Payload는 사용자에 관한 정보와 몇 가지 API에 대한 메타 데이터를 포함하는 json 포맷의 구조로 Header와 마찬가지로 base64로 인코딩 됩니다.

```
{
	"iss": "{token issuer}", // 토큰 발행자. 보통 클라이언트 도메인 주소 사용 ex)www.shinsegaemall.ssg.com, www.playauto.com
	"sub": "{domain}", // Sell API는 "sell"
	"aud": "sa.esmplus.com", // 좌측 정보로 고정해서 사용
	"iat": "{issued timestamp(long type)}", // JWT 발행 시간 (필수 정보 아님)
	"ssi": "{site Id}:{site seller id}" // Site Id : 옥션“A”,지마켓“G”입력
}
```

Signature는 위에서 정의한 Header와 Payload 값을 사용해서 해싱하여 고유의 기호를 만들어 내는 작업입니다. 마찬가지로 base64로 인코딩된 Header와 Payload 값을 사용해서 HmacSHA256으로 값을 해싱합니다.

```
HS256(base64UrlEncode(header) + "." +base64UrlEncode(payload), secret key)
```

**Sample Code**  
예를 들어, sell 도메인의 특정 API를 호출하려는 사용자가 있는데, 이 사용자의 ESM+의 masterId는 “test\_masterId\_1” 이며 Selling API를 사용하기 위해 발급받은 Access Key는 입니다.

```
ZDE2YjlmZjUtYTc0Mi00ZWU3
```

그리고, 이 요청을 보내는 시점을 “2017-08-21 14:40:00(KST 기준)”라고 했을 때 이 값을 timestamp로 변환하면 “1503294000”가 됩니다. (timestamp 변환은 <https://www.epochconverter.com> / 참조)

그럼 이 상황대로 토큰을 발행하기 위해 Header와 Payload 값을 구성해 보면 아래와 같습니다.

- 셀링툴사의 경우, kid는 무조건 셀링툴사의 마스터ID를 넣어주셔야 합니다.

```
Header
{
	"alg": "HS256",
	"typ": "JWT",
	"kid": "ESM+마스터ID"
}
```

```
Payload
{
	"iss": "www.esmplus.com",
	"sub": "sell",
	"aud": "sa.esmplus.com", //  좌측 정보 고정해서 사용
	"ssi": "A:옥션판매자ID,G:지마켓판매자ID" // "," 구분자로 지마켓/옥션 ID 입력 가능(단 1개씩)
}
```

그리고, 이 Header와 Payload를 base64로 인코딩한 후 Secret Key로 해싱해서 각각 아래와 같은 값들을 얻었다고 가정해 보면,

```
Base64 encoded Header: "4eadf432lkjavnasdfkje32lkadjsf09"
Base64 encoded Payload: "zxcvlkjq234i8jl/+02jkldq341lkjzxdfckj"
Signature: "MIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8AgEAAkEAsEdjazrTLHbg4z9CgYQrg+1O"
```

이 요청의 토큰은 아래와 같이 됩니다. (“.”으로 구분된 형태 확인)

```
"Authorization" : "Bearer 4eadf432lkjavnasdfkje32lkadjsf09.zxcvlkjq234i8jl/+02jkldq341lkjzxdfckj.MIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8AgEAAkEAsEdjazrTLHbg4z9CgYQrg+1O"
```

#### API 요청 보내기/결과

토큰을 생성했다면, 이제 API를 호출하면 됩니다. API를 호출할 때는 인증 과정을 통과하기 위해서 Http Request의 Header에 인증 토큰을 실어 보내야 합니다. 토큰을 실어 보낼 Http Header의 키는 "Authorization"이며, 스키마는 Bearer입니다. 그래서, 요청을 보낼 때는 Http Header에 아래의 키/값을 추가해야 합니다. (참고로, Authorization 헤더 값의 포맷은 “{Schema} {Token}” 입니다.)

```
// http header
“Authorization” : “Bearer 4eadf432lkjavnasdfkje32lkadjsf09.zxcvlkjq234i8jl/+02jkldq341lkjzxdfckj.MIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8AgEAAkEAsEdjazrTLHbg4z9CgYQrg+1O”
```

Http Header에 Authorization 키로 토큰을 실어 보냈고 Selling API 인증 시스템에서 전달된 토큰으로 문제없이 인증과 권한을 모두 통과했다면 API 호출은 정상적으로 API 서버에 전달될 것입니다. 그리고 처리 결과는 클라이언트에 리턴 됩니다.  
하지만, 인증 또는 권한에서 요구하는 조건을 만족시키지 못했다면 요청은 API 서버로 전달되지 않고 곧바로 Selling API 인증 시스템에서 클라이언트로 오류를 리턴하게 되며 리턴 결과는 상황에 맞는 Http Status Code가 전달됩니다.

예를 들면, 접근 권한이 없는 API에 요청을 보내면 아래와 같은 결과가 클라이언트로 리턴 됩니다.

```
{
	"status": {
		"message": "The user does not have right access to the api",
		"status_code": 401
	}
}
```

JWT를 소개하고 있는, jwt.io 웹사이트에서는 다양한 플랫폼별로 사용할 수 있는 jwt 라이브러리들 역시 소개하고 있습니다.  
<https://jwt.io> 웹사이트에 접근 후, 상단의 “Libraries” 메뉴를 보면 다양한 플랫폼별로 여러 개의 라이브러리가 제공되고 있는 것을 쉽게 알 수 있습니다. 따라서, 개발 플랫폼에 맞는 라이브러리들을 선택해서 쉽게 인증 코드를 구현할 수 있습니다.

---

## 프로젝트 연동 메모

- **인증 = JWT(HMAC-SHA256)**. Secret Key 로 `base64(header).base64(payload)` 를 HmacSHA256 해싱한 signature 를 합쳐 `Authorization: Bearer <h>.<p>.<sig>` 로 전송 (모든 API 공통).
  - `header.kid` = ESM+ 마스터 ID (셀링툴사는 셀링툴사 마스터 ID).
  - `payload.aud` = `sa.esmplus.com` 고정, `payload.sub` = `sell`.
  - `payload.ssi` = `{siteId}:{판매자ID}` — **옥션=`A`, 지마켓=`G`**. 한 토큰에 `,` 구분으로 둘 다 가능(각 1개씩). → 동일 자격증명 1쌍으로 G마켓·옥션 동시 호출 가능 (어댑터 1개로 2마켓 커버 근거).
- **호출자 IP 화이트리스트**: ESM 인증이 "허용된 서버(IP)" 를 검증. 모든 호출은 **Lightsail Market Gateway 고정 IP (`3.36.239.243`)** 경유 + 사전 등록 (`docs/architecture/v1/cross-cutting/market-gateway.md`).
- **Secret Key 보관**: 평문 금지. credential vault(pgcrypto) 암호화, Edge Function 에서만 복호화 (`credential-vault.md`). 로깅 시 키는 길이만.
- **API base host**: `sa2.esmplus.com` (각 article URL 섹션 참조). 인증 오류 시 `status_code: 401`.
- **사용 신청**: 지마켓·옥션 판매자 회원 + ESM+ 마스터 ID 필수. 신청 메일 `etapihelp@gmail.com` (승인은 내부 리소스 한도 — 거절 가능).
