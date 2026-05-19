import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'

/**
 * ForgotPasswordPage — n6 비밀번호 찾기.
 * Stage C placeholder. Stage D 에서 Supabase resetPasswordForEmail 통합.
 */
export function ForgotPasswordPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>비밀번호 재설정</CardTitle>
        <CardDescription>가입한 이메일로 재설정 링크를 보내드립니다</CardDescription>
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

export default ForgotPasswordPage
