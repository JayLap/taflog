import type { StopEvent } from "../domain/events.ts"
import type { Entry } from "../domain/entry.ts"
import { newId } from "../domain/identity.ts"
import { deriveTimer } from "../domain/reduce.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"
import { NothingRunningError } from "./errors.ts"

export interface StopInput {
  description?: string
}

export interface StopResult {
  skipped: number
  event: StopEvent
  entry: Entry
}

/** `stop [description]`: close the running Timer (SPEC §8.1, §10). */
export class StopTask {
  private readonly clock: Clock
  private readonly log: EventLog
  private readonly generateId: () => string

  constructor(clock: Clock, log: EventLog, generateId: () => string = newId) {
    this.clock = clock
    this.log = log
    this.generateId = generateId
  }

  async execute(input: StopInput): Promise<StopResult> {
    const { events, skipped } = await this.log.readAll()
    const running = deriveTimer(events)
    if (running === null) {
      throw new NothingRunningError()
    }

    const description =
      input.description === undefined || input.description === "" ? undefined : input.description
    const at = this.clock.now()
    const event: StopEvent = {
      v: 1,
      id: this.generateId(),
      t: "stop",
      at: at.toISOString(),
      entry: running.id,
    }
    if (description !== undefined) {
      event.description = description
    }

    await this.log.append(event)
    const entry: Entry = {
      id: running.id,
      project: running.project,
      description: description ?? running.description,
      start: running.start,
      end: at,
    }
    return { skipped, event, entry }
  }
}
