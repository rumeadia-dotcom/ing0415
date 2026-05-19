import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'

/**
 * SignupPage — n5 회원가입.
 * Stage C placeholder. Stage D 에서 RHF + zod + Supabase signUp 통합.
 */
export function SignupPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>회원가입</CardTitle>
        <CardDescription>이메일과 비밀번호로 MarketCast 계정을 생성하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-text-secondary">회원가입 폼은 Stage D 에서 구현됩니다.</p>
        <div className="text-sm text-text-secondary">
          이미 계정이 있으신가요?{' '}
          <Link
            to="/login"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            로그인
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default SignupPage
