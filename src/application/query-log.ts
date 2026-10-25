import type { Entry } from "../domain/entry.ts"
import { overlapSeconds, type WeekStart } from "../domain/datetime.ts"
import { reduceEvents } from "../domain/reduce.ts"
import type { PeriodTotals } from "../domain/summary.ts"
import { summarizeRange } from "../domain/summary.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"
import { UsageError } from "./errors.ts"
import type { DateRange, RangeInput } from "./range.ts"
import { resolveRange } from "./range.ts"

/** One rendered row: a completed Entry or a dated Adjustment. */
export type LogItem =
  | {
      kind: "timed"
      id: string
      project: string
      description: string
      start: Date
      end: Date
      durationSeconds: number
    }
  | {
      kind: "adjust"
      id: string
      project: string
      date: string
      deltaSeconds: number
      note?: string
    }

export interface LogQueryInput extends RangeInput {
  project?: string
  limit?: number
  /** Config-derived first day of the week; defaults to Monday (SPEC §7). */
  weekStart?: WeekStart
}

export interface QueryLogResult {
  skipped: number
  range: DateRange
  /** Echo of the project filter for `--json` (SPEC §9.5). */
  project: string | null
  query: { from: string; to: string; project: string | null }
  items: LogItem[]
  totals: PeriodTotals
}

/**
 * `log [filters]`: list Entries and Adjustments in a window (SPEC §8.3, §9.2).
 * Completed Entries come first in chronological order, then Adjustments; the
 * totals are the same reconciliation `report` uses.
 */
export class QueryLog {
  private readonly clock: Clock
  private readonly log: EventLog

  constructor(clock: Clock, log: EventLog) {
    this.clock = clock
    this.log = log
  }

  async execute(input: LogQueryInput = {}): Promise<QueryLogResult> {
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
      throw new UsageError("--limit must be a positive integer")
    }

    const { events, skipped } = await this.log.readAll()
    const now = this.clock.now()
    const range = resolveRange(input, now, input.weekStart ?? "monday", "today")
    const state = reduceEvents(events)
    const project = normalizeProject(input.project)

    const entries = state.entries.filter(
      (entry) =>
        entry.end.getTime() > range.from.getTime() &&
        entry.start.getTime() < range.to.getTime() &&
        matchesProject(entry.project, project),
    )
    const adjustments = state.adjustments.filter(
      (adjustment) =>
        adjustment.date >= range.fromDate &&
        adjustment.date <= range.toDate &&
        matchesProject(adjustment.project, project),
    )

    const timed: LogItem[] = entries
      .slice()
      .sort((left, right) => left.start.getTime() - right.start.getTime())
      .map((entry) => timedItem(entry, range))
    const adjust: LogItem[] = adjustments
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((adjustment) => ({
        kind: "adjust",
        id: adjustment.id,
        project: adjustment.project,
        date: adjustment.date,
        deltaSeconds: adjustment.delta,
        ...(adjustment.note === undefined ? {} : { note: adjustment.note }),
      }))

    let items = [...timed, ...adjust]
    if (input.limit !== undefined) items = items.slice(-input.limit)

    const echoedProject = project === null ? null : (input.project ?? null)
    return {
      skipped,
      range,
      project: echoedProject,
      query: { from: range.fromDate, to: range.toDate, project: echoedProject },
      items,
      totals: summarizeRange(entries, adjustments, range.from, range.to),
    }
  }
}

function timedItem(entry: Entry, range: DateRange): LogItem {
  return {
    kind: "timed",
    id: entry.id,
    project: entry.project,
    description: entry.description,
    start: entry.start,
    end: entry.end,
    durationSeconds: Math.floor(overlapSeconds(entry.start, entry.end, range.from, range.to)),
  }
}

function normalizeProject(project: string | undefined): string | null {
  if (project === undefined) return null
  const text = project.trim()
  return text === "" ? null : text
}

function matchesProject(project: string, filter: string | null): boolean {
  return filter === null || project.toLowerCase() === filter.toLowerCase()
}
