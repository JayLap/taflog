import type { StartResult } from "../../../application/start-task.ts"
import type { StatusResult } from "../../../application/status.ts"
import type { StopResult } from "../../../application/stop-task.ts"
import type { SwitchResult } from "../../../application/switch-task.ts"
import { formatLocalTime } from "../../../domain/datetime.ts"
import { formatDuration } from "../../../domain/duration.ts"

/** Terminal presenter for `status` (SPEC §9.1). Always ends with a newline. */
export function renderStatus(result: StatusResult): string {
  if (result.timer !== null) {
    const elapsed = elapsedSeconds(result.timer.start, result.now)
    const header =
      result.timer.description === ""
        ? `● ${result.timer.project}`
        : `● ${result.timer.project} — ${result.timer.description}`
    const summary = `  running ${formatDuration(elapsed)} (since ${formatLocalTime(result.timer.start)}) · today ${formatDuration(result.today.totalSeconds)}`
    return `${header}\n${summary}\n`
  }

  if (result.lastEntry !== null) {
    const duration = elapsedSeconds(result.lastEntry.start, result.lastEntry.end)
    return `○ idle · last ${result.lastEntry.project} ${formatDuration(duration)} (ended ${formatLocalTime(result.lastEntry.end)}) · today ${formatDuration(result.today.totalSeconds)}\n`
  }

  return `○ idle · today ${formatDuration(result.today.totalSeconds)}\n`
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
export function renderStarted(result: StartResult): string {
  return `● ${result.timer.project} — running since ${formatLocalTime(result.timer.start)}\n`
}

/** Confirmation for `stop`. */
export function renderStopped(result: StopResult): string {
  const duration = elapsedSeconds(result.entry.start, result.entry.end)
  return `○ stopped ${result.entry.project} · ${formatDuration(duration)}\n`
}

/** Confirmation for `switch` (SPEC §10). */
export function renderSwitched(result: SwitchResult): string {
  const started = `● ${result.timer.project} — running since ${formatLocalTime(result.timer.start)}`
  if (result.closed === null) {
    return `${started}\n`
  }
  const duration = elapsedSeconds(result.closed.start, result.closed.end)
  return `○ ${result.closed.project} ${formatDuration(duration)} → ${started}\n`
}

function elapsedSeconds(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
}
