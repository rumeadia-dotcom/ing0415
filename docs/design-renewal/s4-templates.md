# s4. 템플릿 관리 — 디자인 리뉴얼 (v2 예정)

> **상태**: v1 제외 — **구현 없음**. 본 문서는 user_flow / PRD 만으로 "v2 진입 시 어떤 화면이 필요한가" 를 정리한 **spec 기반 화면 정의서**이다. 코드 / HTML 프로토타입 / 설계문서 (`docs/architecture/v1/features/templates.md`) **현재 시점 없음** — v2 진입 시 함께 신설한다.

---

## 1. 도메인 개요

### 1.1 목적

판매자가 자주 사용하는 **Product 필드 묶음** (상품명·가격·브랜드·제조사·카테고리·배송정보·이미지·HTML 상세) 을 **Template** 으로 저장 → 신규 상품 등록 시 자동 불러와 반복 입력 부담을 줄인다.

- **핵심 가치**: s3 상품 등록 5단계 위저드의 StepInfo / StepImages 입력량을 5~10초 수준으로 단축.
- **차별점**: 단순 폼 prefill 이 아니라 이미지·HTML 상세까지 포함 (PRD §3 수용 기준 3번).

### 1.2 v1 제외 사유

CLAUDE.md "MVP 범위 (v1)" 의 **제외 (v2 이후)** 항목에 명시.

- **이유 1 — 등록 자체가 우선**: v1 의 핵심 가치는 "다중 마켓 동시 등록" (s3 + s5). 템플릿은 등록 효율을 더 높이는 가속기이지, 등록 자체를 가능하게 하는 기능이 아니다.
- **이유 2 — 이미지 라이브러리 / 버전 관리 / WYSIWYG 의 구현 비용**: 단순 prefill 만 이라면 가볍지만 PRD §3.5 / §3.6 까지 포함하면 별도 화면 4~5개 + Storage 버킷 정책 + 이미지 변환 파이프라인 재사용 설계가 필요. v1 의 데드라인과 충돌.
- **이유 3 — 권한 모델 (§3.3.3) 은 1인 셀러 가정에 불필요**: CLAUDE.md "제외" 의 멀티유저/권한 모델 항목과 묶여 있음.

### 1.3 v2 진입 시점 (트리거)

다음 조건 중 **2개 이상** 충족 시 v2 트랙 진입:

1. v1 출시 후 첫 달 KPI 로 **평균 등록 시간 단축률** 측정 결과, 동일 셀러가 유사 상품을 반복 등록하는 패턴이 30% 이상 → 템플릿 도입 ROI 입증.
2. 베타 사용자 NPS 인터뷰에서 "반복 입력이 번거롭다" 가 top-3 페인포인트로 등장.
3. s3 등록 위저드의 StepInfo 평균 소요시간이 목표치 (예: 3분) 초과로 단축 필요.

### 1.4 user_flow / PRD 매핑

| user_flow 노드 | PRD 항목 |
|---|---|
| n26 `main_page` 템플릿 관리 | §3 도메인 진입 |
| n27 `page` 템플릿 목록 | §3.2 (§3.2.1 목록 UI, §3.2.2 미리보기) |
| n28 `page` 템플릿 생성 | §3.1 (§3.1.1 필드 구성, §3.1.2 중복명 검사, §3.1.3 자동 기본값) |
| n29 `page` 템플릿 수정 | §3.3 (§3.3.1 동기화, §3.3.2 변경 이력) |
| n30 `page` 이미지 관리 | §3.5 (§3.5.1 메타데이터, §3.5.2 최적화, §3.5.3 버전) |
| n31 `page` HTML 설명 편집 | §3.6 (§3.6.1 WYSIWYG, §3.6.2 유효성, §3.6.3 미리보기) |
| n32 `action` 템플릿 저장 | §3.1, §3.3 저장 시점 |
| n33 `action` 템플릿 삭제 | §3.4 |

**Flow** (user_flow.md §s4 원문 정합):
- 템플릿 관리 → 템플릿 목록
- 템플릿 목록 → 템플릿 생성 / 템플릿 수정 / 템플릿 삭제
- 템플릿 생성 → 이미지 관리 / HTML 설명 편집 / 템플릿 저장
- 템플릿 수정 → 템플릿 저장

> **주의**: PRD §3.6.1 ~ §3.6.3 (WYSIWYG / 유효성 / 미리보기) 는 **v1 에서 s3 상품 등록 StepInfo / StepPreview 의 일부로 이미 구현**된다 (CLAUDE.md MVP §s3 "HTML 상세" 절). v2 템플릿은 같은 컴포넌트를 **재사용**하면 되고, 신규 구현 부담이 아니다. (§3.6.2 XSS 검사 정책은 v1 s3 에서 확정 → 템플릿은 동일 sanitizer 호출만 하면 됨.)

---

## 2. (예정) 화면 목록 표

| 라우트 (제안) | 화면명 | user_flow 노드 | PRD 근거 |
|---|---|---|---|
| `/templates` | 템플릿 목록 | n26 + n27 | §3.2.1 |
| `/templates/new` | 템플릿 생성 (5탭 통합) | n28 (+ n30, n31 내장) | §3.1, §3.5, §3.6 |
| `/templates/:id/edit` | 템플릿 수정 (5탭 통합) | n29 (+ n30, n31 내장) | §3.3, §3.5, §3.6 |
| `/templates/:id/preview` | 템플릿 상세 미리보기 (Sheet/Drawer 권장) | n27 → 선택 시 | §3.2.2 |
| `/templates/:id/history` | 템플릿 변경 이력 | n29 → 이력 탭 | §3.3.2 |

> **라우트 설계 의도**:
> - **생성/수정은 5탭 통합 단일 라우트** — user_flow 의 n28 → n30 / n31 분기는 "화면 페이지 분리" 가 아니라 같은 페이지 내 **탭/스텝** 으로 통합 (페이지 5개 분산 시 저장 시점 / 상태 동기화 복잡도가 폭증). 즉 n30 (이미지 관리) · n31 (HTML 설명 편집) 은 **n28 / n29 페이지 내 탭** 으로 흡수.
> - **상세 미리보기는 별도 라우트가 아닌 Sheet/Drawer** — `/templates` 목록 위에 오버레이로 띄우는 게 워크플로우상 자연스러움 (PRD §3.2.2 "특정 템플릿을 선택하면" 의 인터랙션). 단 deep link 필요 시 라우트 분리 (URL 공유 가능).
> - **이력 탭 별도 라우트** — 수정 화면 안의 탭이지만 URL 깊은 진입 (예: 알림 → "변경 이력 보기") 가능하도록.

---

## 3. (예정) 화면별 상세

### 3.1 `/templates` — 템플릿 목록

- **목적**: 셀러가 저장한 템플릿을 한 화면에서 조회 / 검색 / 선택 / 삭제. s3 등록 진입점 후보.
- **user_flow 노드**: n26 + n27
- **PRD 근거**: §3.2.1 (검색·필터·정렬), §3.2.2 (미리보기), §3.4 (삭제)
- **입력 항목 (UI 컨트롤)**:
  - 검색: `Input` — 템플릿명·태그 부분일치 (즉시 결과 갱신, 검색류 variant)
  - 필터: 카테고리 / 마지막 사용일 / 사용 횟수 — `Select` 또는 chip
  - 정렬: 최근 수정순 / 사용 빈도순 / 이름순 — `Select`
- **워크플로우**:
  1. 진입 → TanStack Query `['templates', { sellerId, filters }]` 로 목록 fetch
  2. 카드 클릭 → `/templates/:id/preview` (Sheet 오버레이) 진입 → "수정" 버튼 클릭 시 `/templates/:id/edit` 이동
  3. 카드 우측 메뉴 (`DropdownMenu`) → "복제" / "삭제" / "s3 으로 등록 시작" (= `/register?templateId=:id`)
  4. 우상단 `Button` (variant primary) "새 템플릿 만들기" → `/templates/new`
- **데이터 의존**:
  - `templates` 테이블 (seller_id RLS) — id, name, summary, last_used_at, usage_count, thumbnail_url, updated_at
  - 사용 빈도는 `registration_jobs.template_id` join count 로 view 제공
- **상태 분기**: `loading` (Skeleton 그리드 6장) / `data` (그리드 3~4열 카드) / `error` (`ErrorMessage` 재시도 버튼) / `empty` ("아직 템플릿이 없어요" + "새 템플릿 만들기" CTA)
- **반응형**:
  - 1200+ : 카드 그리드 4열
  - 768~1199 : 3열
  - ~767 : 1열 (카드 폭 100%), 검색·필터는 상단 Sheet 로 접기

---

### 3.2 `/templates/new` & `/templates/:id/edit` — 템플릿 생성 / 수정 (5탭 통합)

- **목적**: 템플릿 신규 작성 / 기존 템플릿 수정. n28 / n29 / n30 / n31 을 단일 페이지의 **5탭** 으로 통합.
- **user_flow 노드**: n28 / n29 (내장: n30 이미지 관리, n31 HTML 설명 편집)
- **PRD 근거**: §3.1.1 ~ §3.1.3, §3.3.1 ~ §3.3.2, §3.5 전체, §3.6 전체
- **입력 항목 (탭별)**:
  1. **기본 정보** (§3.1.1) — 템플릿명 (중복명 실시간 검사 §3.1.2), 설명, 태그, 카테고리 기본값 (§3.1.3)
  2. **상품 정보** — 가격대 / 브랜드 / 제조사 / 옵션 기본값
  3. **이미지** (§3.5) — 다중 업로드 (s3 StepImages 컴포넌트 재사용), 메타데이터 표시 (§3.5.1), 자동 최적화 결과 (§3.5.2), 이미지별 버전 이력 (§3.5.3 — Drawer)
  4. **배송 정보** (§3.1.3 자동 기본값) — 무게 / 배송 방식 / 배송비 / 출고지
  5. **HTML 상세** (§3.6) — WYSIWYG (s3 의 HTML 에디터 컴포넌트 재사용), XSS sanitizer 동일 호출, 우측에 라이브 미리보기 (§3.6.3)
- **워크플로우**:
  1. `new` 진입 → 빈 RHF state. `edit` 진입 → `['templates', id]` fetch → `form.reset(data)`
  2. 탭 전환 시 dirty 상태는 RHF 가 보존, 다른 탭에서도 입력값 유지
  3. 우상단 고정 `Button` "임시 저장" (variant secondary, 1분마다 auto-save 옵션) / "저장" (variant primary, 실행류)
  4. **저장 버튼 비활성 사유** (`blockingReasons`):
     - "템플릿명을 입력하세요"
     - "템플릿명이 중복돼요 (다른 이름 사용)" — §3.1.2 실시간 중복명 검사 (debounce 300ms)
     - "이미지 1장 이상 추가하세요" — 옵션. 제품 정책으로 확정 필요
  5. 저장 → n32 → 목록으로 리다이렉트 + toast "템플릿이 저장됐어요"
  6. 변경 이력 (§3.3.2) — 우상단 메뉴 "변경 이력 보기" → `/templates/:id/history` (Drawer)
- **데이터 의존**:
  - `templates` (마스터) + `template_versions` (변경 이력, §3.3.2 / §3.5.3 통합 가능) + `template_images` (메타데이터, §3.5.1)
  - zod 스키마: `apps/web/src/lib/schemas/templates.ts` (단일 ground truth — RHF resolver + Supabase upsert + 서버 응답 parse)
  - 이미지 변환은 v1 의 `image-pipeline` (`docs/architecture/v1/cross-cutting/image-pipeline.md`) 재사용
- **상태 분기**:
  - 생성: `data` 만 (loading 불필요)
  - 수정: `loading` (Skeleton 탭 1개분) / `data` / `error` / `empty` (= 404, "삭제됐거나 권한 없음")
  - 저장 mutation: `idle` / `pending` (`Button` 안 spinner) / `success` / `error` (`ErrorMessage` 펼침)
- **반응형**:
  - 1200+ : 좌측 탭 네비 + 우측 콘텐츠 2단 / HTML 탭은 에디터 ↔ 미리보기 좌우 분할
  - 768~1199 : 상단 가로 탭 + 콘텐츠 / HTML 탭 미리보기는 토글
  - ~767 : 탭은 Sheet 메뉴 또는 가로 스크롤 + 하단 고정 저장 바 / HTML 탭 미리보기는 별도 페이지 push

---

### 3.3 `/templates/:id/preview` — 템플릿 상세 미리보기

- **목적**: 목록에서 템플릿 선택 시 상세를 미리 확인 → 등록 진입 의사결정.
- **user_flow 노드**: n27 → 선택 시
- **PRD 근거**: §3.2.2
- **입력 항목**: 없음 (읽기 전용)
- **워크플로우**:
  1. 카드 클릭 → Sheet 오른쪽에서 슬라이드 진입
  2. 표시: 템플릿 메타 (이름, 설명, 마지막 사용일, 사용 횟수) + 이미지 갤러리 (Carousel) + HTML 상세 미리보기 (iframe sandbox)
  3. 푸터 `Button`: "수정" (secondary, → `/templates/:id/edit`) / "이 템플릿으로 등록 시작" (primary 실행류, → `/register?templateId=:id`)
- **데이터 의존**: `templates` + `template_images` (presigned URL 로 thumbnail 노출)
- **상태 분기**: `loading` (Sheet 안 Skeleton) / `data` / `error` / `empty` (= 404)
- **반응형**:
  - 1200+ : Sheet width 600px
  - 768~1199 : Sheet width 480px
  - ~767 : 풀스크린 Dialog 로 전환 (Sheet 가 폭 부족)

---

### 3.4 `/templates/:id/history` — 변경 이력

- **목적**: 템플릿 수정 이력 / 이미지 버전 이력을 시간순으로 확인. 이전 버전으로 복원.
- **user_flow 노드**: n29 의 보조 진입 (PRD §3.3.2 "이전 버전으로 복원")
- **PRD 근거**: §3.3.2 (템플릿 변경 이력), §3.5.3 (이미지 버전 관리)
- **입력 항목**: 버전 선택 (`Radio` 또는 row 클릭)
- **워크플로우**:
  1. 목록: 버전 row (`v3 — 2026-05-20 14:30 / "가격 1000원 인하"` 형태). 사용자가 row 클릭 → 우측에 diff 패널 (변경된 필드 강조)
  2. 푸터 `Button` "이 버전으로 복원" (실행류, 확인 Dialog 띄움) → 새 버전을 만드는 형태로 복원 (history 절대 손실 금지)
- **데이터 의존**: `template_versions` (snapshot full state + changed_fields jsonb + author + created_at)
- **상태 분기**: `loading` / `data` / `error` / `empty` ("아직 변경 이력이 없어요")
- **반응형**: 1200+ 좌우 분할 / 768~1199 상하 분할 / ~767 단일 컬럼, diff 는 펼침/접힘 토글

---

## 4. Template 도메인 모델

CLAUDE.md "제품 도메인" §Template 정의: *자주 쓰는 Product 필드 묶음. 이미지·HTML 상세까지 포함, 버전/이력 관리.*

### 4.1 핵심 엔티티 (v2 진입 시 확정 — 현재는 spec 기반 제안)

| 엔티티 | 핵심 컬럼 (제안) | RLS |
|---|---|---|
| `templates` | id (uuid pk), seller_id (uuid fk, RLS), name (citext unique per seller — §3.1.2 중복명 검사 근거), summary, category_path (jsonb), base_price, brand, manufacturer, shipping_defaults (jsonb), html_body (text), html_body_sanitized (text — XSS pass 후), usage_count, last_used_at, created_at, updated_at, deleted_at (soft) | seller_id = auth.uid() |
| `template_images` | id, template_id (fk), seller_id, storage_path, file_name, mime, byte_size, width, height, sort_order, variants (jsonb — 마켓별 변환본 메타), uploaded_at | seller_id = auth.uid() |
| `template_versions` | id, template_id (fk), version_no (int), snapshot (jsonb — 전체 상태), changed_fields (jsonb), changed_by (uuid), created_at | seller_id = auth.uid() |

### 4.2 ENUM / 상태

템플릿 자체는 상태 머신 없음 (등록 잡과 달리 단순 CRUD + soft delete). `deleted_at` IS NOT NULL 로 휴지통 운영 (영구 삭제는 별도 정책 — v2 결정).

### 4.3 zod 스키마 위치 (v2 신설 예정)

`apps/web/src/lib/schemas/templates.ts` — RHF resolver + Supabase upsert + 서버 응답 parse 의 단일 ground truth.

> **재사용 명시**: HTML 상세 / 이미지 업로드는 **v1 s3 등록 위저드에서 이미 구현한 컴포넌트·sanitizer·image-pipeline 을 그대로 호출**한다. 템플릿 도메인은 그것을 wrap 하는 폼 컨테이너 + 저장소만 추가.

---

## 5. s3 상품 등록과의 연동 (v2 진입의 핵심 가치 동선)

### 5.1 진입점 A — 등록 위저드 안에서 "템플릿 불러오기"

- **위치**: s3 StepInfo (1단계 — 상품 정보 입력 시작 시점) 우상단.
- **UI**: `Button` (secondary, variant outline) "템플릿에서 불러오기" → Sheet 진입 → 템플릿 카드 목록 + 검색 → 클릭 시 미리보기 → "이 템플릿 사용" 클릭 시 RHF `form.reset(templateData)` + Sheet 닫힘.
- **블로킹 사유**: 폼이 dirty 상태일 경우 "현재 입력값이 덮어쓰여집니다" 확인 Dialog.
- **PRD 근거**: §3.2.3 (템플릿 선택 후 자동 불러오기).

### 5.2 진입점 B — 템플릿 목록에서 "이 템플릿으로 등록 시작"

- **위치**: `/templates` 카드 메뉴 또는 `/templates/:id/preview` 푸터.
- **동선**: `/register?templateId=:id` 로 이동 → StepInfo 진입 시 자동으로 `templateId` 적용 (`useSearchParams` + zod 로 검증).
- **사이드 이펙트**: `templates.usage_count` 증가 (Edge Function 호출), `last_used_at` 갱신.

### 5.3 연동 정합성 룰 (v2 진입 시 강제)

- 템플릿 스키마의 필드명 / 타입은 **Product 스키마와 1:1 호환**되어야 한다. 호환 불가 필드는 템플릿에 저장하지 않는다 (시장별 카테고리 코드 매핑 / 외부 productId 같은 등록 잡 산출물은 템플릿 범위 외).
- 템플릿이 보유한 카테고리 기본값이 **현재 마켓 카테고리 트리에 더 이상 존재하지 않을 경우** StepMarkets / StepCategory 진입 시 "카테고리가 변경되어 다시 선택해야 해요" 배너 노출.
- 템플릿 이미지의 변환본 (`template_images.variants`) 은 s3 의 image-pipeline 출력과 동일 포맷이어야 함 → 등록 시 재변환 없이 바로 사용 가능 (등록 시간 단축의 핵심).

---

## 6. 디자인 리뉴얼 시 고려사항 + v2 진입 시 결정 항목

### 6.1 디자인 리뉴얼 시 고려사항

- **목록은 카드 그리드 vs 표 + 행 펼침 — 카드 권장** (썸네일 위주 인지). 단 셀러가 50개 이상 운영하면 표 + 필터가 효율적 — 기준선은 베타 데이터 확보 후 결정.
- **5탭 통합 페이지의 탭 전환은 라우트 변경 없이 in-page 상태로**. 단 "직접 링크 (변경 이력 보기) " 같은 진입은 query param (`?tab=history`) 으로 노출.
- **자동 저장 vs 명시적 저장** — 5탭 통합 페이지에서 한 탭 입력 → 다른 탭 이동 시 자동 저장 (이미지 / HTML 은 자동 저장 위험) vs 임시 저장 버튼만 명시 — **명시적 임시 저장 권장** (사고로 덮어쓰는 위험 회피).
- **다크 모드 토큰 정합** — HTML WYSIWYG 의 iframe sandbox 미리보기는 항상 라이트 (실제 마켓 상세는 라이트). 사용자가 다크 모드여도 미리보기는 라이트 — 명시적 안내 필요.

### 6.2 v2 진입 시 결정 항목

| 항목 | 결정 필요 사유 | 영향 |
|---|---|---|
| 권한 모델 (§3.3.3) | CLAUDE.md "제외" 의 멀티유저/권한과 묶임 — 1인 셀러 모델 유지 시 권한 UI 불필요 | UI 단순화 / 데이터 모델에 `owner_id` / `editor_ids` 필요 여부 |
| 버전 이력 보존 정책 | 무한 보존 vs 30일 / 100버전 cap | Storage 비용 / 복원 UX |
| 버전 비교 UX | full snapshot diff vs changed_fields 만 표시 | history 화면 구현 비용 |
| 이미지 라이브러리 화면 (별도 진입점) | 템플릿 안의 이미지 관리만으로 충분 vs 전역 라이브러리 (여러 템플릿 공유) | 신규 진입점 + 라우트 추가 여부 |
| s3 진입점 위치 | StepInfo 만 vs StepImages 만 vs 둘 다 | 위저드 동선 정합 |
| 등록 시 템플릿과의 연결 | `registration_jobs.template_id` 저장 (KPI 측정용) | 분석 view 강제 |
| 휴지통 / 영구 삭제 | soft delete 후 30일 자동 영구 삭제 vs 사용자 명시적 영구 삭제 | RLS / cron Edge Function 필요 |
| HTML sanitizer 동일성 보증 | v1 s3 에서 쓰는 sanitizer 와 동일 호출 강제 | drift 방지 → cross-cutting 문서 추가 |

### 6.3 v2 진입 시 동기화할 산출물 (2개 산출물 룰)

1. **설계문서**: `docs/architecture/v1/features/templates.md` **신설** (현재 없음).
2. **실제 구현**: `apps/web/src/features/templates/{components,hooks,api,pages}/` **신설**. 라우트 `/templates/*` 를 `App.tsx` 에 추가.
3. (부수) `apps/web/src/lib/schemas/templates.ts` 신설 (단일 ground truth zod 스키마).
4. (부수) `docs/spec/user_flow.md` §s4 노드는 이미 존재 — 5탭 통합 결정 사항을 주석으로 추가 (n30 / n31 은 페이지 분리가 아닌 탭 통합).
5. (참고) 디자이너 인계 = 본 `docs/design-renewal/s4-templates.md`. HTML 프로토타입은 deprecate (CLAUDE.md "2개 산출물 동기화").

---

## 7. 변경 이력

| 일자 | 작성자 | 내용 |
|---|---|---|
| 2026-05-21 | ing-frontend | 최초 작성 (v1 제외 상태 / v2 spec 기반 화면 정의) |
