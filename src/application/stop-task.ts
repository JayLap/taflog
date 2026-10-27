import type { StopEvent } from "../domain/events.ts"
import type { Entry } from "../domain/entry.ts"
import { newId } from "../domain/identity.ts"
import { deriveTimer } from "../domain/reduce.ts"
import { DEFAULT_MAX_TIMER_HOURS, isForgotten } from "../domain/timer.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"
import { assertAfterTimerStart, resolveEffectiveInstant } from "./effective-time.ts"
import { ForgottenTimerError, NothingRunningError } from "./errors.ts"

export interface StopInput {
  description?: string
  /** Optional local wall-clock time, e.g. `15h44` (SPEC §6, §8.5). */
  time?: string
  force?: boolean
}

export interface StopResult {
  skipped: number
  event: StopEvent
  entry: Entry
}

/** `stop [<time>] [description]`: close the running Timer (SPEC §8.1, §10). */
export class StopTask {
  private readonly clock: Clock
  private readonly log: EventLog
  private readonly generateId: () => string
  private readonly maxTimerHours: number

  constructor(
    clock: Clock,
    log: EventLog,
    generateId: () => string = newId,
    maxTimerHours: number = DEFAULT_MAX_TIMER_HOURS,
  ) {
    this.clock = clock
    this.log = log
    this.generateId = generateId
    this.maxTimerHours = maxTimerHours
  }

  async execute(input: StopInput): Promise<StopResult> {
    const { events, skipped } = await this.log.readAll()
    const running = deriveTimer(events)
    if (running === null) {
      throw new NothingRunningError()
    }

    const now = this.clock.now()
    const at = resolveEffectiveInstant("stop", input.time, now)
    assertAfterTimerStart("stop", at, running.start)
    if (input.force !== true && isForgotten(running, at, this.maxTimerHours)) {
      throw new ForgottenTimerError(running.project, running.start, this.maxTimerHours)
    }

    const description =
      input.description === undefined || input.description === "" ? undefined : input.description
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
