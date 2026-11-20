import { reduceEvents } from "../domain/reduce.ts"
import type { Report } from "../domain/report.ts"
import { buildReport } from "../domain/report.ts"
import { formatLocalDate, type WeekStart } from "../domain/datetime.ts"
import { normalizeReport, selectProject, type DayTargets } from "../domain/normalize.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"
import type { DateRange, RangeInput } from "./range.ts"
import { resolveRange } from "./range.ts"

export interface BuildReportInput extends RangeInput {
  project?: string
  /** Config-derived first day of the week; defaults to Monday (SPEC §7). */
  weekStart?: WeekStart
  /**
   * `--normalize`: rescale each completed day to its target (SPEC §9.3). The
   * targets and step come from configuration.
   */
  normalize?: { dayTargets: DayTargets; step: number }
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

    if (input.normalize !== undefined) {
      // A day target covers every Project, so scale the whole day first and
      // only then narrow to the requested Project.
      const full = buildReport(state.entries, state.adjustments, range.from, range.to, weekStart)
      const normalized = normalizeReport(full, {
        ...input.normalize,
        today: formatLocalDate(now),
      })
      return {
        skipped,
        range,
        report: project === null ? normalized : selectProject(normalized, project),
      }
    }

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
