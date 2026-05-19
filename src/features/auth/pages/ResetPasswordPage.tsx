import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'

/**
 * ResetPasswordPage — 비밀번호 재설정 링크 클릭 후 진입 페이지.
 * Stage C placeholder. Stage D 에서 새 비밀번호 입력 폼 + Supabase updateUser 통합.
 */
export function ResetPasswordPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>새 비밀번호 설정</CardTitle>
        <CardDescription>이메일로 받은 링크를 통해 진입한 화면입니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-text-secondary">재설정 폼은 Stage D 에서 구현됩니다.</p>
        <div className="text-sm text-text-secondary">
          <Link
            to="/login"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default ResetPasswordPage
