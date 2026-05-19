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
 * StepInfoPage — n16 상품 정보 입력 (1/5).
 * Stage C placeholder. Stage D 에서 RHF + zod productInputSchema 결합.
 */
export function StepInfoPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>1단계 — 상품 정보</CardTitle>
        <CardDescription>상품명·가격·설명·브랜드 등 핵심 정보를 입력합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">
          상품 정보 폼은 Stage D 에서 구현됩니다.
        </p>
        <div className="flex justify-end gap-2">
          <Button asChild variant="primary">
            <Link to="/register/images">다음: 이미지</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default StepInfoPage
