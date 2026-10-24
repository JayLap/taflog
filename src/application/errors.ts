import { formatLocalTime } from "../domain/datetime.ts"
import { TaflogError } from "../domain/errors.ts"

/** Invalid input or flags; the CLI exits 2 (SPEC §8.4). */
export class UsageError extends TaflogError {
  constructor(message: string) {
    super(message, 2)
    this.name = "UsageError"
  }
}

/** `start` while a Timer is already running (SPEC §10). */
export class AlreadyRunningError extends TaflogError {
  constructor(project: string, since: Date) {
    super(`already tracking "${project}" since ${formatLocalTime(since)} — use switch or stop`)
    this.name = "AlreadyRunningError"
  }
}

/** `stop` while idle (SPEC §10). */
export class NothingRunningError extends TaflogError {
  constructor() {
    super("nothing is running")
    this.name = "NothingRunningError"
  }
}
