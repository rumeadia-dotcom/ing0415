/**
 * Cross-market XML 파서 유틸 (PR-6, `features/11st.md` §8-4).
 *
 * 마스터: docs/architecture/v1/features/11st.md §8
 *
 * 11번가 REST 응답은 XML/EUC-KR + `ns2:` 네임스페이스 prefix 를 단다(`ns2:categorys` /
 * `ns2:order` / `ns2:inOutAddress`). fast-xml-parser(Edge) / DOMParser(Web) 모두 prefix 를
 * 키에 그대로 남기므로, 파싱 결과 객체를 재귀적으로 훑어 단일 선행 `prefix:` 를 제거한다.
 * PR-5 까지는 11번가 어댑터 map 파일에 인라인이었으나, 향후 XML 마켓 대비 + 11번가 내부
 * 일관성을 위해 PR-6 에서 공용 유틸로 추출했다.
 *
 * 순수 모듈 — 런타임 의존 0. Edge(`apps/api/supabase/functions/_shared/xml.ts`) 미러.
 */

/**
 * XML 네임스페이스 prefix 제거. `ns2:categorys` → `categorys`.
 * 선행 영숫자 prefix + 콜론 1개만 제거(재귀, 배열 포함). 입력 비변형(새 객체 반환).
 * 매핑 로직이 prefix 없는 키만 보게 하기 위함.
 */
export function stripNsPrefix(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripNsPrefix)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const key = /^[A-Za-z][A-Za-z0-9]*:/.test(k) ? k.slice(k.indexOf(':') + 1) : k
      out[key] = stripNsPrefix(v)
    }
    return out
  }
  return node
}
