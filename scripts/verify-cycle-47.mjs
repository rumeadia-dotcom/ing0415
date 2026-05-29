/**
 * Cycle 47 — catch / silent failure audit.
 *
 * 점검 결과 (코드 grep, 50+ catch 블록):
 *  대부분 catch 는 의도된 처리:
 *   - structured logger.warn / logger.error
 *   - toast.error 사용자 알림
 *   - fallback return value (graceful degradation)
 *
 *  empty catch (return only):
 *   - auth-error-map serializeRaw → undefined (cycle 44 isDev 가드와 협력)
 *   - markets-api errorBody JSON parse → fallback (정상)
 *   - SettingsShippingPage Intl.DateTimeFormat → raw iso (정상)
 *
 *  raw err.message → user 노출 (이전 잔여 1건):
 *   ⚠ address-search-input.tsx: daum postcode 스크립트 로드 실패 시
 *     err.message 를 사용자에게 직접 노출 → 외부 라이브러리 raw message 라 비-한국어 가능.
 *
 * 본 PR 의 수정:
 *  - address-search-input.tsx: generic 메시지 + console.error(dev) 로 분리.
 *    raw message 는 console / Sentry 만, 사용자에게는 "잠시 후 다시 시도" 안내.
 */
console.log('Cycle 47 — silent failure / raw error audit')
console.log('수정: address-search-input 의 raw err.message 사용자 노출 → generic 메시지')
