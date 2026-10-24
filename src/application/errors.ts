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

/**
 * `stop`/`switch` on an open Entry older than `maxTimerHours` (SPEC §6, §10).
 * Re-running with `--force` closes it anyway.
 */
export class ForgottenTimerError extends TaflogError {
  constructor(project: string, since: Date, maxTimerHours: number) {
    super(
      `"${project}" has been running since ${formatLocalTime(since)}, over the ${maxTimerHours}h limit — use --force to close it`,
    )
    this.name = "ForgottenTimerError"
  }
}

/** `rm` targeting the open Timer (SPEC §10): a running interval is never destroyed. */
export class RunningEntryError extends TaflogError {
  constructor() {
    super("that entry is running — stop it first")
    this.name = "RunningEntryError"
  }
}

/** Bare `rm` with no live Entry or Adjustment to tombstone (SPEC §8.1). */
export class NothingToRemoveError extends TaflogError {
  constructor() {
    super("nothing to remove")
    this.name = "NothingToRemoveError"
  }
}

/** `rm <id>` where no Entry or Adjustment matches the id or prefix (SPEC §4.4). */
export class UnknownEntryError extends TaflogError {
  constructor(id: string) {
    super(`no entry or adjustment matches "${id}"`)
    this.name = "UnknownEntryError"
  }
}
