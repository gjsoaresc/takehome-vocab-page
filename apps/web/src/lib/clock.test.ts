import { describe, expect, it } from 'vitest'
import { timeOfDay } from './clock'

/** Local wall-clock hour, which is what timeOfDay reads. */
const at = (hour: number, minute = 0) => new Date(2026, 0, 15, hour, minute)

describe('timeOfDay', () => {
  it('reads the small hours and the morning as morning', () => {
    expect(timeOfDay(at(0))).toBe('morning')
    expect(timeOfDay(at(7, 10))).toBe('morning')
  })

  it('turns over to afternoon at noon, not before', () => {
    expect(timeOfDay(at(11, 59))).toBe('morning')
    expect(timeOfDay(at(12))).toBe('afternoon')
  })

  it('turns over to night at six, not before', () => {
    expect(timeOfDay(at(17, 59))).toBe('afternoon')
    expect(timeOfDay(at(18))).toBe('night')
  })

  it('stays night to the end of the day', () => {
    expect(timeOfDay(at(21, 45))).toBe('night')
    expect(timeOfDay(at(23, 59))).toBe('night')
  })
})
