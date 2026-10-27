import {
  formatLocalTime,
  parseDate,
  parseLocalDate,
  parseTimeOfDay,
} from "../domain/datetime.ts"
import { UsageError } from "./errors.ts"

/**
 * Resolve an optional explicit wall-clock time for `stop`/`switch`
 * (SPEC §6, §8.5). The time defaults to today's local date; `--date` selects
 * another local date. Absent time means the clock instant. Rejects future
 * instants and `--date` without a time.
 */
export function resolveEffectiveInstant(
  command: "stop" | "switch",
  time: string | undefined,
  date: string | undefined,
  now: Date,
): Date {
  if (time === undefined) {
    if (date !== undefined) {
      throw new UsageError(`--date requires a time on ${command}`)
    }
    return now
  }

  let baseDate = now
  if (date !== undefined) {
    const localDate = parseDate(date, now)
    const parsed = localDate === null ? null : parseLocalDate(localDate)
    if (parsed === null) throw new UsageError(`invalid date: ${date}`)
    baseDate = parsed
  }

  const at = parseTimeOfDay(time, baseDate)
  if (at === null) throw new UsageError(`invalid time: ${time}`)
  if (at.getTime() > now.getTime()) {
    throw new UsageError(`${command} time ${formatLocalTime(at)} is in the future`)
  }
  return at
}

/** Reject an explicit time that would close a Timer before it opened (SPEC §10). */
export function assertAfterTimerStart(
  command: "stop" | "switch",
  at: Date,
  start: Date,
): void {
  if (at.getTime() < start.getTime()) {
    throw new UsageError(
      `${command} time ${formatLocalTime(at)} is before the timer started at ${formatLocalTime(start)}`,
    )
  }
}
