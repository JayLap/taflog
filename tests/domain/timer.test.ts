import { test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_MAX_TIMER_HOURS, isForgotten } from "../../src/domain/timer.ts"
import type { Timer } from "../../src/domain/entry.ts"

function timer(start: string): Timer {
  return { id: "aaaaaaa1", project: "acme", description: "", start: new Date(start) }
}

test("DEFAULT_MAX_TIMER_HOURS is the documented eight hours", () => {
  assert.equal(DEFAULT_MAX_TIMER_HOURS, 8)
})

test("isForgotten is false for a young Timer", () => {
  assert.equal(
    isForgotten(timer("2025-10-23T09:00:00.000Z"), new Date("2025-10-23T10:00:00.000Z"), 8),
    false,
  )
})

test("isForgotten is false exactly at the threshold", () => {
  assert.equal(
    isForgotten(timer("2025-10-23T00:00:00.000Z"), new Date("2025-10-23T08:00:00.000Z"), 8),
    false,
  )
})

test("isForgotten is true once the Timer is older than the threshold", () => {
  assert.equal(
    isForgotten(timer("2025-10-23T00:00:00.000Z"), new Date("2025-10-23T08:00:01.000Z"), 8),
    true,
  )
})
