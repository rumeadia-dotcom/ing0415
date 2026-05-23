# s10 — 알림 (Notifications) 도메인

> 신설: 2026-05-23 (PR3 트랙 진입 stub).
> 본 문서는 **도메인 정의 placeholder** — 실 화면·테이블·Edge Function 구현은 별도 PR.

## 1. 도메인 개요

PRD §1.4.3 (등록 성공/실패 알림) + §2.3.4 (마켓 계정 상태 변경 알림) + §4.2.2 (실시간 오류 알림) 의 통합 도메인. v1 의 알림 발생 트리거는 등록·계정·오류 도메인이 만들고, 본 도메인이 **single source of notification table** + 채널별 발송 (in-app / email).

### 1.1 도메인의 위치

- s10 은 횡단 도메인. user_flow 의 별도 노드 없음 (다른 도메인이 트리거).
- 사이드바 메뉴 = "알림" 아이콘 (헤더 우측 종 모양) → 알림 센터 dropdown / 페이지.

### 1.2 진입 경로

- 헤더의 종 아이콘 → 알림 dropdown (최근 10개 + 모두 보기)
- 모두 보기 → `/notifications` 전체 목록 페이지
- 알림 설정 → `/settings/notifications` (채널×타입 매트릭스)

### 1.3 PRD 매핑

| PRD § | 항목 | 본 도메인에서의 위치 |
|---|---|---|
| §1.4.3 | 등록 성공/실패 알림 설정 (이메일·앱 푸시) | NotificationPreferences 의 `registration_*` 타입 |
| §2.3.4 | 마켓 계정 상태 변경 알림 (토큰 만료·인증 실패) | `markets_*` 타입 |
| §4.2.2 | 실시간 오류 알림 (팝업/배너) | `errors_*` 타입 + in-app 채널 |

## 2. 화면 목록 (계획)

| 라우트 | 파일 | 화면명 | 상태 |
|---|---|---|---|
| `/notifications` | `apps/web/src/features/notifications/pages/NotificationsListPage.tsx` | 알림 목록 | **미구현** |
| `/settings/notifications` | `apps/web/src/features/settings/notifications/pages/SettingsNotificationsPage.tsx` | 알림 설정 (채널×타입 매트릭스 + quiet_hours) | **미구현** |

헤더 종 아이콘 dropdown 은 별도 컴포넌트 (`NotificationBell`) — 매 화면에 글로벌 위치.

## 3. 데이터 모델 (계획)

```
Seller ─┬─ Notification (single source 알림 큐)
        │   { id, sellerId, type, title, body, data jsonb, read, channels[], createdAt, readAt }
        │   type: 'registration_succeeded' | 'registration_failed' | 'markets_token_expired'
        │         | 'markets_auth_failed' | 'errors_*' | ...
        │   channels: ('in_app' | 'email')[]
        │
        └─ NotificationPreferences (셀러별 설정)
            { sellerId, channelType[], quiet_hours_start, quiet_hours_end, timezone, ... }
```

테이블 마이그레이션 — 별도 PR (`apps/api/supabase/migrations/...notifications.sql`).

## 4. 채널별 발송 (계획)

| 채널 | 인프라 | 비고 |
|---|---|---|
| in-app | Supabase Realtime (`notifications` 테이블 변경 구독) | 즉시. 헤더 종 아이콘 unread badge 실시간 갱신. |
| email | Resend API (별도 Edge Function `notify-email`) | 배치 발송. 도메인 인증 선행 (`docs/handoff` 참조). |

## 5. Edge Function 시그니처 (placeholder)

| 함수 | 역할 | 트리거 |
|---|---|---|
| `notify-emit` | type / data 받아 notification row 생성 + 채널별 발송 dispatch | 다른 함수 (registration / markets / errors) 가 호출 |
| `notify-email` | email 채널 dispatch (Resend) | notifications 의 channels 에 'email' 있을 때 |
| `notifications-list` (RPC) | 셀러의 알림 목록 (필터 / 페이지네이션) | 클라이언트 `/notifications` 페이지 |
| `notifications-mark-read` | 단건/전체 read 처리 | UI 알림 클릭 / "모두 읽음" |

## 6. 화면 명세 (계획)

### 6.1 NotificationBell (헤더 글로벌)

- 종 아이콘 + unread count badge (Realtime)
- 클릭 → dropdown 최근 10개 (시간 역순)
- 각 알림 클릭 → 관련 페이지 (등록 잡 / 마켓 계정 / 오류 상세) 이동 + 자동 read 처리

### 6.2 NotificationsListPage `/notifications`

- 전체 목록 (필터: 타입 / 채널 / 기간 / 읽음 여부)
- 페이지네이션
- "모두 읽음" 버튼

### 6.3 SettingsNotificationsPage `/settings/notifications`

- 채널×타입 매트릭스 (체크박스)
- quiet hours 시간대 설정 (timezone 자동)
- 저장 → `notification_preferences` UPDATE

## 7. 구현 진행 (계획)

| 단계 | 작업 | 우선순위 |
|---|---|---|
| 1 | 데이터 모델 — `notifications` / `notification_preferences` 테이블 + RLS | 1 |
| 2 | Edge Function `notify-emit` + 다른 함수의 트리거 통합 | 2 |
| 3 | 헤더 NotificationBell + Realtime 구독 | 3 |
| 4 | `/notifications` 페이지 | 4 |
| 5 | Resend 도메인 인증 + `notify-email` | 5 (외부 의존) |
| 6 | `/settings/notifications` 페이지 | 6 |

각 단계 별도 PR 권장. 본 stub 은 단계 1 진입 전 도메인 정의 합의용.

## 8. 미해결 사안

- Resend 도메인 인증 (`noreply@<도메인>`) — 도메인 미보유 (`rumeadia-dotcom.github.io` 는 GitHub Pages 소유)
  - 대안: 무료 도메인 (sslip.io 같은 wildcard) 사용 불가 (DKIM 검증 실패) → 도메인 구매 또는 v2
- Realtime 채널 구독의 성능 한도 (셀러 수 ↑) — Supabase Realtime 의 동시 연결 한도 확인 필요
- 알림 retention (영구 보존 vs N 일) — v1 단순화로 90일 유지 가정. cron job 으로 정리.

## 9. 비범위 (v2 이후)

- 푸시 알림 (Web Push / Mobile Push) — PWA / 네이티브 앱 진입 시
- 알림 그룹화 (같은 잡 여러 마켓 결과 묶기)
- 알림 템플릿 커스터마이즈 (셀러별)

---

**구현 첫 PR**: 단계 1 (테이블 마이그레이션 + RLS) 부터.
