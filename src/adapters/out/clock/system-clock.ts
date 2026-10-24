import type { Clock } from "../../../ports/clock.ts"

/** Production Clock: the system wall clock. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}
