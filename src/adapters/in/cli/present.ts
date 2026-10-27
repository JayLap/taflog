import type { StartResult } from "../../../application/start-task.ts"
import type { StatusResult } from "../../../application/status.ts"
import type { StopResult } from "../../../application/stop-task.ts"
import type { SwitchResult } from "../../../application/switch-task.ts"
import type { AdjustmentResult } from "../../../application/adjustment.ts"
import type { RemoveResult } from "../../../application/remove-entry.ts"
import { formatLocalTime } from "../../../domain/datetime.ts"
import { createStyle, sanitizeForTerminal, type Style } from "./style.ts"

/** Terminal presenter for `status` (SPEC §9.1). Always ends with a newline. */
export function renderStatus(result: StatusResult, style: Style = createStyle()): string {
  if (result.timer !== null) {
    const elapsed = elapsedSeconds(result.timer.start, result.now)
    const project = style.project(sanitizeForTerminal(result.timer.project))
    const description =
      result.timer.description === ""
        ? ""
        : ` — ${style.meta(sanitizeForTerminal(result.timer.description))}`
    const header = `${style.running(style.glyphs.running)} ${project}${description}`
    const summary = style.meta(
      `  running ${style.duration(elapsed)} (since ${formatLocalTime(result.timer.start)}) ${style.glyphs.project} today ${style.duration(result.today.totalSeconds)}`,
    )
    return `${style.truncate(header, style.width)}\n${style.truncate(summary, style.width)}\n`
  }

  if (result.lastEntry !== null) {
    const duration = elapsedSeconds(result.lastEntry.start, result.lastEntry.end)
    return `${style.truncate(
      style.meta(
        `${style.glyphs.idle} idle ${style.glyphs.project} last ${style.project(sanitizeForTerminal(result.lastEntry.project))} ${style.duration(duration)} (ended ${formatLocalTime(result.lastEntry.end)}) ${style.glyphs.project} today ${style.duration(result.today.totalSeconds)}`,
      ),
      style.width,
    )}\n`
  }

  return `${style.truncate(
    style.meta(
      `${style.glyphs.idle} idle ${style.glyphs.project} today ${style.duration(result.today.totalSeconds)}`,
    ),
    style.width,
  )}\n`
}

/** JSON presenter for `status`; frozen `version: 1`, durations in seconds (SPEC §9.5). */
export function statusJson(result: StatusResult): string {
  const running =
    result.timer === null
      ? null
      : {
          id: result.timer.id,
          project: result.timer.project,
          description: result.timer.description,
          start: result.timer.start.toISOString(),
          elapsedSeconds: elapsedSeconds(result.timer.start, result.now),
        }
  return `${JSON.stringify({ version: 1, now: result.now.toISOString(), running, today: result.today })}\n`
}

/** Confirmation for `start`. */
export function renderStarted(result: StartResult, style: Style = createStyle()): string {
  return `${style.glyphs.running} ${style.project(sanitizeForTerminal(result.timer.project))} — running since ${formatLocalTime(result.timer.start)}\n`
}

/** Confirmation for `stop`. */
export function renderStopped(result: StopResult, style: Style = createStyle()): string {
  const duration = elapsedSeconds(result.entry.start, result.entry.end)
  return `${style.glyphs.idle} stopped ${style.project(sanitizeForTerminal(result.entry.project))} ${style.glyphs.project} ${style.duration(duration)}\n`
}

/** Confirmation for `switch` (SPEC §10). */
export function renderSwitched(result: SwitchResult, style: Style = createStyle()): string {
  const started = `${style.glyphs.running} ${style.project(sanitizeForTerminal(result.timer.project))} — running since ${formatLocalTime(result.timer.start)}`
  if (result.closed === null) {
    return `${started}\n`
  }
  const duration = elapsedSeconds(result.closed.start, result.closed.end)
  return `${style.glyphs.idle} ${style.project(sanitizeForTerminal(result.closed.project))} ${style.duration(duration)} → ${started}\n`
}

function elapsedSeconds(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
}

/** Confirmation for `add`/`sub` (SPEC §8.1): a signed Adjustment line. */
export function renderAdjusted(result: AdjustmentResult, style: Style = createStyle()): string {
  const adjustment = result.adjustment
  const note = adjustment.note === undefined ? "" : ` — ${sanitizeForTerminal(adjustment.note)}`
  return `${style.signed(adjustment.delta)} ${style.project(sanitizeForTerminal(adjustment.project))} ${style.glyphs.project} ${adjustment.date}${note}\n`
}

/** Confirmation for `rm` (SPEC §8.1): the tombstoned Entry or Adjustment. */
export function renderRemoved(result: RemoveResult, style: Style = createStyle()): string {
  if (result.removed.kind === "entry") {
    const removed = result.removed.entry
    const duration = elapsedSeconds(removed.start, removed.end)
    return `${style.glyphs.idle} removed ${style.project(sanitizeForTerminal(removed.project))} ${style.duration(duration)}\n`
  }
  const removed = result.removed.adjustment
  return `${style.glyphs.idle} removed adjustment ${style.signed(removed.delta)} ${style.project(sanitizeForTerminal(removed.project))}\n`
}
