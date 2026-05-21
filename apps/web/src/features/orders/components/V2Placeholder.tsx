import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui'

/**
 * V2Placeholder — v2 도메인(주문/배송/배송 설정) placeholder 공용.
 * 본 컴포넌트는 PR1 (foundation) 의 임시 본문이며, PR8/9/10 이 실제 화면으로 교체한다.
 */
export function V2Placeholder({ message }: { message: string }): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Construction className="h-10 w-10 text-text-tertiary" aria-hidden />
        <p className="text-sm text-text-secondary">{message}</p>
      </CardContent>
    </Card>
  )
}
