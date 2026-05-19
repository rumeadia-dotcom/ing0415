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
 * StepImagesPage — n18 이미지 업로드 (2/5).
 * Stage C placeholder. Stage E 에서 다중 업로드 / 진행률 / 순서 조정 UI.
 */
export function StepImagesPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>2단계 — 이미지</CardTitle>
        <CardDescription>대표 이미지와 추가 이미지를 업로드합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">
          이미지 업로드 UI 는 Stage E 에서 구현됩니다 (다중 / 진행률 / 취소 / 재시도).
        </p>
        <div className="flex justify-between gap-2">
          <Button asChild variant="ghost">
            <Link to="/register/info">이전</Link>
          </Button>
          <Button asChild variant="primary">
            <Link to="/register/markets">다음: 마켓 선택</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default StepImagesPage
