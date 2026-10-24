/**
 * The Event union — one JSON object per line in the Log (SPEC §4.1, ADR-0001).
 * These types are the on-disk schema; every derived view is replayed from them.
 */

interface EventBase {
  /** Schema version, integer, always `1` in v1. */
  v: 1
  /** Event identity (SPEC §4.4). */
  id: string
  /** ISO-8601 UTC instant of the event. */
  at: string
}

export interface StartEvent extends EventBase {
  t: "start"
  project: string
  description?: string
}

export interface StopEvent extends EventBase {
  t: "stop"
  entry: string
  description?: string
}

export interface SwitchEvent extends EventBase {
  t: "switch"
  from: string
  project: string
  description?: string
}

export interface AdjustEvent extends EventBase {
  t: "adjust"
  date: string
  project: string
  delta: number
  note?: string
}

export interface DeleteEvent extends EventBase {
  t: "delete"
  entry: string
}

export type Event =
  | StartEvent
  | StopEvent
  | SwitchEvent
  | AdjustEvent
  | DeleteEvent

export const EVENT_KINDS = ["start", "stop", "switch", "adjust", "delete"] as const

/**
 * Structural guard used by the tolerant reader. A line that parses as JSON but
 * does not look like an Event is treated as unreadable (SPEC §5).
 */
export function isEvent(value: unknown): value is Event {
  if (typeof value !== "object" || value === null) return false
  const event = value as Record<string, unknown>
  if (event.v !== 1 || typeof event.id !== "string" || typeof event.at !== "string") {
    return false
  }
  switch (event.t) {
    case "start":
      return typeof event.project === "string" && isOptionalString(event.description)
    case "stop":
      return typeof event.entry === "string" && isOptionalString(event.description)
    case "switch":
      return (
        typeof event.from === "string" &&
        typeof event.project === "string" &&
        isOptionalString(event.description)
      )
    case "adjust":
      return (
        typeof event.date === "string" &&
        typeof event.project === "string" &&
        typeof event.delta === "number" &&
        isOptionalString(event.note)
      )
    case "delete":
      return typeof event.entry === "string"
    default:
      return false
  }
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string"
}
