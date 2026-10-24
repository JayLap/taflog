import type { Entry, Timer } from "../domain/entry.ts"
import { reduceEvents } from "../domain/reduce.ts"
import type { PeriodTotals } from "../domain/summary.ts"
import { summarizeLocalDay } from "../domain/summary.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"

export interface StatusResult {
  skipped: number
  now: Date
  timer: Timer | null
  lastEntry: Entry | null
  today: PeriodTotals
}

/** `status`: the current Timer plus today's totals (SPEC §9.1). */
export class ShowStatus {
  private readonly clock: Clock
  private readonly log: EventLog

  constructor(clock: Clock, log: EventLog) {
    this.clock = clock
    this.log = log
  }

  async execute(): Promise<StatusResult> {
    const { events, skipped } = await this.log.readAll()
    const now = this.clock.now()
    const state = reduceEvents(events)
    const lastEntry = state.entries.at(-1) ?? null
    const today = summarizeLocalDay(state.entries, state.timer, state.adjustments, now)
    return { skipped, now, timer: state.timer, lastEntry, today }
  }
}
