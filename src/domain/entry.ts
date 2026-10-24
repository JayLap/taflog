/**
 * Derived views (SPEC §4.2–4.3). Instants are `Date` objects; formatting to ISO
 * or local time happens at the edges.
 */

/** A completed interval of work. */
export interface Entry {
  id: string
  project: string
  description: string
  start: Date
  end: Date
}

/** The single open Entry, if any. */
export interface Timer {
  id: string
  project: string
  description: string
  start: Date
}

/** A dated, signed duration correction; never carries an interval. */
export interface Adjustment {
  id: string
  project: string
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string
  /** Signed seconds; positive = add, negative = sub. */
  delta: number
  note?: string
}
