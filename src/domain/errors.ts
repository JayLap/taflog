/**
 * Shared error base for the whole application.
 *
 * Lives in `domain/` so that every layer (adapters, application, CLI) can import
 * it without crossing the dependency rule. `exitCode` is the process exit code
 * the CLI should use: 1 for runtime errors, 2 for usage errors (SPEC §8.4).
 */
export class TaflogError extends Error {
  readonly exitCode: number

  constructor(message: string, exitCode = 1) {
    super(message)
    this.name = "TaflogError"
    this.exitCode = exitCode
  }
}

/** Raised by the EventLog when a strict read meets unreadable lines (SPEC §5). */
export class CorruptLogError extends TaflogError {
  readonly skipped: number

  constructor(skipped: number) {
    super(`skipped ${skipped} unreadable line${skipped === 1 ? "" : "s"} (--strict)`, 1)
    this.name = "CorruptLogError"
    this.skipped = skipped
  }
}
