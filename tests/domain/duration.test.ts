import { test } from "node:test"
import assert from "node:assert/strict"
import { formatDuration, parseDuration } from "../../src/domain/duration.ts"

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

test("parseDuration reads the SPEC §8.5 duration forms into seconds", () => {
  const cases: Array<[string, number]> = [
    ["90m", 5400],
    ["1h", 3600],
    ["1h30m", 5400],
    ["1.5h", 5400],
    ["50", 3000],
    ["0", 0],
    ["2h", 7200],
    ["1h0m", 3600],
    ["1.5", 90],
    [" 1h30m ", 5400],
  ]
  for (const [input, expected] of cases) {
    assert.equal(parseDuration(input), expected, `parseDuration(${JSON.stringify(input)})`)
  }
})

test("parseDuration returns null for malformed input", () => {
  const bad = ["", "h", "1h30", "1x", "abc", "-30m", "1h-30m", "1hg", "30s", "1h 30m"]
  for (const input of bad) {
    assert.equal(parseDuration(input), null, `parseDuration(${JSON.stringify(input)})`)
  }
})
