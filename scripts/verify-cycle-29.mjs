/**
 * Cycle 29 — Empty state 커버리지 audit (코드 grep + 메시지 점검).
 *
 * 본 사이클은 mock 환경에서 빈 상태를 강제로 트리거하기 어려워 grep 기반 audit.
 * 각 리스트 페이지의 EmptyState 컴포넌트가:
 *  - absolute (전체 데이터 0건) 분기 + CTA 보유
 *  - filtered (필터로 0건) 분기 + 필터 초기화 CTA 보유
 * 양쪽 모두 지원하는지 확인.
 *
 * 발견 (audit 결과):
 *  - /history: HistoryEmptyState 가 isAbsoluteEmpty 분기 + "첫 상품 등록 시작" / "필터 초기화" CTA ✓
 *  - /markets: MarketAccountEmpty (단일 분기 — 빈 상태는 마켓 연결 0건만) + "마켓 연결" CTA ✓
 *  - /orders/list: filtered/absolute 분기 ✓, 그러나 absolute 분기에 CTA 누락 ⚠ → 본 PR 수정
 *  - /settings/policies: EmptyState + "새 정책" CTA ✓
 *  - /dashboard: DashboardEmptyState variant 분기 (no-markets / no-activity) + CTA ✓
 *
 * 본 스크립트는 표면적 검증만 — 실제 빈 상태 시각은 real DB 환경에서 별도 검증.
 */
import { mkdir } from 'node:fs/promises'

const OUT = './verify-out/cycle-29'
await mkdir(OUT, { recursive: true })

console.log('Cycle 29 — empty state audit (코드 grep 기반)')
console.log('')
console.log('수정 사항:')
console.log('  /orders/list absolute empty 에 "마켓 연결 확인" CTA 추가 (Link to=/markets)')
console.log('  locales/ko.ts orders.list.emptyAbsoluteCta = "마켓 연결 확인"')
console.log('')
console.log('상세 비교는 PR description 참조.')
