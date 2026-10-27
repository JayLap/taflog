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

const TIME_OF_DAY_HINT = /^\d{1,2}[:h]/i
const TIME_OF_DAY = /^(\d{1,2})(?::(\d{1,2})|h(\d{0,2}))$/i

/** True when `input` is a plausible time-of-day attempt (SPEC §8.5). */
export function looksLikeTimeOfDay(input: string): boolean {
  return TIME_OF_DAY_HINT.test(input.trim())
}

/**
 * Parse a wall-clock time (`9:00`, `09:00`, `15h44`, `15h`) into an instant on
 * `baseDate`'s local calendar day. Returns `null` for malformed or impossible
 * times. Minutes default to zero.
 */
export function parseTimeOfDay(input: string, baseDate: Date): Date | null {
  const match = TIME_OF_DAY.exec(input.trim())
  if (match === null) return null
  const hours = Number(match[1])
  const minutes =
    match[2] !== undefined
      ? Number(match[2])
      : match[3] === undefined || match[3] === ""
        ? 0
        : Number(match[3])
  if (hours > 23 || minutes > 59) return null
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes,
    0,
    0,
  )
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

/** Local midnight on the first day of `date`'s week (SPEC §6, §7). */
export function startOfLocalWeek(date: Date, weekStart: WeekStart = "monday"): Date {
  const day = startOfLocalDay(date)
  const offset = weekStart === "monday" ? (day.getDay() + 6) % 7 : day.getDay()
  day.setDate(day.getDate() - offset)
  return day
}

/** Local midnight seven calendar days after the start of `date`'s week. */
export function startOfNextLocalWeek(date: Date, weekStart: WeekStart = "monday"): Date {
  const day = startOfLocalWeek(date, weekStart)
  day.setDate(day.getDate() + 7)
  return day
}

/** Local midnight on the first day of `date`'s month. */
export function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Local midnight on the first day of the month after `date`. */
export function startOfNextLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

/** A new local date shifted by `days` calendar days. */
export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Every local midnight in `[from, to)`. */
export function enumerateLocalDays(from: Date, to: Date): Date[] {
  const days: Date[] = []
  let cursor = startOfLocalDay(from)
  const limit = to.getTime()
  while (cursor.getTime() < limit) {
    days.push(cursor)
    cursor = addLocalDays(cursor, 1)
  }
  return days
}

/** True for local Saturday or Sunday. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

export function formatShortWeekday(date: Date): string {
  return WEEKDAY_NAMES[date.getDay()] ?? ""
}

export function formatShortMonth(date: Date): string {
  return MONTH_NAMES[date.getMonth()] ?? ""
}

/** ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeekNumber(date: Date): number {
  const thursday = startOfLocalDay(date)
  const weekday = (thursday.getDay() + 6) % 7
  thursday.setDate(thursday.getDate() - weekday + 3)

  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  const firstWeekday = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstWeekday + 3)

  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
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
