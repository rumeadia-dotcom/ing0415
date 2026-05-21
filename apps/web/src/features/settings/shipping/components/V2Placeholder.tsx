import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui'

/**
 * V2Placeholder (settings/shipping 도메인 사본).
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
