import { test } from "node:test"
import assert from "node:assert/strict"
import { renderStatus, statusJson } from "../../src/adapters/in/cli/present.ts"
import { renderAdjusted, renderRemoved, renderSwitched } from "../../src/adapters/in/cli/present.ts"
import type { StatusResult } from "../../src/application/status.ts"
import type { AdjustmentResult } from "../../src/application/adjustment.ts"
import type { RemoveResult } from "../../src/application/remove-entry.ts"
import type { SwitchResult } from "../../src/application/switch-task.ts"
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

test("renderSwitched shows the closed Entry and the new Timer", () => {
  const result: SwitchResult = {
    skipped: 0,
    event: {
      v: 1,
      id: "bbbbbbb2",
      t: "switch",
      at: "2025-10-23T09:36:00.000Z",
      from: "aaaaaaa1",
      project: "beta",
    },
    closed: entry("acme", "new parser", new Date(2025, 9, 23, 9, 12), new Date(2025, 9, 23, 9, 36)),
    timer: timer("beta", "emails", new Date(2025, 9, 23, 9, 36)),
  }
  assert.equal(renderSwitched(result), "○ acme 24m → ● beta — running since 09:36\n")
})

test("renderSwitched while idle renders like start", () => {
  const result: SwitchResult = {
    skipped: 0,
    event: {
      v: 1,
      id: "bbbbbbb2",
      t: "start",
      at: "2025-10-23T09:36:00.000Z",
      project: "beta",
    },
    closed: null,
    timer: timer("beta", "emails", new Date(2025, 9, 23, 9, 36)),
  }
  assert.equal(renderSwitched(result), "● beta — running since 09:36\n")
})

test("renderAdjusted shows the signed duration, project, date, and note", () => {
  const added: AdjustmentResult = {
    skipped: 0,
    event: {
      v: 1,
      id: "aaaaaaa1",
      t: "adjust",
      at: "2025-10-23T13:05:00.000Z",
      date: "2025-10-23",
      project: "acme",
      delta: 3000,
      note: "forgot to start",
    },
    adjustment: {
      id: "aaaaaaa1",
      project: "acme",
      date: "2025-10-23",
      delta: 3000,
      note: "forgot to start",
    },
  }
  assert.equal(renderAdjusted(added), "+50m acme · 2025-10-23 — forgot to start\n")

  const subtracted: AdjustmentResult = {
    ...added,
    adjustment: { id: "bbbbbbb2", project: "beta", date: "2025-10-22", delta: -1800 },
  }
  assert.equal(renderAdjusted(subtracted), "−30m beta · 2025-10-22\n")
})

test("renderRemoved names the removed Entry or Adjustment", () => {
  const removedEntry: RemoveResult = {
    skipped: 0,
    event: {
      v: 1,
      id: "ffffffff",
      t: "delete",
      at: "2025-10-23T13:05:00.000Z",
      entry: "aaaaaaa1",
    },
    removed: {
      kind: "entry",
      entry: entry("acme", "", new Date(2025, 9, 23, 9, 12), new Date(2025, 9, 23, 9, 36)),
    },
  }
  assert.equal(renderRemoved(removedEntry), "○ removed acme 24m\n")

  const removedAdjustment: RemoveResult = {
    ...removedEntry,
    removed: {
      kind: "adjustment",
      adjustment: { id: "bbbbbbb2", project: "beta", date: "2025-10-23", delta: -1800 },
    },
  }
  assert.equal(renderRemoved(removedAdjustment), "○ removed adjustment −30m beta\n")
})

test("renderStatus strips terminal control sequences from Log text", () => {
  const result: StatusResult = {
    skipped: 0,
    now: new Date(2025, 9, 23, 9, 36),
    timer: timer("ac\u001b[31me", "wait\u0007ing", new Date(2025, 9, 23, 9, 12)),
    lastEntry: null,
    today: { timedSeconds: 0, adjustedSeconds: 0, totalSeconds: 0 },
  }
  const text = renderStatus(result)
  assert.doesNotMatch(text, /\u001b|\u0007/)
  assert.match(text.split("\n")[0] ?? "", /^● ac\[31me — waiting$/)
})
