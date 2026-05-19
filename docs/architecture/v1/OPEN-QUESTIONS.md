# OPEN QUESTIONS — v1 미해결 사안 추적

17개 설계문서에 흩어진 "미해결 사안" 을 단일 추적 문서로 모음. 결정 시점에 owner/결정안/근거를 누적.

## 사용법
- 새 사안 발견 시 적절한 priority 섹션에 행 추가 (ID 는 다음 번호 이어 부여)
- 결정 시 "결정 (TBD)" 컬럼에 결정문 + 근거 1줄 + 결정자/일자 기록
- 결정 완료 항목은 striked through 가 아닌 별도 "## 결정 완료" 섹션으로 이동
- 우선순위 기준:
  - **P1**: Phase 0~1 (스키마/인증/플랫폼 골격) 진입 전 필수
  - **P2**: Phase 2 (마켓 어댑터·이미지 파이프라인) 진입 전 필수
  - **P3**: Phase 3 (등록 잡 오케스트레이션) 진입 전 필수
  - **P4**: Phase 4 (대시보드·이력) 진입 전 필수
  - **P5**: Phase 5+ (KPI 자동화·운영 정책)
  - **v2**: MVP 범위 외, v2 백로그

---

## P1 — Phase 0~1 (즉시 결정 필요)

| ID | 항목 | 출처 | 영향 영역 | 결정 시점 | 후보 옵션 | 결정 (TBD) | 결정자 |
|---|---|---|---|---|---|---|---|
| OQ-01 | `display_name` unique 정책 | auth.md §12 #1 | auth | Phase 0 | (a) 전역 unique / (b) seller 단위 unique / (c) 비-unique | TBD | architect |
| OQ-02 | 비밀번호 강도 알고리즘 (zxcvbn vs 자체) | auth.md §12 #5 | auth | Phase 0 | (a) zxcvbn (~400KB) / (b) 자체 룰 (길이+문자종) | TBD | security, frontend |
| OQ-03 | Naver/Kakao PKCE 지원 사실 확인 | auth.md §12 #8 | auth | Phase 0 | (a) PKCE 지원 → 강제 / (b) 미지원 → state 만 | TBD | security |
| OQ-04 | 자격증명 암호화 방식 | credential-vault.md §2, security.md §4.2 | markets, credential | Phase 1 | (a) pgcrypto / (b) Supabase Vault / (c) KMS 외부 | **결정 완료 → 결정 완료 섹션 참조** | architect |
| OQ-05 | 실시간 전송 방식 (Realtime vs polling) | platform.md #2 | frontend, registration, dashboard, history | Phase 1 | (a) Supabase Realtime / (b) TanStack Query refetchInterval / (c) 혼합 | TBD | architect, frontend |
| OQ-06 | RLS 단위 테스트 도구 | platform.md #10 | testing | Phase 1 | (a) pgTAP / (b) Supabase JS + Vitest / (c) 둘 다 | TBD | qa, backend |
| OQ-07 | Edge Function body 크기 상한 | platform.md #12 | registration | Phase 1 | Supabase 공식 한도 확인 후 jobs payload 분할 정책 결정 | TBD | backend |
| OQ-08 | `oauth_state.account_label` 보존 방식 | markets.md O-6 | markets | Phase 1 | (a) `oauth_state` row 에 임시 보존 / (b) client localStorage / (c) state JWT claim | TBD | backend |
| OQ-09 | `external_account_id` 마스킹 자릿수 | markets.md O-5 | markets, history | Phase 1 | (a) 앞2/뒤4 / (b) 앞4/뒤4 / (c) 마켓별 다름 | TBD | security, designer |

---

## P2 — Phase 2 (마켓 어댑터·이미지 파이프라인)

| ID | 항목 | 출처 | 영향 영역 | 결정 시점 | 후보 옵션 | 결정 (TBD) | 결정자 |
|---|---|---|---|---|---|---|---|
| OQ-10 | 네이버·쿠팡 실제 OAuth endpoint/scope/refresh TTL | markets.md O-1/O-2, market-adapter.md O-1/O-2 | adapter | Phase 2 | 공식 문서 + 파트너 콘솔 등록 후 확정 | TBD | backend |
| OQ-11 | 마켓별 실측 RPS / 429 헤더 포맷 | market-adapter.md O-3/O-4 | limiter.ts | Phase 2 | 샌드박스 실측 → token bucket 파라미터 산출 | TBD | backend |
| OQ-12 | revoke endpoint = 6번째 어댑터 메서드 vs 외부 헬퍼 | markets.md O-3 | market-adapter 인터페이스 | Phase 2 | (a) `MarketAdapter.revoke()` 추가 / (b) 어댑터 외부 헬퍼 함수 | TBD | architect |
| OQ-13 | `markets-verify` ping (categoryTree 재사용 vs 별도) | markets.md O-4 | adapter | Phase 2 | (a) `fetchCategoryTree` head 1회 / (b) 별도 `ping()` 메서드 | TBD | backend |
| OQ-14 | PKCE 지원 여부 (네이버·쿠팡) | markets.md O-7 | OAuth | Phase 2 | 사실 확인 후 강제/생략 결정 | TBD | security |
| OQ-15 | 장기 잡 재시도 스케줄러 (pg_cron vs scheduled functions) | platform.md #3 | registration | Phase 2 | (a) pg_cron + DB 큐 / (b) Supabase scheduled edge function | TBD | backend |
| OQ-16 | 이미지 변환 실행 위치 | platform.md #5 | image-pipeline | Phase 2 | (a) Edge Function 인라인 / (b) 별도 worker function / (c) 클라이언트 사전 변환 | TBD | architect |
| OQ-17 | wasm-vips Deno 호환성 | image-pipeline.md §11 | image-pipeline | Phase 2 | (a) wasm-vips / (b) Deno 네이티브 imagescript / (c) Sharp via subprocess (불가능) | TBD | backend |
| OQ-18 | 마켓 정책 변경 모니터링 방식 | platform.md #11 | markets | Phase 2 | (a) 공식 changelog RSS 폴링 / (b) 어댑터 버전 + 계약 테스트 / (c) 양쪽 | TBD | architect |

---

## P3 — Phase 3 (등록 잡 오케스트레이션)

| ID | 항목 | 출처 | 영향 영역 | 결정 시점 | 후보 옵션 | 결정 (TBD) | 결정자 |
|---|---|---|---|---|---|---|---|
| OQ-19 | 재시도 한도, parent 분기 정책 | registration-job-state.md §12 | registration | Phase 3 | (a) 마켓당 N 회 / (b) 전체 잡 N 회 / parent 상태 partial 진입 조건 | TBD | backend, architect |
| OQ-20 | i18n 라이브러리 | platform.md #4 | frontend | Phase 3 | (a) i18next / (b) 경량 자체 dictionary | TBD | frontend |
| OQ-21 | Supabase CLI 버전 고정 | platform.md #9 | ops | Phase 3 | (a) `package.json` devDep / (b) `.tool-versions` / (c) brew + 문서화 | TBD | ops |

---

## P4 — Phase 4 (대시보드·이력)

| ID | 항목 | 출처 | 영향 영역 | 결정 시점 | 후보 옵션 | 결정 (TBD) | 결정자 |
|---|---|---|---|---|---|---|---|
| OQ-22 | MAU 세션 수집 방식 | platform.md #7, dashboard.md OPEN-DSH-004 | dashboard, kpi | Phase 4 | (a) Supabase Auth login 이벤트 / (b) 별도 `sessions` 테이블 직접 기록 / (c) Edge Function middleware | TBD | backend |
| OQ-23 | 등록 잡 부분 실패 알림 (Sentry vs toast) | platform.md #8 | registration, dashboard | Phase 4 | (a) toast 만 / (b) Sentry breadcrumb / (c) DB `notifications` 테이블 + UI 배지 | TBD | frontend, ops |
| OQ-24 | `list_registration_jobs` P95 ≤ 500ms 실측 | history.md §10 | history | Phase 4 | 인덱스/뷰 튜닝 + 실측 → 미달 시 materialized view 도입 | TBD | backend, qa |
| OQ-25 | recent jobs view materialized 전환 | dashboard.md OPEN-DSH-002 | dashboard | Phase 4 | (a) 일반 view 유지 / (b) materialized + refresh 트리거 / (c) Realtime 만 | TBD | backend |

---

## P5 — Phase 5+ (KPI 자동화·운영 정책)

| ID | 항목 | 출처 | 영향 영역 | 결정 시점 | 후보 옵션 | 결정 (TBD) | 결정자 |
|---|---|---|---|---|---|---|---|
| OQ-26 | 잡 보관 기간 (무기한 vs 12·24개월) | history.md §14 #1 | history, ops | Phase 5 | (a) 무기한 / (b) 12개월 / (c) 24개월 + 아카이브 | TBD | architect, ops |
| OQ-27 | KPI 자동화 (Scheduled Function + Slack) | kpi.md §9 | ops | Phase 5 | (a) pg_cron → view refresh / (b) scheduled function → Slack webhook / (c) 양쪽 | TBD | ops |

---

## v2 후보

| ID | 항목 | 출처 | 영향 영역 | 비고 |
|---|---|---|---|---|
| OQ-28 | 마켓별 통계 위젯 사양 | dashboard.md OPEN-DSH-001 | dashboard | v1 대시보드는 요약 통계만 |
| OQ-29 | 오류 유형별 통계 차트 | history.md §14 #2 | history | v1 이력은 기본 필터만 |
| OQ-30 | 카테고리 자동 추천 ML 모델 | registration.md §16 #1 | registration | v1 은 수동 매핑 |
| OQ-31 | 잡 cancel 시 외부 상품 자동 삭제 메서드 | registration.md §16 #4 | adapter | v1 은 외부 상품 잔존 허용 |

---

## 결정 완료

| ID | 항목 | 결정 | 근거 | 결정자/일자 |
|---|---|---|---|---|
| OQ-04 | 자격증명 암호화 방식 | **pgcrypto 1차** (Vault 도입은 운영 트래픽 증가 시 재검토) | Vault 운영 난이도 + Edge Function 통합 비용. pgcrypto 는 Postgres 네이티브로 RLS·마이그레이션과 일관 관리 가능. 거부: (b) Vault — 별도 운영 부담, (c) KMS 외부 — Supabase 단일 인프라 원칙 위배 | architect / 2026-05-18 |
