import { reduceEvents } from "../domain/reduce.ts"
import type { EventLog } from "../ports/event-log.ts"

export type CandidateKind = "project" | "description"

export interface LogCandidatesInput {
  kind: CandidateKind
  /** Restrict Description candidates to this Project (case-insensitive). */
  project?: string
}

export interface LogCandidatesResult {
  candidates: string[]
}

/**
 * Read-only candidates for interactive completion: Projects come from live
 * Entries, the Timer, and Adjustments; Descriptions come from live Entries and
 * the Timer. Ordering is most-recent-first, and deduplication is
 * case-insensitive (SPEC §8.6). Serves `start`, `switch`, `add`, and `sub`.
 */
export class LogCandidates {
  private readonly log: EventLog

  constructor(log: EventLog) {
    this.log = log
  }

  async execute(input: LogCandidatesInput): Promise<LogCandidatesResult> {
    const { events } = await this.log.readAll()
    const state = reduceEvents(events)
    const entries = state.entries
      .slice()
      .sort((left, right) => right.start.getTime() - left.start.getTime())

    const liveProjects = new Set(
      [
        ...(state.timer === null ? [] : [state.timer.project]),
        ...entries.map((entry) => entry.project),
        ...state.adjustments.map((adjustment) => adjustment.project),
      ].map((project) => project.toLowerCase()),
    )
    const projects = unique(
      events
        .slice()
        .reverse()
        .flatMap((event) => {
          if (event.t !== "start" && event.t !== "switch" && event.t !== "adjust") return []
          return liveProjects.has(event.project.toLowerCase()) ? [event.project] : []
        }),
    )

    if (input.kind === "project") return { candidates: projects }

    const project = input.project?.trim().toLowerCase() ?? ""
    const descriptions = unique(
      [...(state.timer === null ? [] : [state.timer]), ...entries]
        .filter((entry) => project === "" || entry.project.toLowerCase() === project)
        .map((entry) => entry.description),
    )
    return { candidates: descriptions }
  }
}

/** Preserve first spelling/order while removing blank and case-duplicate values. */
function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const candidates: string[] = []
  for (const value of values) {
    const candidate = value.trim()
    const key = candidate.toLowerCase()
    if (key === "" || seen.has(key)) continue
    seen.add(key)
    candidates.push(candidate)
  }
  return candidates
}
