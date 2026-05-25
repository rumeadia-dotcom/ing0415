import { useEffect } from 'react'

/**
 * document.title 동기화 hook.
 * cycle 30 의 PageHeader 내장 처리 + cycle 31 의 follow-up — PageHeader 미사용 페이지
 * (auth / legal / history detail / wizard steps) 도 명시적으로 title 갱신.
 *
 * 형식: "${title} · MarketCast" (브랜드 suffix 일관).
 * cleanup 에서 원본 복원 — 페이지 unmount 시 안전.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const original = document.title
    document.title = `${title} · MarketCast`
    return () => {
      document.title = original
    }
  }, [title])
}
