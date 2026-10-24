import type { AdjustEvent } from "../domain/events.ts"
import type { Adjustment } from "../domain/entry.ts"
import { formatLocalDate, parseDate } from "../domain/datetime.ts"
import { parseDuration } from "../domain/duration.ts"
import { newId } from "../domain/identity.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"
import { UsageError } from "./errors.ts"

export interface AdjustmentInput {
  project: string
  duration: string
  date?: string
  note?: string
}

export interface AdjustmentResult {
  skipped: number
  event: AdjustEvent
  adjustment: Adjustment
}

/**
 * `add`/`sub <project> <duration> [--date D] [--note N]`: a dated signed
 * correction against a Project (SPEC §8.1, ADR-0004). The two commands share
 * this task; the sign is the only difference. Adjustments are independent of
 * the running Timer and never fabricate an interval.
 */
class AdjustmentTask {
  protected readonly command: string
  protected readonly sign: number
  private readonly clock: Clock
  private readonly log: EventLog
  private readonly generateId: () => string

  constructor(
    command: string,
    sign: number,
    clock: Clock,
    log: EventLog,
    generateId: () => string = newId,
  ) {
    this.command = command
    this.sign = sign
    this.clock = clock
    this.log = log
    this.generateId = generateId
  }

  async execute(input: AdjustmentInput): Promise<AdjustmentResult> {
    const { skipped } = await this.log.readAll()
    const project = input.project.trim()
    if (project === "") {
      throw new UsageError(`${this.command} requires a <project>`)
    }

    const seconds = parseDuration(input.duration)
    if (seconds === null) {
      throw new UsageError(`invalid duration: ${input.duration}`)
    }

    const now = this.clock.now()
    const date =
      input.date === undefined || input.date.trim() === ""
        ? formatLocalDate(now)
        : parseDate(input.date, now)
    if (date === null) {
      throw new UsageError(`invalid date: ${input.date}`)
    }

    const note = input.note === undefined || input.note === "" ? undefined : input.note
    const event: AdjustEvent = {
      v: 1,
      id: this.generateId(),
      t: "adjust",
      at: now.toISOString(),
      date,
      project,
      delta: this.sign * seconds,
    }
    if (note !== undefined) event.note = note

    await this.log.append(event)
    const adjustment: Adjustment = {
      id: event.id,
      project,
      date,
      delta: event.delta,
      ...(note === undefined ? {} : { note }),
    }
    return { skipped, event, adjustment }
  }
}

/** `add <project> <duration>`: a positive Adjustment. */
export class AddAdjustment extends AdjustmentTask {
  constructor(clock: Clock, log: EventLog, generateId: () => string = newId) {
    super("add", 1, clock, log, generateId)
  }
}

/** `sub <project> <duration>`: a negative Adjustment. */
export class SubAdjustment extends AdjustmentTask {
  constructor(clock: Clock, log: EventLog, generateId: () => string = newId) {
    super("sub", -1, clock, log, generateId)
  }
}