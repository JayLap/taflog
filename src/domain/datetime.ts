/**
 * Local-calendar helpers (SPEC §6). Instants are UTC, but the day boundary is
 * local midnight and display is rendered in the machine's timezone.
 */

/** Local midnight at the start of `date`'s calendar day. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Local midnight at the start of the next calendar day. */
export function startOfNextLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
}

/** Local calendar date as `YYYY-MM-DD`. */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local wall-clock time as `HH:MM`. */
export function formatLocalTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Whole seconds of `[start, end)` that fall inside `[from, to)`, never negative. */
export function overlapSeconds(start: Date, end: Date, from: Date, to: Date): number {
  const begin = Math.max(start.getTime(), from.getTime())
  const finish = Math.min(end.getTime(), to.getTime())
  if (finish <= begin) return 0
  return (finish - begin) / 1000
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}
