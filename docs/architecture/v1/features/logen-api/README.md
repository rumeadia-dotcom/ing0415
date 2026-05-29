# 로젠택배 Open API — 사용방법 (개발 연동 가이드)

> 출처: <https://openapihome.ilogen.com/lsy06f-api-service/pages/dev-guide/token-usage.html>
> 화물/택배사: 로젠택배 (logen)
> 추출 시점: 2026-05-29

이 디렉토리(`logen-api/`)는 로젠 OpenAPI 의 영구 spec 인덱스다. 섹션별 article 목록은 [`docs/handoff/logen-api-index.md`](../../../../handoff/logen-api-index.md) 참조.

---

### · 개요

본 문서는 **LOGEN Open API** 개발 연동을 위한 가이드 문서입니다.

### · API 규격

- 호출 도메인 주소 : 개발 `https://topenapi.ilogen.com` 운영 `https://openapi.ilogen.com`
- 호출 방식 : RESTful (GET / POST 지원)
- 통신 암호화 : HTTPS
- 데이터 포맷 : JSON

### · Open API Key 발급

1. 이용안내의 **이용안내** 메뉴에서 발급 가능합니다.
2. secretKey는 **상위 거래처 기준**으로만 발급되며, 인증키 유효기간 내 교체 발급을 위해 최대 3개까지 발급 가능합니다.

*※ API 인증키 발급 경로 :* 이용안내 > 신청등록/현황, 인증키발급/현황

### · Open API 인증방식

1. **호출자 IP 주소 체크** : 업체 등록된 IP 주소를 검증
2. **인증키 체크** : 발급된 인증키의 유효성 검사 (유효기간 최대 2년)

인증 오류 시 `status : 401` Unauthorized 오류 발생

### · Header 구성

header 정보에 발급받은 인증키값을 secretKey 항목에 넣어줍니다.

```
"secretKey"    : "2FN10s3b_gHpZDsfskdjfjD8WCx8_oNBFdffsLui1mYxt-w"   // 이용안내에서 발급받은 인증키
"Content-Type" : "application/json"                                  // POST 호출 시 필수
```

---

## 프로젝트 연동 메모

- **호출자 IP 화이트리스트**: 로젠도 마켓 5사와 동일하게 호출 IP 검증을 한다. 모든 로젠 API 호출은 **AWS Lightsail Market Gateway 고정 IP (`3.36.239.243`)** 경유로 발신하고, 해당 IP 를 로젠 업체 등록 IP 로 등록해야 한다 (`docs/architecture/v1/cross-cutting/market-gateway.md`).
- **secretKey 보관**: 평문 저장 금지. credential vault (pgcrypto) 에 암호화 저장하고 Edge Function 에서만 복호화 (`docs/architecture/v1/cross-cutting/credential-vault.md`).
- **인증키 유효기간 최대 2년 / secretKey 최대 3개**: 만료 전 교체 발급 + 로테이션 운영 필요.
- 로깅 시 secretKey 는 길이만 기록(값 금지). 401 발생 빈도는 Sentry 로 모니터링.
