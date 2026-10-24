/**
 * Local-calendar helpers (SPEC §6, §8.5). Instants are UTC, but the day
 * boundary is local midnight and display is rendered in the machine's
 * timezone.
 */

/** First day of a Report week (SPEC §7). Defaults to `monday` (ISO). */
export type WeekStart = "monday" | "sunday"

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

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

/**
 * Parse a canonical `YYYY-MM-DD` (SPEC §8.5) into local midnight, or `null`
 * when impossible (e.g. `2025-02-30`).
 */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(2000, month - 1, day)
  date.setFullYear(year)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/**
 * Resolve a `--date` value (SPEC §8.5) to a local `YYYY-MM-DD`, or `null` when
 * malformed. Accepts `YYYY-MM-DD`, `today`, `yesterday`, and weekday names
 * (`mon`…`sun`) within the current week.
 */
export function parseDate(input: string, now: Date, weekStart: WeekStart = "monday"): string | null {
  const text = input.trim().toLowerCase()
  if (text === "today") return formatLocalDate(now)
  if (text === "yesterday") {
    const day = startOfLocalDay(now)
    day.setDate(day.getDate() - 1)
    return formatLocalDate(day)
  }
  const weekday = WEEKDAY_INDEX[text]
  if (weekday !== undefined) return formatLocalDate(weekdayInWeek(now, weekday, weekStart))
  const absolute = parseLocalDate(text)
  return absolute === null ? null : formatLocalDate(absolute)
}

/** Local date of `weekday` (JS `getDay()`) within the week containing `now`. */
function weekdayInWeek(now: Date, weekday: number, weekStart: WeekStart): Date {
  const day = startOfLocalDay(now)
  const offsetFromStart =
    weekStart === "monday" ? (now.getDay() + 6) % 7 : now.getDay()
  const position =
    weekStart === "monday" ? (weekday + 6) % 7 : weekday
  day.setDate(day.getDate() - offsetFromStart + position)
  return day
}
