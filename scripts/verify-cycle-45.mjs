/**
 * Cycle 45 — 이미지 업로드 validation 메시지 i18n.
 *
 * 점검 결과 (코드 grep):
 *  - useImageUpload.ts: 클라이언트 사이드 MIME / size validation 메시지 인라인 한국어 2건.
 *
 * 본 PR 의 수정:
 *  - ko.ts 에 imageUpload namespace 추가 (invalidMime / fileTooLarge)
 *  - useImageUpload.ts 인라인 → ko 참조로 교체
 *
 * MIME 화이트리스트 정합성:
 *  허용: image/jpeg / image/png / image/webp
 *  크기: 10MB
 *  → PRD §1.1.2 / §1.2.2 일치 (마켓별 추가 변환은 Edge Function image-register 책임)
 *
 * 후속:
 *  - Edge Function 의 동일 validation (image-upload-url) 정합성은 backend cycle 에서 별도.
 *  - 마켓별 이미지 규격 자동 최적화 (PRD §1.2.2) 는 Phase 3 image-transform 도입 시 추가.
 */
console.log('Cycle 45 — 이미지 업로드 validation 메시지 i18n')
console.log('수정: useImageUpload 의 invalidMime / fileTooLarge → ko.imageUpload.*')
