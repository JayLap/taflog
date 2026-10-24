import type { Event } from "../../src/domain/events.ts"
import type { Clock } from "../../src/ports/clock.ts"
import type { EventLog, ReadResult } from "../../src/ports/event-log.ts"

/** Deterministic Clock for tests. Defaults to a fixed instant. */
export class FakeClock implements Clock {
  private current: Date

  constructor(now: Date | string = "2025-10-23T09:12:00") {
    this.current = new Date(now)
  }

  now(): Date {
    return new Date(this.current)
  }

  set(now: Date | string): void {
    this.current = new Date(now)
  }

  advance(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000)
  }
}

/** In-memory EventLog for testing use cases without the filesystem. */
export class InMemoryEventLog implements EventLog {
  events: Event[]
  skipped: number

  constructor(seed: Event[] = [], skipped = 0) {
    this.events = [...seed]
    this.skipped = skipped
  }

  async append(event: Event): Promise<void> {
    this.events.push(event)
  }

  async readAll(): Promise<ReadResult> {
    return { events: [...this.events], skipped: this.skipped }
  }
}
