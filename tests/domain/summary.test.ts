import { test } from "node:test"
import assert from "node:assert/strict"
import { summarizeLocalDay } from "../../src/domain/summary.ts"
import { formatLocalDate } from "../../src/domain/datetime.ts"
import type { Adjustment } from "../../src/domain/entry.ts"

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
