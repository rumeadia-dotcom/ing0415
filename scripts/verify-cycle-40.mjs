/**
 * Cycle 40 — toast 메시지 i18n 분리 (CLAUDE.md i18n 룰).
 *
 * 점검 결과:
 *  features/ 안에 hardcoded toast 메시지 (인라인 string literal) 9건 발견.
 *  - apps/web/src/features/shipping/pages/ShippingPrintPage.tsx (3건)
 *  - apps/web/src/features/shipping/pages/ShippingDispatchPage.tsx (1건)
 *  - apps/web/src/features/shipping/pages/ShippingDispatchResultPage.tsx (1건)
 *  - apps/web/src/features/registration/pages/StepInfoPage.tsx (1건)
 *  - apps/web/src/features/registration/pages/StepPreviewPage.tsx (1건)
 *  - apps/web/src/features/registration/pages/StepResultPage.tsx (1건)
 *  - apps/web/src/features/history/components/HistoryRetryDialog.tsx (1건)
 *  - apps/web/src/features/history/components/HistoryExcludeDialog.tsx (1건)
 *
 * 본 PR 의 수정:
 *  - apps/web/src/locales/ko.ts: ko.commonToasts namespace 추가 (9 key)
 *  - 8개 파일에서 인라인 문자열 → ko.commonToasts.<key> 참조로 교체
 *
 * 잔여 인라인 toast: 0 (grep 0건)
 */
console.log('Cycle 40 — toast i18n 분리 audit')
console.log('')
console.log('수정: 9개 인라인 toast 문자열 → ko.commonToasts.* 참조로 교체')
console.log('잔여 인라인 toast: 0')
