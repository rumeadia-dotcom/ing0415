import { Link } from 'react-router-dom'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'

/**
 * StepMarketsPage — n17 마켓 선택 (3/5).
 * Stage C placeholder. Stage D 에서 연결된 마켓 목록 + 체크박스 선택.
 */
export function StepMarketsPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>3단계 — 마켓 선택</CardTitle>
        <CardDescription>연결된 마켓 중 등록할 곳을 선택합니다 (1개 이상)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">
          마켓 선택 UI 는 Stage D 에서 구현됩니다.
        </p>
        <div className="flex justify-between gap-2">
          <Button asChild variant="ghost">
            <Link to="/register/images">이전</Link>
          </Button>
          <Button asChild variant="primary">
            <Link to="/register/categories">다음: 카테고리</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default StepMarketsPage
