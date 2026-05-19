import { PageHeader } from '@/components/layout/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'

/**
 * HistoryListPage — n41 / n42 (등록 이력 목록 + 필터).
 * Stage C placeholder. Stage E 에서 useHistoryFilters (zod 검증) + 페이징 + 재시도.
 */
export function HistoryListPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="등록 이력"
        subtitle="등록 작업 목록과 결과를 확인합니다"
      />
      <Card>
        <CardHeader>
          <CardTitle>이력 목록 — 준비 중</CardTitle>
          <CardDescription>
            필터(기간/마켓/상태) + 잡 목록 + 재시도/마켓 제외 액션이 여기에 구현됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary">
            Stage E 에서 Supabase registration_jobs 조회와 함께 활성화됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default HistoryListPage
