<!--
PR 제목 형식: [<도메인>] <요약>
도메인 = auth / dashboard / registration / templates / markets / history / platform / ops / docs
예: [registration] 5단계 위저드 도입
-->

## 변경 요약

<!-- 1~3줄. 왜(why) 중심으로. 어떻게(how) 는 코드가 말한다. -->

## 관련 PRD / user_flow 노드

- PRD: §<번호> <기능명>
- user_flow: s<섹션>.n<노드> (해당 없을 시 "없음" 명시)

## 3개 산출물 동기화 체크

CLAUDE.md "3개 산출물 동기화" 룰에 따라 다음을 확인했습니다:

- [ ] 설계문서 — `docs/architecture/v1/` 관련 문서 갱신 (해당 없을 시 사유)
- [ ] HTML 프로토타입 — `docs/frontend_html_design/v1/` 갱신 (해당 없을 시 사유)
- [ ] 실제 구현 — `src/features/<domain>/` 갱신

## 테스트

- [ ] 단위·통합 (Vitest) — `pnpm test` 통과
- [ ] 타입 — `pnpm typecheck` 통과
- [ ] 린트 — `pnpm lint` 통과
- [ ] E2E 골든패스 — Playwright `@golden` 통과 (영향 시)
- [ ] 신규 테스트 추가: <설명 또는 "없음 + 사유">

## 보안 검토

- [ ] 인증 / 토큰 / OAuth / 자격증명 코드 변경 **없음**
- [ ] 변경 있음 → security 에이전트 리뷰 요청 (코멘트로 호출)
- [ ] 새 로그에 토큰·PII 누출 가능성 확인 (외부 API 로깅 패턴 룰)

## 빌드 모드 영향

- [ ] debug / real 모드 분기에 영향 **없음**
- [ ] 영향 있음 — 두 모드 모두 `pnpm build:debug` / `pnpm build:real` 로컬 확인 완료

## DB / 마이그레이션

- [ ] `supabase/migrations/` 변경 **없음**
- [ ] 변경 있음 — debug 프로젝트에 적용·검증 완료 (스크린샷/SQL 결과 첨부)

## 스크린샷 (UI 변경 시)

<!-- 변경 전 / 후. 다크 + 라이트 모두. 모바일·데스크탑 브레이크포인트 영향이 있다면 함께. -->

## 체크리스트

- [ ] 머지는 squash 로
- [ ] 브랜치명이 `feature/<slug>` / `hotfix/<slug>` / `release/<x.y>` 규약 준수
- [ ] PR 제목이 `[<도메인>] <요약>` 형식
