import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 클래스 결합 유틸 — shadcn 표준.
 * - clsx: 조건부 클래스
 * - twMerge: Tailwind 충돌 클래스 마지막 것만 유지 (예: `px-2 px-4` → `px-4`)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
