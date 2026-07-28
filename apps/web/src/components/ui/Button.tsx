import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'flame'

/** h48 / radius 14 / tap scale .97 at 90ms - design variant 1c. */
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold ' +
  'transition-[transform,background-color,border-color] duration-[90ms] ease-standard ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'h-12 bg-accent text-on-accent text-[15px] active:bg-accent-strong',
  secondary:
    'h-12 border-[1.5px] border-accent bg-transparent text-accent-strong text-[15px] active:bg-accent-soft',
  ghost: 'h-11 bg-transparent text-muted text-sm hover:bg-ink/5',
  // Word Rush owns the one loud button in the app.
  flame: 'h-14 rounded-[18px] bg-flame text-on-flame text-[17px] active:brightness-95',
}

/** For anchors and <Link>s that need to look like a button. */
export const buttonClass = (variant: ButtonVariant = 'primary', extra = '') =>
  `${BASE} ${VARIANTS[variant]} ${extra}`.trim()

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  full?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  full = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={buttonClass(variant, `${full ? 'w-full' : 'px-5'} ${className}`)}
    >
      {children}
    </button>
  )
}
