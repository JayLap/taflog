import type { DeleteEvent } from "../domain/events.ts"
import type { Adjustment, Entry } from "../domain/entry.ts"
import { newId, resolvePrefix } from "../domain/identity.ts"
import type { LogState } from "../domain/reduce.ts"
import { reduceEvents } from "../domain/reduce.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"
import {
  NothingToRemoveError,
  RunningEntryError,
  UnknownEntryError,
  UsageError,
} from "./errors.ts"

export interface RemoveInput {
  /** Full id or unambiguous prefix; omitted removes the most recent item. */
  id?: string
}

export type RemovedItem =
  | { kind: "entry"; entry: Entry }
  | { kind: "adjustment"; adjustment: Adjustment }

export interface RemoveResult {
  skipped: number
  event: DeleteEvent
  removed: RemovedItem
}

/**
 * `rm [<id>]`: tombstone an Entry or Adjustment (SPEC §8.1, §10, ADR-0004).
 * Without an id it removes the most recent live Entry/Adjustment; the open
 * Timer is never removable.
 */
export class RemoveEntry {
  private readonly clock: Clock
  private readonly log: EventLog
  private readonly generateId: () => string

  constructor(clock: Clock, log: EventLog, generateId: () => string = newId) {
    this.clock = clock
    this.log = log
    this.generateId = generateId
  }

  async execute(input: RemoveInput = {}): Promise<RemoveResult> {
    const { events, skipped } = await this.log.readAll()
    const state = reduceEvents(events)
    const targetId = this.resolveTarget(input.id, state)

    if (state.timer !== null && state.timer.id === targetId) {
      throw new RunningEntryError()
    }

    const at = this.clock.now()
    const event: DeleteEvent = {
      v: 1,
      id: this.generateId(),
      t: "delete",
      at: at.toISOString(),
      entry: targetId,
    }
    await this.log.append(event)

    const entry = state.entries.find((item) => item.id === targetId)
    if (entry !== undefined) return { skipped, event, removed: { kind: "entry", entry } }

    const adjustment = state.adjustments.find((item) => item.id === targetId)
    if (adjustment !== undefined) {
      return { skipped, event, removed: { kind: "adjustment", adjustment } }
    }
    throw new NothingToRemoveError()
  }

  private resolveTarget(input: string | undefined, state: LogState): string {
    if (input === undefined || input.trim() === "") {
      const last = state.removableIds.at(-1)
      if (last === undefined) throw new NothingToRemoveError()
      return last
    }

    const ids = [
      ...state.entries.map((entry) => entry.id),
      ...state.adjustments.map((adjustment) => adjustment.id),
      ...(state.timer === null ? [] : [state.timer.id]),
    ]
    const resolution = resolvePrefix(input, ids)
    if (resolution.status === "none") throw new UnknownEntryError(input)
    if (resolution.status === "ambiguous") {
      throw new UsageError(`ambiguous id prefix "${input.trim()}": ${resolution.matches.join(", ")}`)
    }
    return resolution.id
  }
}