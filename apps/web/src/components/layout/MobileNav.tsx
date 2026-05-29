import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Button, Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui'
import { Sidebar } from './Sidebar'

/**
 * MobileNav — 모바일(<md) 햄버거 → 좌측 드로어로 Sidebar 노출.
 * Sheet (Radix Dialog) 기반. Esc / overlay 클릭 / 항목 클릭 시 자동 close.
 *
 * 접근성: SheetTitle 은 시각적으로 sr-only 처리 (헤더에 동일 정보 노출되므로) 하되
 * Radix Dialog 가 Title 노드를 요구하므로 반드시 렌더.
 */
export function MobileNav(): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* WCAG 2.5.5 + PRD §5.2: 모바일 터치 타겟 ≥44×44px — 기본 icon size 36 을 44 로 확장 */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="메뉴 열기"
          aria-expanded={open}
          className="h-11 w-11"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">주요 메뉴</SheetTitle>
        <Sidebar onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
