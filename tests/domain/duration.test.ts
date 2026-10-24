import { test } from "node:test"
import assert from "node:assert/strict"
import { formatDuration } from "../../src/domain/duration.ts"

test("formatDuration renders whole minutes", () => {
  assert.equal(formatDuration(0), "0m")
  assert.equal(formatDuration(59), "0m")
  assert.equal(formatDuration(60), "1m")
  assert.equal(formatDuration(1440), "24m")
})

test("formatDuration zero-pads minutes once hours are present", () => {
  assert.equal(formatDuration(3600), "1h00m")
  assert.equal(formatDuration(3960), "1h06m")
  assert.equal(formatDuration(8040), "2h14m")
  assert.equal(formatDuration(60300), "16h45m")
})
