import { describe, it } from 'vitest'

/**
 * RegistrationJob 7×8 상태 전이 placeholder (registration-job-state.md §4 / §10).
 *
 * **현재 상태**: `nextStatus()` / `decideTerminalStatus()` 함수는 아직 src 에 미구현.
 * 마스터 위치 (예정): `src/lib/registration/state.ts` (registration-job-state.md §10).
 *
 * 본 파일은 Stage G 에서 **테스트 매트릭스 자리 + 의도 명문화**만 한다.
 * 함수 구현이 들어오는 PR 에서 본 파일의 `test.todo` 를 실제 `it()` 로 채우고
 * registration-job-state.md §10.4 의 코드를 그대로 옮겨와 활성화한다.
 *
 * 합법 전이 (11건):
 *   pending  → running, cancelled
 *   running  → succeeded, partial, failed, retrying, cancelled
 *   partial  → retrying
 *   failed   → retrying
 *   retrying → running, cancelled
 *
 * 불법 전이 (45건 = 7상태 × 8이벤트 − 11 합법 − 0 self-trivial − 의미적 불가능 일부):
 *   §4 표의 `❌` 셀 전체. nextStatus 가 IllegalTransitionError throw 필수.
 *
 * 종결 판정 (decideTerminalStatus):
 *   - 전부 success → 'succeeded'
 *   - success + failed_final 혼합 → 'partial'
 *   - 전부 failed_final → 'failed'
 *   - pending / in_flight / failed(non-final) 잔존 → null (판정 금지)
 *   - excluded 는 판정 입력에서 제외
 *   - 전부 excluded → null (호출측이 reject)
 *
 * 본 todo 가 채워지지 않은 상태로 Phase 3 진입을 시도하면 qa-matrix 의 QA-P3-REG-002 가 fail.
 */

describe('RegistrationJob.nextStatus — 합법 11 전이 (registration-job-state.md §4)', () => {
  it.todo('pending + start → running')
  it.todo('pending + cancel → cancelled')
  it.todo('running + all_success → succeeded')
  it.todo('running + mixed_terminal → partial')
  it.todo('running + all_failed → failed')
  it.todo('running + enter_retry → retrying')
  it.todo('running + cancel → cancelled')
  it.todo('partial + user_retry → retrying')
  it.todo('failed + user_retry → retrying')
  it.todo('retrying + retry_resume → running')
  it.todo('retrying + cancel → cancelled')
})

describe('RegistrationJob.nextStatus — 불법 전이 45건 (전수)', () => {
  it.todo('terminal(succeeded) 에서 모든 이벤트는 IllegalTransitionError throw')
  it.todo('terminal(cancelled) 에서 모든 이벤트는 IllegalTransitionError throw')
  it.todo('pending → succeeded/partial/failed/retrying 직접 전이 거부')
  it.todo('partial → running/succeeded/failed 직접 전이 거부 (반드시 retrying 경유)')
  it.todo('failed → running/succeeded 직접 전이 거부 (반드시 retrying 경유)')
  it.todo('retrying → succeeded/partial/failed/pending 직접 전이 거부')
  it.todo('합법 셀 11개 / 불법 셀 매트릭스 전수 (7×8 − 11 = 45 케이스) 매트릭스 루프 검증')
})

describe('RegistrationJob.decideTerminalStatus (§10.3)', () => {
  it.todo('전부 success → succeeded')
  it.todo('success + failed_final 혼합 → partial')
  it.todo('전부 failed_final → failed')
  it.todo('pending 잔존 → null (판정 금지)')
  it.todo('in_flight 잔존 → null (판정 금지)')
  it.todo('failed (non-final) 잔존 → null (재시도 여지)')
  it.todo('excluded 행은 판정에서 제외 → 나머지 전부 success 면 succeeded')
  it.todo('전부 excluded → null (호출측 reject 필수)')
})
