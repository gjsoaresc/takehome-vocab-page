import { Link } from 'react-router-dom'
import { CARD } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Icon, type IconName } from '../ui/Icon'
import { Pill } from '../ui/Chip'

export type ModeTone = 'accent' | 'xp' | 'gold' | 'flame'

const TONE_TEXT: Record<ModeTone, string> = {
  accent: 'text-accent',
  xp: 'text-xp',
  gold: 'text-gold',
  flame: 'text-flame',
}

const TONE_TILE: Record<ModeTone, string> = {
  accent: 'bg-accent-soft text-accent',
  xp: 'bg-xp-soft text-xp',
  gold: 'bg-gold-soft text-gold',
  flame: 'bg-flame-soft text-flame',
}

export interface Mode {
  to: string
  name: string
  sub: string
  icon: IconName
  tone: ModeTone
  /** The live number that gives a reason to tap. */
  stat: string
  /** Only on the suggested card: accuracy chip plus a sentence. */
  detail?: { chip: string; chipTone: 'ok' | 'warn' | 'accent'; note: string }
  /** Zero state: what has to happen before this mode is worth opening. */
  gate?: string
}

/** The one card the app is nudging towards, inside a gradient edge. */
export function SuggestedModeCard({ mode }: { mode: Mode }) {
  return (
    <div className="celebrate rounded-xl p-[1.5px]">
      <Link
        to={mode.to}
        className="block rounded-[20.5px] bg-card p-4 transition-transform duration-[90ms] ease-standard active:scale-[0.985]"
      >
        <div className="flex items-center gap-3">
          <span
            className={`grid h-[46px] w-[46px] flex-none place-items-center rounded-[14px] ${TONE_TILE[mode.tone]}`}
          >
            <Icon name={mode.icon} size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-[7px]">
              <span className="text-[17px] leading-[22px] font-bold text-ink">{mode.name}</span>
              <Pill tone="suggested">Do this next</Pill>
            </span>
            <span className="block text-[13px] leading-[18px] text-muted">{mode.sub}</span>
          </span>
          <Icon name="chevronRight" size={20} strokeWidth={2.2} className="flex-none text-ink" />
        </div>
        {mode.detail ? (
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <Chip tone={mode.detail.chipTone} className="tabular !h-[26px] !px-2.5 !text-xs">
              {mode.detail.chip}
            </Chip>
            <span className="text-[12.5px] leading-[1.3] text-muted">{mode.detail.note}</span>
          </div>
        ) : null}
      </Link>
    </div>
  )
}

export function ModeCard({ mode }: { mode: Mode }) {
  const locked = Boolean(mode.gate)
  return (
    <Link
      to={mode.to}
      className={`${CARD} flex items-center gap-3 rounded-[20px] p-3.5 transition-transform duration-[90ms] ease-standard active:scale-[0.985] ${
        locked ? 'opacity-60' : ''
      }`}
    >
      <span
        className={`grid h-11 w-11 flex-none place-items-center rounded-[14px] ${
          locked ? 'bg-line text-muted' : TONE_TILE[mode.tone]
        }`}
      >
        <Icon name={mode.icon} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] leading-5 font-bold text-ink">{mode.name}</span>
        <span className="block text-[12.5px] leading-[17px] text-muted">{mode.sub}</span>
        {mode.gate ? null : (
          <span
            className={`tabular mt-0.5 block text-[12.5px] leading-[17px] font-semibold ${TONE_TEXT[mode.tone]}`}
          >
            {mode.stat}
          </span>
        )}
      </span>
      {mode.gate ? (
        <span className="flex-none text-[11.5px] font-semibold text-muted">{mode.gate}</span>
      ) : (
        <Icon name="chevronRight" size={18} strokeWidth={2.2} className="flex-none text-muted" />
      )}
    </Link>
  )
}
