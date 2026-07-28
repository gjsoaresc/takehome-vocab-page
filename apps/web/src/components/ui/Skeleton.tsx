import type { CSSProperties } from 'react'

/**
 * One shimmering block. Skeletons mirror the real block geometry rather than
 * spinning, so the page does not change shape when the data lands.
 * Reduced motion drops the loop to a static tint via the global override.
 */
export function Skeleton({
  className = '',
  width,
  height,
  rounded = 6,
}: {
  className?: string
  width?: number | string
  height?: number | string
  rounded?: number | string
}) {
  const style: CSSProperties = { width, height, borderRadius: rounded }
  return <div aria-hidden className={`skeleton animate-shimmer ${className}`} style={style} />
}

/** A line of text. */
export const SkeletonLine = ({ w = '100%', h = 12 }: { w?: string | number; h?: number }) => (
  <Skeleton width={w} height={h} />
)
