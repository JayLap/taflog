import { test } from "node:test"
import assert from "node:assert/strict"
import { UsageError } from "../../src/application/errors.ts"
import { resolveRange } from "../../src/application/range.ts"
import { formatLocalDate } from "../../src/domain/datetime.ts"

// Thursday 2025-10-23, 13:05 local.
const now = new Date(2025, 9, 23, 13, 5)

test("resolveRange defaults to today or the week as requested", () => {
  const today = resolveRange({}, now, "monday", "today")
  assert.equal(today.fromDate, "2025-10-23")
  assert.equal(today.toDate, "2025-10-23")
  assert.equal(today.preset, "today")

  const week = resolveRange({}, now, "monday", "week")
  assert.equal(week.fromDate, "2025-10-20")
  assert.equal(week.toDate, "2025-10-26")
  assert.equal(week.preset, "week")
})

test("resolveRange handles today, week, and month presets", () => {
  assert.equal(resolveRange({ today: true }, now, "monday").fromDate, "2025-10-23")
  assert.equal(resolveRange({ week: true }, now, "monday").fromDate, "2025-10-20")
  assert.equal(resolveRange({ week: true }, now, "sunday").fromDate, "2025-10-19")
  const month = resolveRange({ month: true }, now, "monday")
  assert.equal(month.fromDate, "2025-10-01")
  assert.equal(month.toDate, "2025-10-31")
})

test("resolveRange parses an explicit from/to range", () => {
  const range = resolveRange({ from: "mon", to: "thu" }, now, "monday")
  assert.equal(range.fromDate, "2025-10-20")
  assert.equal(range.toDate, "2025-10-23")
  assert.equal(range.preset, "custom")
  assert.equal(formatLocalDate(range.to), "2025-10-24")
})

test("resolveRange treats a single bound as a single-day range", () => {
  assert.equal(resolveRange({ from: "yesterday" }, now, "monday").toDate, "2025-10-22")
  assert.equal(resolveRange({ to: "2025-10-01" }, now, "monday").fromDate, "2025-10-01")
})

test("resolveRange rejects conflicting presets and impossible ranges", () => {
  assert.throws(() => resolveRange({ today: true, week: true }, now, "monday"), UsageError)
  assert.throws(() => resolveRange({ week: true, from: "mon" }, now, "monday"), UsageError)
  assert.throws(() => resolveRange({ from: "nope" }, now, "monday"), UsageError)
  assert.throws(
    () => resolveRange({ from: "2025-10-24", to: "2025-10-20" }, now, "monday"),
    UsageError,
  )
})
