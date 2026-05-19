import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'

/**
 * LoginPage — n2 / n3 / n4 (이메일·소셜 로그인 진입).
 * Stage C placeholder. Stage D 에서 RHF + zod + Supabase Auth 통합.
 */
export function LoginPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>로그인</CardTitle>
        <CardDescription>이메일과 비밀번호로 MarketCast 에 접속하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-text-secondary">
          로그인 폼은 Stage D 에서 구현됩니다.
        </p>
        <div className="text-sm text-text-secondary">
          계정이 없으신가요?{' '}
          <Link
            to="/signup"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            회원가입
          </Link>
        </div>
        <div className="text-sm text-text-secondary">
          <Link
            to="/forgot-password"
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default LoginPage
