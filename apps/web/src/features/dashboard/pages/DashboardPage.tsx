import { PageHeader } from '@/components/layout/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'

/**
 * DashboardPage — n9~n12 (대시보드 + 요약 + 최근 등록).
 * Stage C placeholder. Stage D 에서 TanStack Query + Supabase 통합.
 */
export function DashboardPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="대시보드"
        subtitle="등록 현황과 최근 작업을 한눈에 확인하세요"
      />
      <Card>
        <CardHeader>
          <CardTitle>대시보드 — 준비 중</CardTitle>
          <CardDescription>
            요약 통계 카드 / 최근 등록 잡 목록 / 마켓별 상태 위젯이 이 영역에 구현됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary">
            Stage D 에서 실제 데이터 연결과 함께 활성화됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardPage
