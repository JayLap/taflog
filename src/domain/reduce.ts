import type { Event } from "./events.ts"
import type { Adjustment, Entry, Timer } from "./entry.ts"

/**
 * Replay the Log into derived views (SPEC §4.2). Events are applied in file
 * order; the result is deterministic and never mutates the input. This is the
 * single replay: every derived view, including the removable sequence bare `rm`
 * walks, is projected from the state it returns.
 */
export interface LogState {
  entries: Entry[]
  timer: Timer | null
  adjustments: Adjustment[]
  /**
   * Live Entries and Adjustments in Log order, for bare `rm` (SPEC §8.1, §10).
   * An Entry is listed when it closes; the open Timer is never listed, because
   * it is not a completed Entry.
   */
  removableIds: string[]
}

interface OpenEntry {
  id: string
  project: string
  description: string
  start: Date
}

export function reduceEvents(events: Event[]): LogState {
  const closed: Entry[] = []
  const adjustments: Adjustment[] = []
  const removableIds: string[] = []
  const open = new Map<string, OpenEntry>()
  const deleted = new Set<string>()

  function close(id: string, at: Date, description: string | undefined): void {
    const entry = open.get(id)
    if (entry === undefined) return
    open.delete(id)
    removableIds.push(id)
    closed.push({
      id: entry.id,
      project: entry.project,
      description: description ?? entry.description,
      start: entry.start,
      end: at,
    })
  }

  for (const event of events) {
    switch (event.t) {
      case "start":
        open.set(event.id, {
          id: event.id,
          project: event.project,
          description: event.description ?? "",
          start: new Date(event.at),
        })
        break
      case "switch":
        close(event.from, new Date(event.at), undefined)
        open.set(event.id, {
          id: event.id,
          project: event.project,
          description: event.description ?? "",
          start: new Date(event.at),
        })
        break
      case "stop":
        close(event.entry, new Date(event.at), event.description)
        break
      case "adjust":
        adjustments.push({
          id: event.id,
          project: event.project,
          date: event.date,
          delta: event.delta,
          ...(event.note === undefined ? {} : { note: event.note }),
        })
        removableIds.push(event.id)
        break
      case "delete":
        deleted.add(event.entry)
        open.delete(event.entry)
        break
    }
  }

  return {
    entries: closed.filter((entry) => !deleted.has(entry.id)),
    timer: lastOpen(open),
    adjustments: adjustments.filter((adjustment) => !deleted.has(adjustment.id)),
    removableIds: removableIds.filter((id) => !deleted.has(id)),
  }
}

export function deriveTimer(events: Event[]): Timer | null {
  return reduceEvents(events).timer
}

/**
 * The Timer is the most recent unclosed Entry. Valid logs hold at most one;
 * when a log has an orphan, the latest open Entry wins (SPEC §10).
 */
function lastOpen(open: Map<string, OpenEntry>): Timer | null {
  let timer: Timer | null = null
  for (const entry of open.values()) {
    timer = {
      id: entry.id,
      project: entry.project,
      description: entry.description,
      start: entry.start,
    }
  }
  return timer
}
