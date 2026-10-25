import type { DateRange } from "../../../application/range.ts"
import {
  addLocalDays,
  formatLocalDate,
  formatShortMonth,
  formatShortWeekday,
  isoWeekNumber,
} from "../../../domain/datetime.ts"
import type { Style } from "./style.ts"

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

/**
 * The one-line window header shared by `log` and `report` (SPEC §9.1–9.3).
 * `totalSeconds` is appended when the command has a grand total.
 */
export function rangeTitle(
  range: DateRange,
  style: Style,
  totalSeconds?: number,
): string {
  let title: string
  if (range.preset === "today") {
    title = `Today ${style.glyphs.date} ${formatShortWeekday(range.from)} ${range.fromDate}`
  } else if (range.preset === "week") {
    title = weekTitle(range, style)
  } else if (range.preset === "month") {
    title = monthTitle(range, style)
  } else {
    title = customTitle(range, style)
  }
  if (totalSeconds !== undefined) {
    title += ` ${style.glyphs.date} ${style.duration(totalSeconds)}`
  }
  return title
}

function weekTitle(range: DateRange, style: Style): string {
  const end = addLocalDays(range.to, -1)
  const startText = `${formatShortWeekday(range.from)} ${range.from.getDate()}`
  const endText = `${formatShortWeekday(end)} ${end.getDate()} ${formatShortMonth(end)} ${end.getFullYear()}`
  return `Week ${isoWeekNumber(range.from)} ${style.glyphs.date} ${startText} → ${endText}`
}

function monthTitle(range: DateRange, style: Style): string {
  const end = addLocalDays(range.to, -1)
  const name = LONG_MONTHS[range.from.getMonth()] ?? formatShortMonth(range.from)
  const startText = `${formatShortWeekday(range.from)} ${range.from.getDate()}`
  const endText = `${formatShortWeekday(end)} ${end.getDate()} ${formatShortMonth(end)} ${end.getFullYear()}`
  return `${name} ${range.from.getFullYear()} ${style.glyphs.date} ${startText} → ${endText}`
}

function customTitle(range: DateRange, style: Style): string {
  const end = addLocalDays(range.to, -1)
  if (formatLocalDate(range.from) === formatLocalDate(end)) {
    return `${formatShortWeekday(range.from)} ${range.fromDate}`
  }
  return `${formatShortWeekday(range.from)} ${range.from.getDate()} ${formatShortMonth(range.from)} ${range.from.getFullYear()} → ${formatShortWeekday(end)} ${end.getDate()} ${formatShortMonth(end)} ${end.getFullYear()}`
}
