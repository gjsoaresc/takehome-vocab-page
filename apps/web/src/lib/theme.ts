import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'vocab.theme'

/**
 * Theme resolution order: an explicit choice, then the system, then light.
 *
 * The same three lines run as an inline script in index.html so the class is on
 * <html> before first paint - reloading in dark must not flash light. Keep the
 * two copies in step.
 */
export function resolveTheme(): Theme {
  const stored = localStorage.getItem(KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  const choose = useCallback((next: Theme) => {
    localStorage.setItem(KEY, next)
    apply(next)
    setTheme(next)
  }, [])

  // Follow the OS only while the learner has not made an explicit choice.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (localStorage.getItem(KEY)) return
      const next: Theme = mq.matches ? 'dark' : 'light'
      apply(next)
      setTheme(next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return [theme, choose]
}
