'use client'

/**
 * HeroIllustration
 *
 * Thin wrapper around OffloadBackgroundPaths that keeps the existing
 * import path (`@/components/HeroIllustration`) stable across the app.
 *
 * The canonical implementation lives in:
 *   components/ui/background-paths.tsx
 */

import { OffloadBackgroundPaths } from '@/components/ui/background-paths'
import type { OffloadBackgroundPathsProps } from '@/components/ui/background-paths'

export type { OffloadBackgroundPathsProps as HeroIllustrationProps }

export default function HeroIllustration(props: OffloadBackgroundPathsProps) {
  return <OffloadBackgroundPaths {...props} />
}
