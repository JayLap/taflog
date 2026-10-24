import { appendFile, mkdir, readFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { Event } from "../../../domain/events.ts"
import { isEvent } from "../../../domain/events.ts"
import { CorruptLogError } from "../../../domain/errors.ts"
import type { EventLog, ReadResult } from "../../../ports/event-log.ts"

export interface JsonlEventLogOptions {
  /** Fail the read instead of skipping unreadable lines (SPEC §5). */
  strict?: boolean
}

/**
 * The NDJSON EventLog (ADR-0001). A write is exactly one `appendFile` of one
 * line. A read parses the whole file, skips blank/unreadable lines, and counts
 * them; strict mode throws instead.
 */
export class JsonlEventLog implements EventLog {
  private readonly file: string
  private readonly strict: boolean

  constructor(file: string, options: JsonlEventLogOptions = {}) {
    this.file = file
    this.strict = options.strict ?? false
  }

  async append(event: Event): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    // Owner-only where the platform allows it (SPEC §5).
    await appendFile(this.file, `${JSON.stringify(event)}\n`, { mode: 0o600 })
  }

  async readRaw(): Promise<string> {
    try {
      return await readFile(this.file, "utf8")
    } catch (error) {
      if (isNotFound(error)) return ""
      throw error
    }
  }

  async readAll(): Promise<ReadResult> {
    const content = await this.readRaw()
    const events: Event[] = []
    let skipped = 0
    for (const line of content.split("\n")) {
      if (line.trim() === "") continue
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        skipped += 1
        continue
      }
      if (isEvent(parsed)) {
        events.push(parsed)
      } else {
        skipped += 1
      }
    }

    if (this.strict && skipped > 0) {
      throw new CorruptLogError(skipped)
    }
    return { events, skipped }
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "ENOENT"
  )
}
