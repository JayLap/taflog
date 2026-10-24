import type { EventLog } from "../ports/event-log.ts"

/**
 * `export`: the raw Log, byte-for-byte (SPEC §9.6). It never parses, so
 * unreadable lines are preserved rather than reported.
 */
export class ExportLog {
  private readonly log: EventLog

  constructor(log: EventLog) {
    this.log = log
  }

  async execute(): Promise<string> {
    return this.log.readRaw()
  }
}
