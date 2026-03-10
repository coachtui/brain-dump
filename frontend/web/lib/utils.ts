/**
 * Utility: merge Tailwind class names.
 * Lightweight implementation — no clsx/tailwind-merge dependency required.
 * For full shadcn compatibility, replace with: clsx + tailwind-merge.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
