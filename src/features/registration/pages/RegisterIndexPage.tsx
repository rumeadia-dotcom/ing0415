import { Navigate } from 'react-router-dom'

/**
 * RegisterIndexPage — /register 진입 시 첫 단계로 즉시 이동.
 * frontend.md §2.3 — n15 등록 진입 → /register/info 리다이렉트.
 *
 * loader 대신 컴포넌트 단에서 Navigate (replace) 사용. 라우트 깊이 단순화.
 */
export function RegisterIndexPage(): JSX.Element {
  return <Navigate to="/register/info" replace />
}

export default RegisterIndexPage
