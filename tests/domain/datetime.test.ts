import { test } from "node:test"
import assert from "node:assert/strict"
import {
  formatLocalDate,
  formatLocalTime,
  overlapSeconds,
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
