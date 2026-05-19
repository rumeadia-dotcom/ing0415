# 테스트 픽스처

> 마스터: `docs/architecture/v1/testing.md` §11

## 디렉토리 구조

```
tests/fixtures/
├── markets/                   ← 마켓 어댑터 mock 응답
│   ├── naver-happy.json
│   ├── naver-rate-limit.json
│   └── coupang-happy.json
├── images/                    ← 업로드 이미지
│   └── sample.jpg             (1x1 placeholder — 본 단계에선 자리 보존만)
└── products/                  ← Product 도메인 픽스처
    └── valid-product.json
```

## 규약 (testing.md §11.2)

- mock 마켓 응답 JSON 은 **실제 마켓 API 응답 캡처본** (PII 제거) 을 그대로 사용. 임의 작성 금지.
  - 현재 본 Stage 의 happy JSON 은 createMockAdapter 의 응답 형태와 정합한 placeholder.
  - Stage F 에서 real 어댑터 도입 시 sandbox 캡처본으로 교체.
- 캡처 출처 (`_meta.capturedFrom`, `_meta.capturedAt`) 를 JSON 에 기록 — 마켓 API 스펙 변경 시 추적 가능.
- 이미지 fixture 는 100KB 이내. 4MB 같은 대형은 CI 시 생성 스크립트 (Stage H 의 `tests/fixtures/images/generate.ts`) 로 즉시 생성.

## 이미지 sample.jpg 안내

본 Stage 의 `sample.jpg` 는 1x1 placeholder JPEG (~640 bytes) 입니다.
실제 골든 패스 G6 단계 (1024x1024 jpg 3장) 가 active 되는 Stage D~E 시점에
다음 중 하나로 교체합니다:

1. (추천) `tests/fixtures/images/generate.ts` 스크립트로 매 CI 시 즉시 생성 (sharp 또는 jimp).
2. 1024x1024 sample 1장을 체크인 (~50KB 이내, PII 없는 그라데이션 PNG/JPEG).

## 추가 절차

1. 새 시나리오 JSON 추가 시 `_meta.scenario` 키에 시나리오 명 (happy / 5xx / 429 / 401 / partial / timeout) 명시.
2. 마켓 API 캡처본은 토큰·셀러 식별자 PII 마스킹 후 체크인. security 검수 (R-007).
3. 본 디렉토리에 시크릿이 들어가면 PR 거부. `.gitignore` 가 아닌 직접 체크인 차단.
