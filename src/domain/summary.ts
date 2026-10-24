import type { Adjustment, Entry, Timer } from "./entry.ts"
import {
  formatLocalDate,
  overlapSeconds,
  startOfLocalDay,
  startOfNextLocalDay,
} from "./datetime.ts"

/** Timed + Adjusted totals for a period (SPEC §9.5). Seconds are whole. */
export interface PeriodTotals {
  timedSeconds: number
  adjustedSeconds: number
  totalSeconds: number
}

/**
 * Today's totals in local time. Entries are clipped to the local day; the
 * running Timer counts up to `now`; Adjustments count when their date is today.
 */
export function summarizeLocalDay(
  entries: Entry[],
  timer: Timer | null,
  adjustments: Adjustment[],
  now: Date,
): PeriodTotals {
  const from = startOfLocalDay(now)
  const to = startOfNextLocalDay(now)

  let timed = 0
  for (const entry of entries) {
    timed += overlapSeconds(entry.start, entry.end, from, to)
  }
  if (timer !== null) {
    timed += overlapSeconds(timer.start, now, from, to)
  }

  const today = formatLocalDate(now)
  let adjusted = 0
  for (const adjustment of adjustments) {
    if (adjustment.date === today) adjusted += adjustment.delta
  }

  const timedSeconds = Math.floor(timed)
  const adjustedSeconds = Math.floor(adjusted)
  return { timedSeconds, adjustedSeconds, totalSeconds: timedSeconds + adjustedSeconds }
}
