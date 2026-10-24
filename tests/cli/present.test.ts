import { test } from "node:test"
import assert from "node:assert/strict"
import { renderStatus, statusJson } from "../../src/adapters/in/cli/present.ts"
import type { StatusResult } from "../../src/application/status.ts"
import type { Entry, Timer } from "../../src/domain/entry.ts"

function timer(project: string, description: string, start: Date): Timer {
  return { id: "aaaaaaa1", project, description, start }
}

function entry(project: string, description: string, start: Date, end: Date): Entry {
  return { id: "aaaaaaa1", project, description, start, end }
}

test("status renders a running Timer", () => {
  const now = new Date(2025, 9, 23, 9, 36)
  const result: StatusResult = {
    skipped: 0,
    now,
    timer: timer("acme", "new parser", new Date(2025, 9, 23, 9, 12)),
    lastEntry: null,
    today: { timedSeconds: 24 * 60, adjustedSeconds: 0, totalSeconds: 24 * 60 },
  }
  const lines = renderStatus(result).split("\n")
  assert.match(lines[0] ?? "", /^● acme — new parser$/)
  assert.match(lines[1] ?? "", /^ {2}running 24m \(since \d{2}:12\) · today 24m$/)
})

test("status renders the idle state with the last Entry", () => {
  const now = new Date(2025, 9, 23, 10, 42)
  const result: StatusResult = {
    skipped: 0,
    now,
    timer: null,
    lastEntry: entry("acme", "review", new Date(2025, 9, 23, 9, 36), new Date(2025, 9, 23, 10, 42)),
    today: { timedSeconds: 66 * 60, adjustedSeconds: 0, totalSeconds: 66 * 60 },
  }
  assert.match(renderStatus(result), /^○ idle · last acme 1h06m \(ended \d{2}:42\) · today 1h06m\n$/)
})

test("status renders the idle state without history", () => {
  const result: StatusResult = {
    skipped: 0,
    now: new Date(2025, 9, 23, 8, 0),
    timer: null,
    lastEntry: null,
    today: { timedSeconds: 0, adjustedSeconds: 0, totalSeconds: 0 },
  }
  assert.equal(renderStatus(result), "○ idle · today 0m\n")
})

test("statusJson is the frozen version-1 shape with seconds", () => {
  const result: StatusResult = {
    skipped: 0,
    now: new Date("2025-10-23T13:05:00.000Z"),
    timer: timer("acme", "new parser", new Date("2025-10-23T12:41:00.000Z")),
    lastEntry: null,
    today: { timedSeconds: 8040, adjustedSeconds: 3000, totalSeconds: 11040 },
  }
  assert.deepEqual(JSON.parse(statusJson(result)), {
    version: 1,
    now: "2025-10-23T13:05:00.000Z",
    running: {
      id: "aaaaaaa1",
      project: "acme",
      description: "new parser",
      start: "2025-10-23T12:41:00.000Z",
      elapsedSeconds: 1440,
    },
    today: { timedSeconds: 8040, adjustedSeconds: 3000, totalSeconds: 11040 },
  })
})
