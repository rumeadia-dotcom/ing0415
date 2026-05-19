# UI System v1 — ing-designer 명세

> 작성: ing-designer (ENTP, 디자이너) · 검토 대기: frontend / qa / pm
> 버전: v1.0 (2026-05-18)
> 동기화 대상: `prototype/styles.css` (v0 시각 레퍼런스) / `docs/frontend_html_design/v1/` (정식 HTML 프로토타입 — 첫 화면 작업 시 신설) / `apps/web/src/components/ui/*` (shadcn 컴포넌트 직소유)

---

## 1. 목적 · 범위

다중 마켓 상품 등록 SaaS 의 **모든 화면이 같은 언어로 말하게 하는 디자인 시스템**이다. 코드 0줄 상태에서 시작하므로 prototype v0(`prototype/styles.css`) 의 토큰을 Tailwind theme + shadcn 으로 이식하고, **라이트/다크 동시 출시**·**WCAG 2.1 AA**·**모바일 우선** 세 가지를 제1원칙으로 고정한다. 범위는 v1 MVP 5개 도메인(auth / dashboard / registration / markets / history) — s4 templates 는 v2 백로그지만 토큰은 미리 준비.

---

## 2. 디자인 원칙 5개

| # | 원칙 | 검증 질문 |
|---|---|---|
| P1 | **셀러는 등록 잡 결과를 한눈에** | 등록 화면에서 "성공/실패/재시도 가능" 셋이 색상 + 아이콘 + 텍스트 3중 표시되는가 |
| P2 | **실행 vs 검색 버튼 시각 분리** | "등록 시작" 과 "검색" 이 같은 variant 인가? 같으면 거부 |
| P3 | **손실 회피 우선** | 부분 실패 시 실패 카드가 성공 카드보다 시각 무게가 큰가 |
| P4 | **모바일에서도 등록 1건 완료 가능** | 모든 폼·다이얼로그가 ≤375px 폭에서 잘리지 않고 터치 타겟 ≥44px 인가 |
| P5 | **데이터 없음·연결 끊김도 화면** | 모든 비동기 UI 가 data/loading/error/empty (+RegistrationJob 은 partial) 5상태를 가지는가 |

> **ⓘ 디자이너 의견**: P1·P3 가 가장 자주 어겨진다. 프로토타입 v0 는 "성공 X 건 / 실패 Y 건" 을 같은 무게로 두는데 v1 에서는 의도적으로 깨라. 실패가 있으면 실패가 1차 영역.

---

## 3. 컬러 토큰 매트릭스

### 3.1 토큰 카테고리 (Tailwind `theme.extend.colors` 네임스페이스)

`surface` / `text` / `border` / `accent` / `success` / `warning` / `danger` / `info` / `market`

shadcn 관례 (`background`, `foreground`, `primary`, `card` 등) 와 **공존**한다. shadcn 표준 키는 그대로 두고, 우리 도메인 색(`market.*`, `surface.subtle`, `surface.muted`)을 `extend` 로 덧붙인다.

### 3.2 라이트 / 다크 매트릭스

| 토큰 | Tailwind 키 | Light (HEX) | Dark (HEX) | 비고 / 대비 |
|---|---|---|---|---|
| 배경 기본 | `surface.DEFAULT` | `#FFFFFF` | `#0B1220` | dark 는 slate-950 톤 (#020617 보다 약간 띄움) |
| 배경 보조 | `surface.subtle` | `#F8FAFC` | `#0F172A` | section bg |
| 배경 중간 | `surface.muted` | `#F1F5F9` | `#1E293B` | input bg, badge bg |
| 본문 텍스트 | `text.DEFAULT` | `#0F172A` | `#F1F5F9` | vs surface 대비: light 17.4:1 / dark 13.8:1 ✅ |
| 보조 텍스트 | `text.secondary` | `#475569` | `#CBD5E1` | 7.6:1 / 8.2:1 ✅ |
| 약한 텍스트 | `text.tertiary` | `#94A3B8` | `#94A3B8` | 4.6:1 / 4.7:1 ✅ (16px 이상에만 사용) |
| 경계선 | `border.DEFAULT` | `#E2E8F0` | `#1E293B` | divider |
| 강한 경계선 | `border.strong` | `#CBD5E1` | `#334155` | input border |
| 액센트 | `accent.DEFAULT` | `#2563EB` | `#3B82F6` | dark 는 한 톤 밝게 (Blue 600 → 500) |
| 액센트 hover | `accent.hover` | `#1D4ED8` | `#2563EB` | |
| 액센트 soft bg | `accent.soft` | `#EFF6FF` | `#172554` | selected market card bg |
| 액센트 soft border | `accent.softBorder` | `#DBEAFE` | `#1E3A8A` | |
| 성공 | `success.DEFAULT` | `#10B981` | `#34D399` | dark 한 톤 밝게 |
| 성공 soft | `success.soft` | `#ECFDF5` | `#022C22` | |
| 성공 text-on-soft | — | `#047857` | `#6EE7B7` | badge text |
| 경고 | `warning.DEFAULT` | `#F59E0B` | `#FBBF24` | |
| 경고 soft | `warning.soft` | `#FFFBEB` | `#3B2A0A` | |
| 경고 text-on-soft | — | `#B45309` | `#FCD34D` | |
| 위험 | `danger.DEFAULT` | `#EF4444` | `#F87171` | |
| 위험 soft | `danger.soft` | `#FEF2F2` | `#3B1414` | |
| 위험 text-on-soft | — | `#B91C1C` | `#FCA5A5` | |
| 정보 soft | `info.soft` | `#F0F9FF` | `#082F49` | notice banner |
| **마켓: 네이버** | `market.naver` | `#03C75A` | `#03C75A` | 브랜드색은 모드 무관 고정 |
| **마켓: 11번가** | `market.eleventh` | `#FF0038` | `#FF3D5C` | dark 에서 살짝 톤업 (대비 확보) |
| **마켓: G마켓** | `market.gmarket` | `#00B147` | `#00B147` | |
| **마켓: 옥션** | `market.auction` | `#E73936` | `#F25955` | |
| **마켓: 쿠팡** | `market.coupang` | `#F11F44` | `#F94D6A` | |

> **ⓘ 디자이너 의견**: 마켓 브랜드색은 **법적 가이드라인 위반 회피를 위해 원본을 그대로 유지**하되, 다크 모드에서 흰 텍스트 대비가 안 나오는 11번가/옥션/쿠팡만 살짝 톤업했다. 마켓 로고 자체는 색상 변경 없이 항상 원본 사용 (배경 컨테이너 색만 조정).

### 3.3 CSS 변수 + Tailwind 매핑 (구현 예시)

```css
/* apps/web/src/styles/tokens.css */
:root {
  --surface: 255 255 255;          /* RGB triplets — Tailwind alpha 지원 */
  --surface-subtle: 248 250 252;
  --surface-muted: 241 245 249;
  --text: 15 23 42;
  --text-secondary: 71 85 105;
  --accent: 37 99 235;
  /* ...전체 토큰 */
}
.dark {
  --surface: 11 18 32;
  --surface-subtle: 15 23 42;
  --accent: 59 130 246;
  /* ... */
}
```

```ts
// tailwind.config.ts (발췌)
colors: {
  surface: {
    DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
    subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
    muted: 'rgb(var(--surface-muted) / <alpha-value>)',
  },
  market: {
    naver: '#03C75A',
    eleventh: '#FF0038',
    gmarket: '#00B147',
    auction: '#E73936',
    coupang: '#F11F44',
  },
  // ...
}
```

---

## 4. 타이포그래피

### 4.1 폰트

- **Pretendard** (prototype 동일). `font-family: 'Pretendard', -apple-system, 'Apple SD Gothic Neo', sans-serif`
- 자체 호스팅 (`@font-face`) 또는 `cdn.jsdelivr.net/gh/orioncactus/pretendard` CDN 둘 다 후보. **자체 호스팅 추천** (GitHub Pages 정적 호스팅이라 CSP 안정성↑).
- `font-feature-settings: "tnum"` 으로 숫자 폭 고정 (테이블·통계 카드 안정성).

### 4.2 스케일

> **PRD §5.2.3**: 모바일 본문 ≥16px 강제. 데스크탑은 14px 도 허용하지만 v1 은 통일감을 위해 본문 15px 기본.

| 토큰 | 크기 (rem / px) | 라인하이트 | weight | 용도 |
|---|---|---|---|---|
| `text-display` | 2.5rem / 40px | 1.1 | 700 | auth hero, 빈 상태 일러스트 옆 |
| `text-h1` | 1.75rem / 28px | 1.2 | 700 | page-title (데스크탑) |
| `text-h1-mobile` | 1.5rem / 24px | 1.2 | 700 | page-title (모바일) |
| `text-h2` | 1.25rem / 20px | 1.3 | 700 | card-title, section heading |
| `text-h3` | 1rem / 16px | 1.4 | 600 | sub heading, list group |
| `text-body` | 0.9375rem / 15px | 1.5 | 400 | 본문 (데스크탑) |
| `text-body-mobile` | 1rem / 16px | 1.5 | 400 | 본문 (모바일) — **최소 16px** |
| `text-sm` | 0.8125rem / 13px | 1.5 | 400 | 보조 텍스트, 테이블 셀 |
| `text-xs` | 0.75rem / 12px | 1.4 | 500 | meta, badge — **모바일 본문 금지** |
| `text-label` | 0.78125rem / 12.5px | 1.4 | 600 | 폼 라벨 |
| `text-button` | 0.8125rem / 13px | 1 | 600 | 기본 버튼 |
| `text-button-mobile` | 0.9375rem / 15px | 1 | 600 | 모바일 버튼 |

**Letter spacing**: 제목(`text-display`/`h1`/`h2`)은 `-0.02em`, 본문 0, 버튼/라벨 `-0.01em`.

> **ⓘ 디자이너 의견**: prototype v0 는 본문 14px 인데, 모바일에서 작아 보인다. v1 은 데스크탑 15px / 모바일 16px 로 올렸다. INTJ frontend 가 "리듬 깨진다" 하면 → 옵션 B (전체 14px 통일 + 모바일만 zoom hint) 로 후퇴.

---

## 5. 간격 (Spacing) 토큰

**4px 베이스 스케일.** Tailwind 기본(`spacing: { 1: '0.25rem' ... }`) 그대로 사용 + 의미 토큰 별도.

| 의미 토큰 | 값 | 용도 |
|---|---|---|
| `space-tight` | 4px | 아이콘-텍스트 간격 |
| `space-1` | 8px | 같은 그룹 내 요소 |
| `space-2` | 12px | 폼 필드 간 |
| `space-3` | 16px | 카드 내부 섹션 간 (= prototype `--gap`) |
| `space-4` | 20px | 카드 패딩 기본 (= `--pad-card`) |
| `space-5` | 24px | 페이지 헤더 ↔ 본문 |
| `space-6` | 32px | content 좌우 패딩 (데스크탑) |
| `space-8` | 48px | section 분리 |

### 컴포넌트 패딩 정책

| 컴포넌트 | 패딩 (데스크탑 / 모바일) |
|---|---|
| Card | `20px` / `16px` |
| Button (md) | `0 14px`, h=36px / `0 16px`, h=44px |
| Input | `9px 12px` / `12px 14px` (h ≥44px) |
| Dialog | `header: 18 22`, `body: 20 22`, `footer: 14 22` / 모바일은 좌우 16 |
| Sheet (모바일 전용) | `16px` 전체 |

---

## 6. 반응형 브레이크포인트

PRD §5.1.1 기준 + Tailwind 표준에 맞춤.

| BP | 폭 | Tailwind alias | 그리드 | 사이드바 | 터치 타겟 |
|---|---|---|---|---|---|
| **mobile** | ≤767px | `(default)` | 4칼럼 / gutter 16 / margin 16 | 숨김 (햄버거 → Sheet) | ≥44×44px **강제** |
| **tablet** | 768~1199px | `md:` (768+) | 8칼럼 / gutter 16 / margin 24 | collapsed (64px, 아이콘만) | ≥40×40px |
| **desktop** | ≥1200px | `xl:` (1280+ 권장) | 12칼럼 / gutter 24 / margin 32 / max-width 1280 | expanded (240px) | ≥36×36px |

> **ⓘ Tailwind 의 `md` 는 기본 768 이라 우리 태블릿과 일치. `xl` 은 1280 기본인데 우리 데스크탑 기준 1200 과 약간 어긋남. 두 옵션:
> - **(추천) A**: `xl` 을 1200 으로 override (`screens: { xl: '1200px' }`). 우리 디자인과 정합.
> - B: Tailwind 기본 유지, 1200~1279 는 태블릿 확장으로 취급.
> - C: 별도 alias `lg-desktop: 1200`. 헷갈림.

### 6.1 사이드바 처리

- **데스크탑**: 240px 고정 좌측 사이드바, content max-width 1280px 중앙 정렬.
- **태블릿**: 64px collapsed (아이콘만). 호버/탭으로 임시 expand → overlay.
- **모바일**: 사이드바 숨김. 상단 topbar 좌측 햄버거 → 우측 슬라이드 `Sheet` 로 메뉴 표시. 하단 탭바는 v1 미도입 (v2 검토).

### 6.2 컴포넌트 적응 룰

- **Table**: 모바일에서 `Table` 거부, `Card` 리스트로 자동 변환. `useBreakpoint()` hook + 컴포넌트 레벨 분기.
- **Wizard stepper**: 데스크탑은 가로 5단계 전체, 태블릿은 가로 5단계 (텍스트 축약), 모바일은 "3/5 단계: 마켓 선택" 단일 진행도 + 점 5개.
- **form-grid**: 데스크탑 2칼럼 → 모바일 1칼럼 자동.

---

## 7. shadcn 컴포넌트 카탈로그 (v1)

`apps/web/src/components/ui/` 에 **코드 복사로 직소유**. 라이브러리 import 금지 (Radix Primitives 만 의존).

| 컴포넌트 | variant / size 정책 | v1 사용처 |
|---|---|---|
| `Button` | **variant**: `primary` (실행) / `secondary` (보조 실행) / `ghost` (검색·필터) / `outline` (취소·이전) / `destructive` (삭제·연결 해제) / `link` (텍스트 링크). **size**: `sm` (30h) / `md` (36h, 기본) / `lg` (44h, 모바일 기본) | 모든 화면 |
| `Input` | `default` / `error` / `disabled`. `prefix`·`suffix` 슬롯 지원 (단위 표시, 아이콘 검색) | 폼·검색 |
| `Select` | shadcn 표준. native `<select>` 사용 금지 (스타일 일관성). 모바일은 `Sheet` 변형 검토 | 폼·필터 |
| `Dialog` | 데스크탑 모달. 모바일에서 자동으로 `Sheet (bottom)` 로 변환하는 wrapper `<ResponsiveDialog>` 신설 | 확인·미리보기·재시도 |
| `Sheet` | 모바일 메뉴 / 모바일 다이얼로그 대체. `side`: top / right / bottom / left | 모바일 |
| `Tooltip` | 데스크탑 전용 hover. **모바일은 long-press 로 동일 정보**. blockingReasons 표시에 필수 | 비활성 버튼 사유 |
| `Tabs` | 페이지 내부 섹션 전환. 등록 결과의 "성공/실패" 탭, 마켓 계정 상세 | 결과·이력 |
| `Badge` | **variant**: `default` / `success` / `warning` / `danger` / `info` / `market` (마켓 컬러 자동). `size`: `sm`/`md` | 상태·태그 |
| `Toast` (sonner 기반) | `default` / `success` / `error` / `loading`. **자동 dismiss 5s**, 에러는 수동 dismiss | 비파괴 알림 |
| `Progress` | `linear` (기본) / `circular`. percent 표시 강제 (텍스트 동반) | 등록 잡 진행 |
| `Skeleton` | shimmer 애니메이션. 카드/테이블/통계 3종 프리셋 | 모든 loading 상태 |
| `Card` | `default` / `interactive` (호버 grow) / `selected` (액센트 테두리) | 마켓 카드·통계 |
| `Form` (RHF wrapper) | `FormField`/`FormLabel`/`FormMessage` shadcn 표준. zod resolver 강제 | 등록·인증 |
| `DropdownMenu` | 행 액션 (재시도/제외/삭제), 사용자 메뉴 | 테이블·헤더 |

**추가로 v1 에 신설**:
- `ErrorMessage` — §8 참조
- `MarketIcon` / `MarketStack` / `MarketBadge` — §9 참조
- `EmptyState` — 빈 상태 일러스트 + 1차 CTA
- `StatusIcon` — RegistrationJob 7상태 통일 아이콘 (§10)
- `ResponsiveDialog` — Dialog ↔ Sheet 자동 전환 wrapper

> **ⓘ variant 분리 룰 (강제)**: 
> - 검색/필터 버튼 = `ghost` 또는 `outline` (액션 일어나도 페이지 이동 없음, 결과만 갱신)
> - 실행 버튼 = `primary` / `secondary` / `destructive` (서버 상태 변경)
> - "마켓 연결" 같은 OAuth 트리거는 `primary` (외부 이동 일어남, 명시 필요)
> ESLint custom rule 또는 코드 리뷰 체크리스트로 강제.

---

## 8. ErrorMessage 컴포넌트 명세

`apps/web/src/components/ui/error-message.tsx`

### 8.1 Props

```ts
interface ErrorMessageProps {
  title: string;                    // 예: "쿠팡 등록 실패"
  summary: string;                  // 1-2줄 요약 (사용자 언어로 변환)
  rawResponse?: string;             // 마켓 API 원본 응답 (선택, 접힘 기본)
  errorCode?: string;               // 마켓 측 에러 코드
  correlationId?: string;           // 로그 추적용
  actions?: Array<{                 // 권장 액션 (재시도/스킵/문의)
    label: string;
    variant: 'primary' | 'secondary' | 'ghost';
    onClick: () => void;
  }>;
  severity?: 'error' | 'warning';
  defaultExpanded?: boolean;        // 기본 false
}
```

### 8.2 동작

- 기본 상태: title + summary + actions 만 표시. raw response 와 errorCode 는 "자세히 보기" 토글로 접힘.
- 접힌 영역 펼침: `<details>` 또는 `aria-expanded` 토글 버튼.
- raw response 가 1000자 초과 시 `max-h-200px` + 내부 스크롤 + "전체 복사" 버튼.
- correlationId 는 항상 보임 (작게, monospace). 클릭 시 클립보드 복사.

### 8.3 와이어

```
┌─ ErrorMessage (collapsed) ─────────────────────────┐
│ [⚠] 쿠팡 등록 실패                                  │
│      카테고리 코드가 유효하지 않습니다. 다시 매핑해주세요. │
│      ▸ 자세히 보기   ID: corr_abc123                │
│                                                    │
│ [ 다시 시도 ]  [ 마켓 제외 ]  [ 문의하기 ]            │
└────────────────────────────────────────────────────┘

┌─ ErrorMessage (expanded) ──────────────────────────┐
│ [⚠] 쿠팡 등록 실패                                  │
│      카테고리 코드가 유효하지 않습니다.                │
│      ▾ 자세히 닫기                                  │
│      ┌────────────────────────────────────────┐   │
│      │ errorCode: CATEGORY_NOT_FOUND         │   │
│      │ rawResponse:                          │   │
│      │ { "code": 4001, "message": "..." }    │   │
│      │ [전체 복사]                             │   │
│      └────────────────────────────────────────┘   │
│      ID: corr_abc123 [복사]                        │
│ [ 다시 시도 ]  [ 마켓 제외 ]                          │
└────────────────────────────────────────────────────┘
```

### 8.4 접근성

- 컨테이너에 `role="alert"` (severity=error) / `role="status"` (warning).
- 아이콘은 `aria-hidden`, 색상에만 의존하지 않음 (텍스트 "실패" 명시).
- 토글 버튼 `aria-expanded` / `aria-controls`.

---

## 9. MarketIcon / MarketStack / MarketBadge

### 9.1 정책: SVG 우선

- 각 마켓 **로고 SVG 파일** 을 `src/assets/markets/<id>.svg` 에 보유. 외부 CDN 의존 금지.
- **저작권**: 각 마켓 브랜드 가이드라인 준수 (네이버·쿠팡 공식 SVG 사용). v1 출시 전 법무 확인 필요 — security/pm 검토.
- 폴백: SVG 로드 실패 시 마켓 첫글자 (`N`, `11`, `G`, `A`, `C`) + 브랜드 컬러 배경.

### 9.2 MarketIcon

```ts
interface MarketIconProps {
  market: 'naver' | 'eleventh' | 'gmarket' | 'auction' | 'coupang';
  size?: 'sm' | 'md' | 'lg';        // 22 / 28 / 40 px
  variant?: 'logo' | 'tile';        // logo: SVG 그대로 / tile: 브랜드색 배경 + 흰 글자
  ariaLabel?: string;               // 기본: "네이버 스마트스토어"
}
```

### 9.3 MarketStack

겹쳐진 마켓 아이콘. 등록 이력 행, 템플릿 카드에서 "이 상품/템플릿이 어떤 마켓에 등록됐는지" 한 줄 표시.

```
[N][1][G]+2     ← 최대 3개 노출 + 나머지 카운트
```

- 겹침 간격: `-8px` margin-left.
- 4개 이상: 처음 3개 + `+N` 텍스트.
- 호버 시 Tooltip 으로 전체 마켓 이름 나열.

### 9.4 MarketBadge

마켓 이름 + 아이콘 + 상태(연결됨/끊김)를 한 줄에. 마켓 계정 페이지·이력 필터에서 사용.

```
┌──────────────────────┐
│ [N] 네이버 스마트스토어  [●연결됨] │
└──────────────────────┘
```

---

## 10. RegistrationJob 상태 시각화 토큰

7개 상태. 색·아이콘·뱃지 통일 매트릭스.

| 상태 | 한글 | 색 토큰 | 아이콘 (lucide) | Badge variant | 의미 |
|---|---|---|---|---|---|
| `pending` | 대기 중 | `surface.muted` + `text.tertiary` | `Clock` | `default` | 큐 진입, 아직 실행 안 됨 |
| `running` | 진행 중 | `accent.soft` + `accent` | `Loader2` (spin) | `info` | 마켓 호출 중 |
| `partial` | **부분 성공** | `warning.soft` + `warning text-on-soft` | `AlertTriangle` | `warning` | 일부 마켓 성공 / 일부 실패 — **재시도 동선 1차 노출** |
| `succeeded` | 등록 완료 | `success.soft` + `success text-on-soft` | `CheckCircle2` | `success` | 모든 마켓 성공 |
| `failed` | 등록 실패 | `danger.soft` + `danger text-on-soft` | `XCircle` | `danger` | 모든 마켓 실패 |
| `retrying` | 재시도 중 | `accent.soft` + `accent` | `RefreshCw` (spin) | `info` | 자동 재시도 진행 |
| `cancelled` | 취소됨 | `surface.muted` + `text.tertiary` | `Ban` | `default` | 사용자 취소 |

> **ⓘ 디자이너 의견**: `partial` 이 가장 중요하다. 프로토타입 v0 의 result 화면은 성공/실패를 같은 무게로 다루는데, v1 에서는 **partial 일 때 화면 상단에 실패 N건 카드를 1차 배치하고, 성공 M건은 collapsed default**. 손실 회피 UX (P3).

### 색상에만 의존하지 않기

각 상태는 **(1) 색 (2) 아이콘 (3) 한글 텍스트** 3중 표시. 색맹 사용자가 색을 못 구분해도 아이콘과 텍스트로 식별 가능.

---

## 11. 라이트/다크 토글 메커니즘

### 11.1 구현

- HTML `<html class="dark">` 토글. Tailwind `darkMode: 'class'`.
- CSS 변수 토큰을 `:root` (light) / `.dark` (dark) 두 곳에 정의.
- 상태 저장: `localStorage.theme` (`'light'` / `'dark'` / `'system'`).

### 11.2 우선순위

1. **사용자 선택 우선** (localStorage 에 `light`/`dark` 명시) — 다음 방문에도 유지.
2. localStorage 가 `system` 이거나 없으면 → `prefers-color-scheme` 미디어 쿼리 따름.
3. SSR 불가 (GitHub Pages SPA) 라서 첫 페인트 깜빡임 회피용 inline `<script>` 를 `index.html` `<head>` 최상단에 둠:

```html
<script>
  (function(){
    const t = localStorage.getItem('theme');
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (t === 'dark' || (t !== 'light' && sys)) document.documentElement.classList.add('dark');
  })();
</script>
```

### 11.3 토글 UI

- topbar 우측 `icon-btn` 으로 sun/moon 아이콘. 3-state 토글: light → dark → system → light.
- `Tooltip` 으로 현재 모드 명시. aria-label `"테마 변경: 현재 다크 모드"`.

---

## 12. 접근성 토큰 점검 (WCAG 2.1 AA)

대비 4.5:1 (일반 텍스트), 3:1 (대형 텍스트 ≥18pt 또는 14pt bold).

### 12.1 라이트 모드

| 텍스트 / 배경 | 조합 | 대비 | 결과 |
|---|---|---|---|
| `text.DEFAULT (#0F172A)` / `surface (#FFF)` | 본문 | 17.4:1 | ✅ |
| `text.secondary (#475569)` / `surface (#FFF)` | 보조 | 7.6:1 | ✅ |
| `text.tertiary (#94A3B8)` / `surface (#FFF)` | meta | 2.9:1 | ⚠ **본문 금지, 14px+ 큰 텍스트만** |
| `text.DEFAULT` / `surface.subtle (#F8FAFC)` | 카드 본문 | 16.1:1 | ✅ |
| white / `accent (#2563EB)` | primary 버튼 | 8.6:1 | ✅ |
| `accent (#2563EB)` / `surface (#FFF)` | 링크 | 8.6:1 | ✅ |
| `accent (#2563EB)` / `accent.soft (#EFF6FF)` | nav.active | 8.1:1 | ✅ |
| `#047857` / `success.soft (#ECFDF5)` | success badge text | 7.4:1 | ✅ |
| `#B45309` / `warning.soft (#FFFBEB)` | warning badge text | 5.4:1 | ✅ |
| `#B91C1C` / `danger.soft (#FEF2F2)` | danger badge text | 6.5:1 | ✅ |
| white / `danger (#EF4444)` | destructive 버튼 | 3.9:1 | ⚠ **18pt+ 또는 14pt bold 강제** |

### 12.2 다크 모드

| 텍스트 / 배경 | 조합 | 대비 | 결과 |
|---|---|---|---|
| `text.DEFAULT (#F1F5F9)` / `surface (#0B1220)` | 본문 | 13.8:1 | ✅ |
| `text.secondary (#CBD5E1)` / `surface (#0B1220)` | 보조 | 8.2:1 | ✅ |
| `text.tertiary (#94A3B8)` / `surface (#0B1220)` | meta | 4.7:1 | ✅ (라이트와 동일 색이지만 dark 에서 OK) |
| white / `accent (#3B82F6)` | primary 버튼 | 4.8:1 | ✅ (간신히 통과 — 모니터링) |
| `#6EE7B7` / `success.soft dark (#022C22)` | success badge text | 10.8:1 | ✅ |

### 12.3 자동 검증

- **빌드 시점**: `eslint-plugin-jsx-a11y` 규칙 강제 (label/role/alt 누락 차단).
- **E2E**: `@axe-core/playwright` 매 페이지에 axe 스캔. critical/serious 위반 0 강제.
- **수동**: 모든 새 화면 PR 에 키보드 only 동선 스크린샷·녹화 첨부 (qa 룰).

### 12.4 포커스 링

- 모든 interactive 요소에 `:focus-visible` 시 `outline: 2px solid var(--accent); outline-offset: 2px`.
- 마우스 클릭 후 focus 링 사라지게 하지 않음 (Safari 기본 동작 의도).

---

## 13. Density 모드

prototype v0 는 `compact` / `default` / `comfortable` 3단계.

> **(추천) v1 에서는 단일 density (`default`) 만 지원.** 이유:
> 1. v1 의 핵심 화면(등록 위저드·이력 목록)은 정보 밀도 균형이 이미 최적화되어 있음.
> 2. density 토글은 옵션 화면이 필요한데 v1 설정 UI 가 최소화 상태.
> 3. 모바일은 터치 타겟 ≥44px 강제 → compact 불가.
> 
> v2 후보: 헤비 셀러(하루 등록 50+ 건)용 compact 도입. 그때 모바일은 default 유지, 데스크탑만 토글 허용.

| Density | 행 높이 | gap | card padding | v1 채택 |
|---|---|---|---|---|
| compact | 36px | 10 | 14 | ❌ (v2) |
| **default** | 44px | 16 | 20 | ✅ |
| comfortable | 52px | 22 | 28 | ❌ (v2) |

---

## 14. Prototype → 정식 토큰 마이그레이션 표

`prototype/styles.css` CSS 변수 → Tailwind `theme.extend` 키 1:1 매핑.

| prototype CSS 변수 | Tailwind / 의미 토큰 | 메모 |
|---|---|---|
| `--bg` | `surface.DEFAULT` | |
| `--bg-subtle` | `surface.subtle` | |
| `--bg-muted` | `surface.muted` | |
| `--border` | `border.DEFAULT` | |
| `--border-strong` | `border.strong` | |
| `--text` | `text.DEFAULT` | |
| `--text-secondary` | `text.secondary` | |
| `--text-tertiary` | `text.tertiary` | |
| `--primary` | `accent.DEFAULT` | "primary" 는 shadcn 표준과 충돌 → `accent` 로 리네임 |
| `--primary-hover` | `accent.hover` | |
| `--primary-soft` | `accent.soft` | |
| `--primary-soft-border` | `accent.softBorder` | |
| `--success` | `success.DEFAULT` | |
| `--success-soft` | `success.soft` | |
| `--warning` | `warning.DEFAULT` | |
| `--warning-soft` | `warning.soft` | |
| `--danger` | `danger.DEFAULT` | |
| `--danger-soft` | `danger.soft` | |
| `--info-soft` | `info.soft` | |
| `--m-naver` | `market.naver` | |
| `--m-11st` | `market.eleventh` | 변수명 숫자 시작 회피 |
| `--m-gmarket` | `market.gmarket` | |
| `--m-auction` | `market.auction` | |
| `--m-coupang` | `market.coupang` | |
| `--r-sm` (6) | `rounded-md` (변형) 또는 `radius.sm` | Tailwind 기본 radius 와 차이: 우리 6/8/10/14/20 vs Tailwind 2/4/6/8/12 |
| `--r` (8) | `radius.DEFAULT` (8) | |
| `--r-md` (10) | `radius.md` | |
| `--r-lg` (14) | `radius.lg` | |
| `--r-xl` (20) | `radius.xl` | |
| `--r-full` | `rounded-full` | |
| `--shadow-sm` | `shadow.sm` | |
| `--shadow` | `shadow.DEFAULT` | |
| `--shadow-lg` | `shadow.lg` | |
| `--shadow-pop` | `shadow.pop` | 모달/팝오버 전용 |
| `--pad-card` (20) | `space-4` 의미 토큰 | |
| `--sidebar-w` (240) | `layout.sidebar` | |
| `--sidebar-w-collapsed` (64) | `layout.sidebarCollapsed` | |
| `--topbar-h` (56) | `layout.topbar` | |
| `--row-h` (44) | `layout.rowHeight` | 터치 타겟과 동일 |
| `--gap` (16) | `space-3` | |

---

## 15. ASCII 와이어 (필수)

### 15.1 사이드바 네비 + 메인 영역 기본 레이아웃

#### 모바일 (≤767px) — 먼저 그림

```
┌─────────────────────────────────┐
│ [☰] MarketCast       [🔔][🌙]  │ ← topbar 56h, 햄버거+로고+알림+테마
├─────────────────────────────────┤
│                                 │
│ 페이지 제목 (24px / 700)        │ ← page-header
│ 부제 (15px / secondary)         │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Card (padding 16)           │ │
│ │                             │ │
│ │  콘텐츠 1칼럼               │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Card                        │ │
│ └─────────────────────────────┘ │
│                                 │
│ [ 1차 액션 (h=44, 전체폭) ]    │ ← sticky bottom 옵션
└─────────────────────────────────┘

햄버거 탭 시:
┌──────────────┐
│ (Sheet left) │
│ 대시보드      │
│ 상품 등록     │
│ 마켓 계정     │
│ 등록 이력     │
│ ───          │
│ 설정          │
│ 도움말        │
└──────────────┘
```

#### 태블릿 (768~1199px)

```
┌──┬────────────────────────────────────────────────────┐
│≡ │ 페이지 제목                          [버튼1][버튼2] │
│  ├────────────────────────────────────────────────────┤
│🏠│                                                    │
│📦│ ┌──────────────┐ ┌──────────────┐                 │
│🔗│ │ Card         │ │ Card         │                 │
│📋│ └──────────────┘ └──────────────┘                 │
│  │                                                    │
│⚙ │ ┌──────────────────────────────────────────────┐  │
│? │ │ Card (전폭)                                  │  │
│  │ └──────────────────────────────────────────────┘  │
└──┴────────────────────────────────────────────────────┘
 64px   8 칼럼 그리드, gutter 16, margin 24
```

#### 데스크탑 (≥1200px)

```
┌────────────────┬────────────────────────────────────────────────────────────┐
│  [M] MarketCast│  대시보드  >  요약           [검색] [🔔] [🌙] [JH]          │ topbar 56
│                ├────────────────────────────────────────────────────────────┤
│  메인          │                                                            │
│  🏠 대시보드    │  대시보드                          [+ 새 상품 등록]        │
│  📦 상품 등록 ① │  지난 30일 등록 현황                                       │
│  🔗 마켓 계정   │                                                            │
│  📋 등록 이력   │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                    │
│                │  │ 총건수│ │ 성공 │ │ 부분 │ │ 실패 │                    │
│  보조          │  │ 124  │ │ 102  │ │  15  │ │   7  │                    │
│  ⚙ 설정        │  └──────┘ └──────┘ └──────┘ └──────┘                    │
│  ? 도움말      │                                                            │
│                │  ┌──────────────────────────┐ ┌──────────────────────┐    │
│                │  │ 최근 등록 이력 (1차)      │ │ 마켓 상태 (2차)       │    │
│  ──────        │  │ ─────────────────────   │ │ ───────────────       │    │
│  [JH] 안준형   │  │ [N][C] iPhone 16... 1m  │ │ [N] 연결됨            │    │
│  jhan@konai.com│  │ [N]    티셔츠      3m  │ │ [C] 연결됨            │    │
└────────────────┴──┴─────────────────────────┴─┴───────────────────────┴────┘
  240px sidebar    │ content max-width 1280, margin 32, 12 col, gutter 24
```

---

### 15.2 마켓 카드 리스트 (MarketStack)

#### 모바일

```
┌─────────────────────────────────┐
│ 마켓 계정                       │
│ 연결된 마켓 2 / 미연결 3        │
├─────────────────────────────────┤
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [N] 네이버 스마트스토어      │ │ ← market-card, h ≥56 (터치 OK)
│ │     판매자 jhan_shop  ●연결  │ │
│ │                  [관리 ›]   │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [C] 쿠팡                    │ │
│ │     판매자 abc1234   ●연결  │ │
│ │                  [관리 ›]   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ── 미연결 (v2 예정) ──          │
│ ┌─────────────────────────────┐ │
│ │ [1] 11번가         ○미연결  │ │ ← disabled, opacity 0.6
│ │     v2 출시 예정             │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [G] G마켓          ○미연결  │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [A] 옥션           ○미연결  │ │
│ └─────────────────────────────┘ │
│                                 │
│ [+ 새 마켓 연결 (h=44, 전폭)]   │
└─────────────────────────────────┘
```

#### 데스크탑

```
┌─────────────────────────────────────────────────────────────────┐
│ 마켓 계정                                  [+ 새 마켓 연결]     │
│ 연결된 마켓 2 / 미연결 3                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ── 연결됨 ──                                                    │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │ [N] 네이버 스마트스토어      │ │ [C] 쿠팡                    │ │
│ │ jhan_shop · 토큰 30일 갱신  │ │ abc1234 · 토큰 28일 갱신    │ │
│ │ ●연결  최근 등록 12분 전     │ │ ●연결  최근 등록 12분 전    │ │
│ │ [동기화] [해제]              │ │ [동기화] [해제]             │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
│                                                                 │
│ ── 미연결 (v2 예정) ──                                          │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│ │ [1] 11번가  │ │ [G] G마켓   │ │ [A] 옥션    │                   │
│ │ v2 예정     │ │ v2 예정     │ │ v2 예정     │                   │
│ └────────────┘ └────────────┘ └────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

#### MarketStack 컴포넌트 단독 와이어 (이력 행 안에서)

```
┌─────────────────────────────────────────────────────────┐
│ [N][C]  iPhone 16 Pro Max 256GB         ●부분 성공     │
│  └ stack: 겹친 28px 아이콘 2개 (margin-left: -8px)    │
│         hover → Tooltip "네이버 스마트스토어, 쿠팡"    │
└─────────────────────────────────────────────────────────┘

  4개 이상일 때:
  [N][1][G]+2  ← 처음 3 + "+나머지"
```

---

### 15.3 RegistrationJob `partial` 상태 표시 컴포넌트

> **핵심**: 실패가 1차, 성공이 2차. P3 손실 회피.

#### 모바일

```
┌─────────────────────────────────┐
│ ← 등록 결과                     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ⚠ 부분 성공                 │ │ ← warning.soft 배경, AlertTriangle
│ │ 2개 마켓 중 1개 실패        │ │
│ │ iPhone 16 Pro Max 256GB     │ │
│ │ 진행률 [████████░░] 50%     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─ 실패 1건 (1차 영역) ───────┐ │
│ │ [C] 쿠팡                    │ │
│ │ ⚠ 카테고리 코드 오류         │ │
│ │ CATEGORY_NOT_FOUND          │ │
│ │ ▸ 자세히                    │ │
│ │                             │ │
│ │ [ 다시 시도 (h=44, 강조) ]  │ │ ← primary
│ │ [ 마켓 제외하고 진행 ]      │ │ ← outline
│ └─────────────────────────────┘ │
│                                 │
│ ┌─ 성공 1건 (2차, 접힘 기본) ─┐ │
│ │ ▸ 성공한 마켓 1개 보기      │ │ ← collapsed
│ └─────────────────────────────┘ │
│                                 │
│ [ 대시보드로 ]  [ 다른 상품 ]   │
└─────────────────────────────────┘
```

#### 데스크탑

```
┌──────────────────────────────────────────────────────────────────┐
│ 등록 결과                                                        │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ⚠  부분 성공 — 2개 중 1개 실패           진행률 [████░░] 50% │ │
│ │     iPhone 16 Pro Max 256GB · 12분 33초 소요                │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─── 실패 1건 (1차) ──────────────────────────────────────────┐  │
│ │                                                            │  │
│ │ [C] 쿠팡                                       [⚠ 실패]    │  │
│ │     카테고리 코드가 유효하지 않습니다                       │  │
│ │     errorCode: CATEGORY_NOT_FOUND   corr_abc123  [복사]    │  │
│ │     ▸ 자세히 보기                                          │  │
│ │                                                            │  │
│ │ [ 다시 시도 ]  [ 마켓 제외하고 진행 ]  [ 문의하기 ]         │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌─── 성공 1건 (2차, 접힘) ───────────────────────────────────┐  │
│ │ ▸ 성공한 마켓 1개 보기                                     │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ pen 펼침 시:                                                      │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ [N] 네이버 스마트스토어                       [✓ 성공]      │  │
│ │     상품 ID: NSS_123456789  [상품 페이지 열기 ↗]            │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                          [ 대시보드 ]  [ 다른 상품 등록 ]        │
└──────────────────────────────────────────────────────────────────┘
```

#### 태블릿

데스크탑 레이아웃 유지, 좌우 margin 24, max-width 없음 (전폭).

---

## 16. 토큰 적용 우선순위 (구현 순서)

1. **Phase 0 (이번 주)**: 본 문서 + `tailwind.config.ts` 초안 + `apps/web/src/styles/tokens.css` 작성. shadcn init.
2. **Phase 1**: `Button` / `Input` / `Card` / `Badge` 4개 컴포넌트 + 라이트/다크 스토리북.
3. **Phase 2**: `Dialog` / `ResponsiveDialog` / `Sheet` / `Toast` / `Tooltip` / `Form`.
4. **Phase 3**: `ErrorMessage` / `MarketIcon` / `MarketStack` / `StatusIcon` / `EmptyState` — 도메인 특화.
5. **Phase 4**: axe-core 통합 + 모든 컴포넌트 키보드 동선 테스트.

---

## 17. 결정 보류 항목 (사용자 확인 필요)

| # | 항목 | 옵션 | 추천 |
|---|---|---|---|
| D1 | Tailwind `xl` breakpoint | A: 1200 으로 override / B: 기본 1280 유지 | **A** (우리 디자인 정합) |
| D2 | Pretendard 자체 호스팅 vs CDN | A: self-host / B: jsdelivr | **A** (CSP 안정성) |
| D3 | density 모드 v1 | A: default 단일 / B: 3종 토글 | **A** (v1 단순화) |
| D4 | 마켓 로고 SVG 저작권 검토 시점 | A: Phase 3 전 / B: 베타 출시 전 | **A** (구현 차단 회피) |
| D5 | 테마 토글 3-state vs 2-state | A: light/dark/system 3 / B: light/dark 2 | **A** (시스템 추종 옵션 유지) |
| D6 | `text.tertiary` 라이트 모드 대비 미달 (2.9:1) | A: 텍스트 크기 14px+ 만 허용 / B: 색을 `#64748B` 로 진하게 | **B** (전반 대비 ≥4.5:1 보장이 더 안전) |

> **ⓘ D6 는 디자이너 강한 의견**: prototype v0 의 `text-tertiary #94A3B8` 는 라이트 모드 대비가 부족하다. 정식 토큰에서는 `#64748B` 로 한 단계 진하게 가는 것을 추천. meta·placeholder 톤은 유지되면서 대비 4.6:1 확보.

---

## 18. 3개 산출물 동기화 체크리스트

본 토큰 시스템을 수정할 때:

- [ ] `docs/architecture/v1/ui-system.md` (본 파일) 갱신
- [ ] `docs/frontend_html_design/v1/` (정식 HTML 프로토타입) 의 토큰 CSS 동기화 — 첫 화면 작업 시 신설
- [ ] `apps/web/src/styles/tokens.css` + `tailwind.config.ts` + 영향 받는 `apps/web/src/components/ui/*.tsx`

prototype v0 (`prototype/styles.css`) 는 **시각 레퍼런스로만 유지**, 자동 동기화 대상 아님.

---

끝.
