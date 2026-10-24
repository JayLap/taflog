import { reduceEvents } from "../domain/reduce.ts"
import type { Report } from "../domain/report.ts"
import { buildReport } from "../domain/report.ts"
import type { WeekStart } from "../domain/datetime.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"
import type { DateRange, RangeInput } from "./range.ts"
import { resolveRange } from "./range.ts"

export interface BuildReportInput extends RangeInput {
  project?: string
  /** Config override arrives in Phase 5; defaults to Monday. */
  weekStart?: WeekStart
}

export interface BuildReportResult {
  skipped: number
  range: DateRange
  report: Report
}

/**
 * `report [filters]`: aggregate Timed and Adjusted time over a window
 * (SPEC §8.3, §9.3). The default window is this week.
 */
export class BuildReport {
  private readonly clock: Clock
  private readonly log: EventLog

  constructor(clock: Clock, log: EventLog) {
    this.clock = clock
    this.log = log
  }

  async execute(input: BuildReportInput = {}): Promise<BuildReportResult> {
    const { events, skipped } = await this.log.readAll()
    const now = this.clock.now()
    const weekStart = input.weekStart ?? "monday"
    const range = resolveRange(input, now, weekStart, "week")
    const state = reduceEvents(events)
    const project = normalizeProject(input.project)

    const entries =
      project === null
        ? state.entries
        : state.entries.filter((entry) => entry.project.toLowerCase() === project.toLowerCase())
    const adjustments =
      project === null
        ? state.adjustments
        : state.adjustments.filter(
            (adjustment) => adjustment.project.toLowerCase() === project.toLowerCase(),
          )

    return {
      skipped,
      range,
      report: buildReport(entries, adjustments, range.from, range.to, weekStart),
    }
  }
}

function normalizeProject(project: string | undefined): string | null {
  if (project === undefined) return null
  const text = project.trim()
  return text === "" ? null : text
}
