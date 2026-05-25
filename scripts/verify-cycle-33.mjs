/**
 * Cycle 33 — useEffect cleanup / unmount safety audit.
 *
 * 본 사이클은 코드 grep 기반 검토.
 *
 * 점검 결과:
 *  ✓ useDebounced (registration): setTimeout + clearTimeout 정상
 *  ✓ useNaverTokenRefresh: timerRef + return cleanup 패턴
 *  ✓ main.tsx vite:preloadError: app 라이프타임 — cleanup 불필요
 *  ✓ lib/daum-postcode.ts: addEventListener({ once: true }) — 자동 cleanup
 *  ✓ mock supabase setTimeout: 0 delay, 즉시 실행 → leak 영향 없음
 *  ⚠ StepImagesPage 의 finally setTimeout: unmount 후에도 setState 호출 가능 → mountedRef 패턴으로 보호
 *
 * 본 PR 의 수정:
 *  - StepImagesPage 에 mountedRef 추가, 1.5초 후 setUploading 호출 전 가드.
 */
console.log('Cycle 33 — cleanup audit (코드 grep 기반)')
console.log('')
console.log('수정 사항:')
console.log('  StepImagesPage: mountedRef 추가, finally setTimeout 의 setUploading 안전 가드')
console.log('  unmount 후 1.5초 안에 발생하면 React memory leak warning → mountedRef.current 체크')
