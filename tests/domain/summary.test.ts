import { test } from "node:test"
import assert from "node:assert/strict"
import { summarizeLocalDay, summarizeRange } from "../../src/domain/summary.ts"
import { formatLocalDate } from "../../src/domain/datetime.ts"
import type { Adjustment, Entry } from "../../src/domain/entry.ts"

test("a negative Adjustment drives the day total negative, never clamped", () => {
  const now = new Date(2025, 9, 23, 12, 0)
  const adjustment: Adjustment = {
    id: "aaaaaaa1",
    project: "acme",
    date: formatLocalDate(now),
    delta: -1800,
  }
  const totals = summarizeLocalDay([], null, [adjustment], now)
  assert.equal(totals.timedSeconds, 0)
  assert.equal(totals.adjustedSeconds, -1800)
  assert.equal(totals.totalSeconds, -1800)
})

function entry(start: Date, end: Date): Entry {
  return { id: "aaaaaaa1", project: "acme", description: "", start, end }
}

function adjustment(date: string, delta: number): Adjustment {
  return { id: "bbbbbbb2", project: "acme", date, delta }
}

test("summarizeRange reconciles timed + adjusted = total", () => {
  const from = new Date(2025, 9, 20)
  const to = new Date(2025, 9, 27)
  const totals = summarizeRange(
    [entry(new Date(2025, 9, 23, 9, 0), new Date(2025, 9, 23, 10, 0))],
    [adjustment("2025-10-23", 3000), adjustment("2025-10-24", -600)],
    from,
    to,
  )
  assert.equal(totals.timedSeconds, 3600)
  assert.equal(totals.adjustedSeconds, 2400)
  assert.equal(totals.totalSeconds, 6000)
  assert.equal(totals.timedSeconds + totals.adjustedSeconds, totals.totalSeconds)
})

test("summarizeRange excludes times outside the range", () => {
  const from = new Date(2025, 9, 20)
  const to = new Date(2025, 9, 27)
  const totals = summarizeRange(
    [
      entry(new Date(2025, 9, 19, 9, 0), new Date(2025, 9, 19, 10, 0)),
      entry(new Date(2025, 9, 23, 9, 0), new Date(2025, 9, 23, 10, 0)),
    ],
    [adjustment("2025-10-19", 600), adjustment("2025-10-27", 600)],
    from,
    to,
  )
  assert.equal(totals.timedSeconds, 3600)
  assert.equal(totals.adjustedSeconds, 0)
})

test("summarizeRange allows a negative total", () => {
  const totals = summarizeRange([], [adjustment("2025-10-23", -1800)], new Date(2025, 9, 20), new Date(2025, 9, 27))
  assert.equal(totals.totalSeconds, -1800)
})
