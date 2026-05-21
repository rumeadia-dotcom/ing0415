# MarketCast — 정식 HTML 프로토타입 v1

`docs/architecture/v1/ui-system.md` 토큰 시스템을 **브라우저에서 바로 검증** 하기 위한 정적 HTML 산출물. 정식 React 앱 구현 전 디자인 합의·접근성 점검·다크 모드 확인용.

## 범위 (Wave 기반 점진 확장)

| Wave | 도메인 | 화면 | 상태 |
|---|---|---|---|
| **1** | `_shared/` + s1 인증 | login / signup / forgot-password / reset-password | ✅ 완료 |
| 2 | s2 dashboard | summary, market-stats | 예정 |
| 3 | s3 registration | 5단계 위저드 + 결과 (partial 포함) | 예정 |
| 4 | s5 markets | 목록, OAuth 연결, 상세 | 예정 |
| 5 | s6 history | 목록, 필터, 상세 | 예정 |

s4 templates 는 v2 — 본 디렉토리에서 제외.

## v0 (`prototype/`) 와의 차이

| 항목 | prototype (v0) | docs/frontend_html_design/v1 (정식) |
|---|---|---|
| 위치 | 레포 루트 `prototype/` | `docs/frontend_html_design/v1/` |
| 빌드 | CDN React + Babel standalone | 빌드 없음 — 순수 HTML/CSS |
| 토큰 | 단일 `styles.css` (라이트만) | `_shared/styles.css` (라이트 + 다크) |
| 동기화 | 시각 레퍼런스 (보존) | UI 결정의 **단일 소스** (ui-system.md 와 1:1) |
| 다국어 | n/a | `lang="ko"` 명시, 추후 i18n key 화 대비 |
| 접근성 | 부분적 | WCAG 2.1 AA 강제 (label/role/aria/focus-visible) |
| 인터랙션 | React state 로 작동 | 정적 — 상태 분기는 클래스 토글 예시 주석 |

## 디렉토리 구조

```
docs/frontend_html_design/v1/
├─ README.md
├─ _shared/
│  ├─ styles.css      # 전 페이지 공유 토큰 + shadcn 풍 컴포넌트
│  ├─ icons.svg       # SVG sprite (Lucide 스타일 + 마켓 5 + 소셜 3)
│  └─ chrome.html     # 사이드바 + 토픽바 참조 마크업 (각 페이지가 복사)
└─ auth/
   ├─ login.html
   ├─ signup.html
   ├─ forgot-password.html
   └─ reset-password.html
```

## 보기 방법

1. 레포를 로컬에 클론.
2. 브라우저로 각 `.html` 파일을 **직접 오픈** (file:// 프로토콜 OK — CDN Pretendard 만 외부 요청).
3. 다크 모드 확인: 브라우저 devtools 에서 `<html data-theme="dark">` 토글, 또는 OS 다크 모드.
4. 모바일 확인: devtools 의 device toolbar 로 ≤375px 폭 강제.

> 인터랙션(탭 전환, 폼 제출, 비밀번호 표시 토글, 테마 토글) 은 **JS 가 없으므로 작동하지 않는다**. 각 화면 `<head>` 의 주석에 "상태 분기 시뮬레이션 방법" (클래스 추가/속성 변경) 을 명시했다.

## 새 화면 추가 절차

1. 도메인 디렉토리 생성 — `mkdir docs/frontend_html_design/v1/<도메인>/`
2. `_shared/chrome.html` 의 사이드바/토픽바 마크업을 복사해 페이지 HTML 의 `<body>` 에 붙임 (auth 도메인은 chrome 미사용 — `auth-shell` 사용).
3. `<link rel="stylesheet" href="../_shared/styles.css">` 로 토큰 공유.
4. 아이콘은 `<svg><use href="../_shared/icons.svg#i-XXX"/></svg>` 로 참조.
5. 새 컴포넌트가 필요하면 **먼저 `_shared/styles.css` 에 토큰 기반 클래스 추가** → 그 다음 페이지에서 사용. inline style 금지 (주석 표시 예외만 허용).
6. 변경 후 동기화 체크리스트:
   - [ ] `docs/architecture/v1/ui-system.md` 의 토큰/컴포넌트 정의와 불일치 없는지
   - [ ] `docs/architecture/v1/features/<domain>.md` 의 와이어와 일치하는지
   - [ ] 라이트 / 다크 두 모드 모두 시각 검증
   - [ ] 모바일(≤767px) / 태블릿 / 데스크탑 3 BP 검증
   - [ ] 키보드만으로 전체 동선 (Tab/Enter/Esc) 가능한지

## 알려진 제약 / TODO

- **JS 없음** — 탭 전환·다크 토글·폼 검증은 정식 React 앱에서 구현. 본 프로토타입은 시각 검증 목적만.
- **Pretendard CDN 의존** — 정식 앱은 self-host 예정 (ui-system.md §4.1).
- **마켓 로고는 단순 SVG 타일** — 실제 브랜드 SVG 는 법무 검토 후 교체 (ui-system.md §9.1, D4).
- **focus 링 색상 대비** 다크 모드 `accent (#3B82F6)` 4.8:1 — 한계치 통과. 모니터링 (ui-system.md §12.2).

## 동기화 관계

본 디렉토리는 아래 3개 산출물 중 하나. 한쪽 변경 시 다른 둘도 함께 갱신:

1. `docs/architecture/v1/` — 설계문서 (의도·근거)
2. `docs/frontend_html_design/v1/` — **본 디렉토리** (시각 합의)
3. `apps/web/src/features/<domain>/` + `apps/web/src/components/ui/` — 실제 구현 (예정)

`prototype/` (v0) 은 시각 레퍼런스로 보존하며 자동 동기화 대상이 아님.
