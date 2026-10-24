import type { Event } from "../domain/events.ts"

/** Result of a tolerant read: parsed Events plus a count of skipped lines. */
export interface ReadResult {
  events: Event[]
  skipped: number
}

/**
 * Append-only Log port (SPEC §3, ADR-0001). `append` writes exactly one line;
 * `readAll` replays the whole file and reports unreadable lines.
 */
export interface EventLog {
  append(event: Event): Promise<void>
  readAll(): Promise<ReadResult>
}
