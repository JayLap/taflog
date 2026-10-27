import type { StartEvent, SwitchEvent } from "../domain/events.ts"
import type { Entry, Timer } from "../domain/entry.ts"
import { newId } from "../domain/identity.ts"
import { deriveTimer } from "../domain/reduce.ts"
import { DEFAULT_MAX_TIMER_HOURS, isForgotten } from "../domain/timer.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"
import { assertAfterTimerStart, resolveEffectiveInstant } from "./effective-time.ts"
import { ForgottenTimerError, UsageError } from "./errors.ts"

export interface SwitchInput {
  project: string
  description?: string
  /** Optional local wall-clock time, e.g. `15h44` (SPEC §6, §8.5). */
  time?: string
  force?: boolean
}

/**
 * Result of `switch`. The Event is a `switch` when a Timer was running and a
 * `start` when idle, so the handoff (or fresh start) is always one append.
 */
export interface SwitchResult {
  skipped: number
  event: SwitchEvent | StartEvent
  closed: Entry | null
  timer: Timer
}

/** `switch <project> [<time>] [description]`: close the Timer and open the next (SPEC §10). */
export class SwitchTask {
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

  async execute(input: SwitchInput): Promise<SwitchResult> {
    const { events, skipped } = await this.log.readAll()
    const project = input.project.trim()
    if (project === "") {
      throw new UsageError("switch requires a <project>")
    }

    const description = clean(input.description)
    const running = deriveTimer(events)
    const now = this.clock.now()

    if (running === null) {
      if (input.time !== undefined) {
        throw new UsageError("switch cannot take a time while no Timer is running — use start")
      }
      const event: StartEvent = {
        v: 1,
        id: this.generateId(),
        t: "start",
        at: now.toISOString(),
        project,
      }
      if (description !== undefined) event.description = description
      await this.log.append(event)
      const timer: Timer = {
        id: event.id,
        project,
        description: description ?? "",
        start: now,
      }
      return { skipped, event, closed: null, timer }
    }

    const at = resolveEffectiveInstant("switch", input.time, now)
    assertAfterTimerStart("switch", at, running.start)
    if (input.force !== true && isForgotten(running, at, this.maxTimerHours)) {
      throw new ForgottenTimerError(running.project, running.start, this.maxTimerHours)
    }

    const event: SwitchEvent = {
      v: 1,
      id: this.generateId(),
      t: "switch",
      at: at.toISOString(),
      from: running.id,
      project,
    }
    if (description !== undefined) event.description = description
    await this.log.append(event)
    const closed: Entry = {
      id: running.id,
      project: running.project,
      description: running.description,
      start: running.start,
      end: at,
    }
    const timer: Timer = {
      id: event.id,
      project,
      description: description ?? "",
      start: at,
    }
    return { skipped, event, closed, timer }
  }
}

function clean(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value
}
