/**
 * Cycle 39 — Button variant 사용 일관성 + raw <button> audit.
 *
 * 점검 결과 (코드 grep):
 *  variant="danger" 사용처 (4건) — 모두 destructive 액션의 명확한 강조:
 *   - OrderManualResolveDialog 운송장 수동 입력 submit
 *   - MarketAccountActions 마켓 연결 해제 confirm
 *   - SettingsPoliciesPage 정책 삭제 confirm + PolicyCard 의 행 삭제 트리거
 *   → 일관성 ✓
 *
 *  raw <button> 사용처 (5건) — 모두 특수 케이스로 라벨링 가능:
 *   - ImageThumbnailGrid: 메인/서브 토글 (text only toggle, 작은 영역)
 *   - ImageThumbnailGrid 삭제: 이전엔 raw — 본 PR 에서 <Button variant="ghost"> 로 교체
 *   - HistoryFilterSidebar: Fieldset legend toggle (특수)
 *   - OrdersListPage: FilterChips chip (pill toggle, design 차)
 *   - MarketsConnectProviderPage / LoginPage: input overlay 토글 (absolute positioning)
 *
 * 본 PR 의 수정:
 *  - ImageThumbnailGrid 삭제 버튼: raw <button> + inline text-danger
 *    → <Button variant="ghost" size="sm"> + className text-danger
 */
console.log('Cycle 39 — Button variant 사용 일관성 audit')
console.log('')
console.log('수정 사항:')
console.log('  ImageThumbnailGrid 삭제 버튼 → shadcn Button (variant="ghost", text-danger)')
console.log('')
console.log('그 외 raw <button> 사용처 (4건) 는 모두 특수 케이스 (toggle / chip / overlay) — 유지')
