import { test } from "node:test"
import assert from "node:assert/strict"
import {
  formatLocalDate,
  formatLocalTime,
  overlapSeconds,
  parseDate,
  parseLocalDate,
  startOfLocalDay,
  startOfNextLocalDay,
} from "../../src/domain/datetime.ts"

test("startOfLocalDay is local midnight of the same calendar date", () => {
  const at = new Date(2025, 9, 23, 13, 5, 30)
  const start = startOfLocalDay(at)
  assert.equal(start.getHours(), 0)
  assert.equal(start.getMinutes(), 0)
  assert.equal(start.getSeconds(), 0)
  assert.equal(formatLocalDate(start), "2025-10-23")
})

test("startOfNextLocalDay advances exactly one calendar day", () => {
  const next = startOfNextLocalDay(new Date(2025, 9, 31, 23, 59))
  assert.equal(formatLocalDate(next), "2025-11-01")
})

test("formatLocalDate and formatLocalTime zero-pad", () => {
  assert.equal(formatLocalDate(new Date(2025, 0, 5)), "2025-01-05")
  assert.equal(formatLocalTime(new Date(2025, 9, 23, 9, 5)), "09:05")
  assert.equal(formatLocalTime(new Date(2025, 9, 23, 13, 42)), "13:42")
})

test("overlapSeconds clips an interval to the window", () => {
  const start = new Date(2025, 9, 23, 9, 0)
  const end = new Date(2025, 9, 23, 10, 0)
  const from = new Date(2025, 9, 23, 9, 30)
  const to = new Date(2025, 9, 23, 11, 0)
  assert.equal(overlapSeconds(start, end, from, to), 1800)
  assert.equal(overlapSeconds(start, end, new Date(2025, 9, 23, 10, 0), to), 0)
  assert.equal(overlapSeconds(start, end, new Date(2025, 9, 23, 8, 0), new Date(2025, 9, 23, 9, 15)), 900)
})

test("parseLocalDate accepts real calendar dates and rejects impossible ones", () => {
  assert.equal(formatLocalDate(parseLocalDate("2025-10-23")!), "2025-10-23")
  assert.equal(formatLocalDate(parseLocalDate("2024-02-29")!), "2024-02-29")
  assert.equal(parseLocalDate("2023-02-29"), null)
  assert.equal(parseLocalDate("2025-02-30"), null)
  assert.equal(parseLocalDate("2025-13-01"), null)
  assert.equal(parseLocalDate("2025/10/23"), null)
  assert.equal(parseLocalDate(""), null)
})

test("parseDate resolves absolute, relative, and weekday forms to local dates", () => {
  // Thursday 2025-10-23, 13:05 local.
  const now = new Date(2025, 9, 23, 13, 5)
  assert.equal(parseDate("2025-10-23", now), "2025-10-23")
  assert.equal(parseDate("today", now), "2025-10-23")
  assert.equal(parseDate("yesterday", now), "2025-10-22")
  assert.equal(parseDate("mon", now), "2025-10-20")
  assert.equal(parseDate("thu", now), "2025-10-23")
  assert.equal(parseDate("sun", now), "2025-10-26")
  assert.equal(parseDate("MON", now), "2025-10-20")
  assert.equal(parseDate(" 2025-10-23 ", now), "2025-10-23")
})

test("parseDate returns null for malformed or impossible input", () => {
  const now = new Date(2025, 9, 23, 13, 5)
  for (const input of ["", "nope", "monday", "2025-02-30", "2025/10/23", "next monday", "13"]) {
    assert.equal(parseDate(input, now), null, `parseDate(${JSON.stringify(input)})`)
  }
})

test("parseDate weekday resolution follows weekStart", () => {
  // Sunday 2025-10-26, 12:00 local.
  const now = new Date(2025, 9, 26, 12, 0)
  assert.equal(parseDate("sun", now, "monday"), "2025-10-26")
  assert.equal(parseDate("sat", now, "monday"), "2025-10-25")
  assert.equal(parseDate("sun", now, "sunday"), "2025-10-26")
  assert.equal(parseDate("sat", now, "sunday"), "2025-11-01")
})
