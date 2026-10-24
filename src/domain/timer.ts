import type { Timer } from "./entry.ts"

/** Forgotten-Timer threshold in hours when no config overrides it (SPEC §6). */
export const DEFAULT_MAX_TIMER_HOURS = 8

/**
 * True when an open Entry has run longer than `maxTimerHours`. The comparison
 * is strict, so a Timer exactly at the threshold is not yet forgotten (SPEC §6).
 */
export function isForgotten(timer: Timer, now: Date, maxTimerHours: number): boolean {
  return (now.getTime() - timer.start.getTime()) / 3_600_000 > maxTimerHours
}
