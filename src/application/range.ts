import {
  addLocalDays,
  formatLocalDate,
  parseDate,
  parseLocalDate,
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalWeek,
  startOfNextLocalDay,
  startOfNextLocalMonth,
  startOfNextLocalWeek,
  type WeekStart,
} from "../domain/datetime.ts"
import { UsageError } from "./errors.ts"

/** How a window was chosen; drives the terminal header (SPEC §9.2–9.3). */
export type RangePreset = "today" | "week" | "month" | "custom"

/** A half-open local window plus its inclusive calendar-date labels. */
export interface DateRange {
  /** Local midnight, inclusive. */
  from: Date
  /** Local midnight, exclusive. */
  to: Date
  /** Inclusive `YYYY-MM-DD`. */
  fromDate: string
  /** Inclusive `YYYY-MM-DD`. */
  toDate: string
  preset: RangePreset
}

export interface RangeInput {
  today?: boolean
  week?: boolean
  month?: boolean
  from?: string
  to?: string
}

/**
 * Resolve the read-command filters to one local window (SPEC §8.3, §8.5).
 * Presets are mutually exclusive; `--from`/`--to` form a custom range and a
 * lone bound means a single day. `fallback` is the command's default.
 */
export function resolveRange(
  input: RangeInput,
  now: Date,
  weekStart: WeekStart = "monday",
  fallback: "today" | "week" = "today",
): DateRange {
  const presets = [input.today === true, input.week === true, input.month === true].filter(
    Boolean,
  ).length
  const custom = input.from !== undefined || input.to !== undefined
  if (presets > 1) throw new UsageError("choose only one of --today, --week, --month")
  if (presets === 1 && custom) {
    throw new UsageError("--from/--to cannot be combined with --today, --week, or --month")
  }

  if (input.today === true) {
    return singleDay(startOfLocalDay(now), "today")
  }
  if (input.week === true) {
    return presetRange(
      startOfLocalWeek(now, weekStart),
      startOfNextLocalWeek(now, weekStart),
      "week",
    )
  }
  if (input.month === true) {
    return presetRange(startOfLocalMonth(now), startOfNextLocalMonth(now), "month")
  }
  if (custom) {
    return customRange(input, now, weekStart)
  }
  return fallback === "week"
    ? presetRange(
        startOfLocalWeek(now, weekStart),
        startOfNextLocalWeek(now, weekStart),
        "week",
      )
    : singleDay(startOfLocalDay(now), "today")
}

function customRange(input: RangeInput, now: Date, weekStart: WeekStart): DateRange {
  // A lone bound means a single day, so it supplies both ends.
  const fromInput = input.from ?? input.to ?? ""
  const toInput = input.to ?? input.from ?? ""
  const fromDate = parseDate(fromInput, now, weekStart)
  const toDate = parseDate(toInput, now, weekStart)
  if (fromDate === null) throw new UsageError(`invalid date: ${fromInput}`)
  if (toDate === null) throw new UsageError(`invalid date: ${toInput}`)

  const from = parseLocalDate(fromDate)
  const toDay = parseLocalDate(toDate)
  if (from === null) throw new UsageError(`invalid date: ${fromDate}`)
  if (toDay === null) throw new UsageError(`invalid date: ${toDate}`)
  if (from.getTime() > toDay.getTime()) {
    throw new UsageError("--from must not be after --to")
  }

  return {
    from,
    to: startOfNextLocalDay(toDay),
    fromDate,
    toDate,
    preset: "custom",
  }
}

function singleDay(day: Date, preset: RangePreset): DateRange {
  return {
    from: day,
    to: startOfNextLocalDay(day),
    fromDate: formatLocalDate(day),
    toDate: formatLocalDate(day),
    preset,
  }
}

function presetRange(from: Date, to: Date, preset: RangePreset): DateRange {
  return {
    from,
    to,
    fromDate: formatLocalDate(from),
    toDate: formatLocalDate(addLocalDays(to, -1)),
    preset,
  }
}
