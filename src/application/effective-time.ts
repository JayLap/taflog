import { formatLocalTime, parseTimeOfDay } from "../domain/datetime.ts"
import { UsageError } from "./errors.ts"

/**
 * Resolve an optional explicit wall-clock time for `stop`/`switch`
 * (SPEC §6, §8.5). The time always falls on today's local date; absent input
 * means the clock instant. Rejects future times.
 */
export function resolveEffectiveInstant(
  command: "stop" | "switch",
  time: string | undefined,
  now: Date,
): Date {
  if (time === undefined) return now
  const at = parseTimeOfDay(time, now)
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
