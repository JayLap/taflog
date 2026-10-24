import type { StartEvent } from "../domain/events.ts"
import type { Timer } from "../domain/entry.ts"
import { newId } from "../domain/identity.ts"
import { deriveTimer } from "../domain/reduce.ts"
import type { Clock } from "../ports/clock.ts"
import type { EventLog } from "../ports/event-log.ts"
import { AlreadyRunningError, UsageError } from "./errors.ts"

export interface StartInput {
  project: string
  description?: string
}

export interface StartResult {
  skipped: number
  event: StartEvent
  timer: Timer
}

/** `start <project> [description]`: open a Timer (SPEC §8.1). */
export class StartTask {
  private readonly clock: Clock
  private readonly log: EventLog
  private readonly generateId: () => string

  constructor(clock: Clock, log: EventLog, generateId: () => string = newId) {
    this.clock = clock
    this.log = log
    this.generateId = generateId
  }

  async execute(input: StartInput): Promise<StartResult> {
    const { events, skipped } = await this.log.readAll()
    const project = input.project.trim()
    if (project === "") {
      throw new UsageError("start requires a <project>")
    }

    const running = deriveTimer(events)
    if (running !== null) {
      throw new AlreadyRunningError(running.project, running.start)
    }

    const at = this.clock.now()
    const event: StartEvent = {
      v: 1,
      id: this.generateId(),
      t: "start",
      at: at.toISOString(),
      project,
    }
    if (input.description !== undefined && input.description !== "") {
      event.description = input.description
    }

    await this.log.append(event)
    const timer: Timer = {
      id: event.id,
      project,
      description: event.description ?? "",
      start: at,
    }
    return { skipped, event, timer }
  }
}
