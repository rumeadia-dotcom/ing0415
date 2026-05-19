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
 * StepPreviewPage — n20 등록 미리보기 (5/5).
 * Stage C placeholder. Stage E 에서 마켓별 페이로드 미리보기 + 일괄 등록 mutation.
 *
 * 일괄 등록 mutation 성공 시 → /register/result/:jobId 이동 (Stage E).
 */
export function StepPreviewPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>5단계 — 미리보기</CardTitle>
        <CardDescription>마켓별 등록 페이로드를 최종 확인하고 일괄 등록을 실행합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">
          미리보기 + 등록 실행 UI 는 Stage E 에서 구현됩니다.
        </p>
        <div className="flex justify-between gap-2">
          <Button asChild variant="ghost">
            <Link to="/register/categories">이전</Link>
          </Button>
          <Button disabled aria-disabled>
            일괄 등록 실행 (Stage E)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default StepPreviewPage
