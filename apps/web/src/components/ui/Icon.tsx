import type { ReactNode } from 'react'

/**
 * Every glyph the design uses, lifted from the mockups' inline SVG. One file,
 * no icon font, no dependency - the brief forbids both.
 *
 * Stroke icons inherit `currentColor`; the handful that are solid shapes pass
 * `filled`. Anything decorative gets aria-hidden by default.
 */
const ICONS = {
  // Bottom nav
  home: <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" />,
  words: <path d="M6 4h12v16l-6-3.5L6 20z" />,
  stats: <path d="M4 19V11M10 19V5M16 19v-6M22 19H2" />,

  // Modes
  learn: (
    <path d="M4 5.5A2.5 2.5 0 016.5 3H11v16H6.5A2.5 2.5 0 004 21.5zM20 5.5A2.5 2.5 0 0017.5 3H13v16h4.5a2.5 2.5 0 012.5 2.5z" />
  ),
  quiz: <path d="M9 9a3 3 0 114 2.8c-.6.3-1 .9-1 1.6v.6M12 17.5h.01" />,
  match: <path d="M4 7h6v6H4zM14 11h6v6h-6zM10 10l4 4" />,
  rush: <path d="M12 5v8l4.5 2.6M12 21a8 8 0 100-16 8 8 0 000 16z" />,

  // Feedback
  check: <path d="M20 6.5L9.5 17 4 11.5" />,
  cross: <path d="M7 7l10 10M17 7L7 17" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  alert: (
    <>
      <path d="M12 7v6M12 17h.01" />
      <circle cx="12" cy="12" r="9.5" />
    </>
  ),
  info: (
    <>
      <path d="M12 8v5M12 16.5h.01" />
      <circle cx="12" cy="12" r="9.5" />
    </>
  ),

  // Reward
  flame: (
    <path d="M12 2c2.6 3.4 1.1 5.2 2.9 7.2 1.7 1.9 3.1 3 3.1 5.3a6 6 0 11-12 0c0-2.6 1.7-3.9 2.9-5.9.6 1.2 1.2 1.6 1.7 1.2C11.3 8.4 10.6 5.3 12 2z" />
  ),
  star: <path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8z" />,
  trophy: <path d="M6 4h12v4a6 6 0 01-12 0zM9 20h6M12 14v6" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      <path d="M8 10.5V7a4 4 0 018 0v3.5" />
    </>
  ),
  target: (
    <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 13.2v-.01" />
  ),
  spark: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5L15 9M9 15l-2.5 2.5" />
  ),
  grid: <path d="M5 5h4v4H5zM15 5h4v4h-4zM5 15h4v4H5zM15 15h4v4h-4z" />,
  bars: <path d="M6 20V10M12 20V4M18 20v-7M3 20h18" />,
  book: (
    <path d="M4 5.5A2.5 2.5 0 016.5 3H11v16H6.5A2.5 2.5 0 004 21.5zM20 5.5A2.5 2.5 0 0017.5 3H13v16h4.5a2.5 2.5 0 012.5 2.5z" />
  ),
  circleCheck: <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM8 12l3 3 5-6" />,

  // Direction / movement
  chevronRight: <path d="M9 5l7 7-7 7" />,
  arrowRight: <path d="M10 6l8 6-8 6" />,
  arrowLeft: <path d="M14 6l-8 6 8 6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  swap: <path d="M4 7h9l-3-3M20 17h-9l3 3" />,
  wordToDef: <path d="M4 6h10M4 12h16M4 18h7" />,
  defToWord: <path d="M20 6H10M20 12H4M20 18h-7" />,

  // Status
  timer: (
    <>
      <circle cx="12" cy="13" r="8.5" />
      <path d="M12 9.5V13l2.5 1.6M9.5 2h5" />
    </>
  ),
  search: <path d="M16 16l4.5 4.5M11 17.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z" />,
  offline: <path d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 13a10 10 0 0114 0" />,
  sync: (
    <path d="M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M17 3.5V7h-3.5M7 20.5V17h3.5" />
  ),
  spinner: (
    <>
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M12 3a9 9 0 019 9" />
    </>
  ),

  // Theme toggle. Not in the mockups - the design assumed the OS picks.
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2M12 19.5v2M4.4 4.4l1.4 1.4M18.2 18.2l1.4 1.4M2.5 12h2M19.5 12h2M4.4 19.6l1.4-1.4M18.2 5.8l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICONS

interface IconProps {
  name: IconName
  size?: number
  /** Solid shape rather than a stroked outline (chips, filled flames). */
  filled?: boolean
  strokeWidth?: number
  className?: string
  /** Give the glyph a name when it is the only content of a control. */
  title?: string
}

export function Icon({
  name,
  size = 20,
  filled = false,
  strokeWidth = 2,
  className,
  title,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? undefined : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {ICONS[name]}
    </svg>
  )
}
