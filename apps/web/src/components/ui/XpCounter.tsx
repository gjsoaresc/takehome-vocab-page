import { CountUp, group } from './CountUp'

/** XP counter pill - design variant 1c. Delta is the green "+N" beside it. */
export function XpCounter({
  xp,
  delta,
  count = false,
}: {
  xp: number
  delta?: number
  /** Roll the value up rather than printing it (session-end screens). */
  count?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-[7px] rounded-full border border-xp/20 bg-xp-soft px-3 py-[7px]">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-xp text-[10px] leading-none font-extrabold text-on-xp">
        XP
      </span>
      {count ? (
        <CountUp to={xp} className="text-base leading-none font-bold text-xp" />
      ) : (
        <span className="tabular text-base leading-none font-bold text-xp">{group(xp)}</span>
      )}
      {delta ? (
        <span className="text-[11px] leading-none font-semibold text-ok">+{group(delta)}</span>
      ) : null}
    </span>
  )
}
