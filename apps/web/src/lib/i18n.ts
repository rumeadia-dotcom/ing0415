import { ko } from '@/locales/ko'

/**
 * i18n dot-path resolver.
 *
 * 마스터: CLAUDE.md "i18n — 사용자 노출 텍스트는 locales/ko.ts path 참조. 하드코딩 금지".
 *
 * 대부분의 화면은 `ko.foo.bar` 로 직접 접근하지만, 어댑터 메타(RegistrationFieldMeta.label /
 * blockingReason / helpText, esm.md §4.6)처럼 **데이터가 i18n key 문자열을 들고 다니는** 경우
 * 런타임에 dot-path 를 해석해야 한다. getEsmRegistrationFields 가 담는
 * 'markets.registrationFields.esmShippingPlace.label' 같은 key 를 본 함수가 ko 트리에서 읽는다.
 *
 * - 값이 문자열이면 그대로 반환.
 * - 경로가 없거나 문자열이 아니면 path 원문을 반환(개발 중 missing key 가 화면에 노출되어
 *   감지 가능 — silent empty 금지).
 */
export function resolveKoPath(path: string): string {
  const segments = path.split('.')
  let cursor: unknown = ko
  for (const seg of segments) {
    if (cursor !== null && typeof cursor === 'object' && seg in cursor) {
      cursor = (cursor as Record<string, unknown>)[seg]
    } else {
      return path
    }
  }
  return typeof cursor === 'string' ? cursor : path
}
