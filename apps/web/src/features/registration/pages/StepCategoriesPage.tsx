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
 * StepCategoriesPage — n19 카테고리 매핑 (4/5).
 * Stage C placeholder. Stage E 에서 마켓별 카테고리 트리 + 매핑 UI.
 */
export function StepCategoriesPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>4단계 — 카테고리 매핑</CardTitle>
        <CardDescription>각 마켓의 카테고리를 선택해 매핑합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">
          카테고리 매핑 UI 는 Stage E 에서 구현됩니다.
        </p>
        <div className="flex justify-between gap-2">
          <Button asChild variant="ghost">
            <Link to="/register/markets">이전</Link>
          </Button>
          <Button asChild variant="primary">
            <Link to="/register/preview">다음: 미리보기</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default StepCategoriesPage
