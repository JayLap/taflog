import { test } from "node:test"
import assert from "node:assert/strict"
import {
  addLocalDays,
  enumerateLocalDays,
  formatLocalDate,
  formatShortMonth,
  formatShortWeekday,
  isoWeekNumber,
  isWeekend,
  startOfLocalMonth,
  startOfLocalWeek,
  startOfNextLocalMonth,
  startOfNextLocalWeek,
} from "../../src/domain/datetime.ts"

test("startOfLocalWeek follows weekStart", () => {
  // Thursday 2025-10-23.
  const thursday = new Date(2025, 9, 23, 13, 5)
  assert.equal(formatLocalDate(startOfLocalWeek(thursday, "monday")), "2025-10-20")
  assert.equal(formatLocalDate(startOfLocalWeek(thursday, "sunday")), "2025-10-19")
})

test("startOfNextLocalWeek advances seven calendar days", () => {
  const thursday = new Date(2025, 9, 23, 13, 5)
  assert.equal(formatLocalDate(startOfNextLocalWeek(thursday, "monday")), "2025-10-27")
  assert.equal(formatLocalDate(startOfNextLocalWeek(thursday, "sunday")), "2025-10-26")
})

test("start of month helpers use local midnight", () => {
  const date = new Date(2025, 9, 23, 13, 5)
  assert.equal(formatLocalDate(startOfLocalMonth(date)), "2025-10-01")
  assert.equal(formatLocalDate(startOfNextLocalMonth(date)), "2025-11-01")
  assert.equal(startOfLocalMonth(date).getHours(), 0)
})

test("addLocalDays crosses month boundaries", () => {
  assert.equal(formatLocalDate(addLocalDays(new Date(2025, 9, 31), 1)), "2025-11-01")
  assert.equal(formatLocalDate(addLocalDays(new Date(2025, 9, 1), -1)), "2025-09-30")
})

test("enumerateLocalDays returns every local midnight in [from, to)", () => {
  const days = enumerateLocalDays(new Date(2025, 9, 20), new Date(2025, 9, 23))
  assert.deepEqual(days.map(formatLocalDate), ["2025-10-20", "2025-10-21", "2025-10-22"])
})

test("weekend and label helpers are locale independent", () => {
  const saturday = new Date(2025, 9, 25)
  const sunday = new Date(2025, 9, 26)
  assert.equal(isWeekend(saturday), true)
  assert.equal(isWeekend(sunday), true)
  assert.equal(isWeekend(new Date(2025, 9, 24)), false)
  assert.equal(formatShortWeekday(saturday), "Sat")
  assert.equal(formatShortWeekday(sunday), "Sun")
  assert.equal(formatShortMonth(new Date(2025, 9, 23)), "Oct")
})

test("isoWeekNumber matches ISO-8601 for the specimen week", () => {
  assert.equal(isoWeekNumber(new Date(2025, 9, 20)), 43)
  assert.equal(isoWeekNumber(new Date(2025, 9, 26)), 43)
  // The last week of 2025 belongs to 2026 under ISO rules.
  assert.equal(isoWeekNumber(new Date(2025, 11, 29)), 1)
})
