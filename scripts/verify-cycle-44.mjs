/**
 * Cycle 44 — JSON.stringify audit + auth-error-map raw details production 비공개.
 *
 * 점검 결과 (코드 grep):
 *  - RouteErrorBoundary: cycle 36 에서 production 시 error.message 비공개 처리 완료 ✓
 *  - markets/real/* JSON.stringify(body): 외부 API 요청 body 직렬화 — fetch 표준 사용 ✓
 *  - lib/logen/client.ts: logger 구조화 출력 (이미 redact 컨벤션 따름) ✓
 *  - features/auth/lib/auth-error-map.ts serializeRaw:
 *    ⚠ unknown code 시 raw error 를 details 로 ErrorMessage 에 노출 — production 위험
 *    → isDev 가드 추가
 *
 * 본 PR 의 수정:
 *  - auth-error-map.ts: serializeRaw 호출을 isDev 시에만 — production 에서는 generic 메시지만.
 *  - Sentry beforeSend 의 redact() 와 별개의 사용자 노출 비공개 정책 (이중 안전).
 */
console.log('Cycle 44 — JSON.stringify / raw error production 비공개 audit')
console.log('')
console.log('수정: auth-error-map serializeRaw → isDev 가드')
console.log('영향: production unknown 에러 시 raw stack/details 비공개 (Sentry 로는 송출)')
