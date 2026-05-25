/**
 * Cycle 46 — React key + 외부 링크 새 창 안내 audit.
 *
 * 점검 결과:
 *  - key={idx/i/index} 사용 8건 — 모두 Skeleton 로딩 placeholder 또는 정적 readonly 리스트.
 *    재정렬 없으므로 unstable key 무방. ✓
 *  - target="_blank" 외부 링크 4건:
 *    ✓ ProviderGuideCard.tsx — sr-only "(새 창에서 열림)" 보유
 *    ✓ SettingsShippingLogenPage.tsx — sr-only 보유 (확인)
 *    ⚠ JobMarketResultRow.tsx "외부 상품 보기" — sr-only 누락 → 추가
 *    ⚠ HistoryMarketResultCard.tsx "외부 상품 보기 ↗" — ↗ 가 SR 노출 + sr-only 누락 → 수정
 *
 * 본 PR 의 수정:
 *  - JobMarketResultRow.tsx: <span className="sr-only">(새 창에서 열림)</span> 추가
 *  - HistoryMarketResultCard.tsx: ↗ 를 aria-hidden span 으로 감싸고 sr-only 추가
 */
console.log('Cycle 46 — 외부 링크 새 창 SR 안내 audit')
console.log('수정: 2건 외부 상품 보기 anchor 에 sr-only "(새 창에서 열림)" 추가')
