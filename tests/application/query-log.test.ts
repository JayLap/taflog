import { test } from "node:test"
import assert from "node:assert/strict"
import { FakeClock, InMemoryEventLog } from "../support/fakes.ts"
import { QueryLog } from "../../src/application/query-log.ts"
import { UsageError } from "../../src/application/errors.ts"
import type { Event } from "../../src/domain/events.ts"

const at = (time: string): string => `2025-10-23T${time}:00.000Z`

function seeded(): InMemoryEventLog {
  const events: Event[] = [
    { v: 1, id: "aaaaaaa1", t: "start", at: at("09:12"), project: "acme", description: "new parser" },
    { v: 1, id: "bbbbbbb2", t: "stop", at: at("09:36"), entry: "aaaaaaa1" },
    { v: 1, id: "ccccccc3", t: "start", at: at("09:36"), project: "acme", description: "review" },
    { v: 1, id: "ddddddd4", t: "stop", at: at("10:42"), entry: "ccccccc3" },
    {
      v: 1,
      id: "eeeeeee5",
      t: "adjust",
      at: at("12:00"),
      date: "2025-10-23",
      project: "acme",
      delta: 3000,
      note: "forgot to start",
    },
    {
      v: 1,
      id: "fffffff6",
      t: "adjust",
      at: at("12:05"),
      date: "2025-10-23",
      project: "beta",
      delta: -1800,
    },
    // Yesterday, excluded by the default today range.
    { v: 1, id: "ggggggg7", t: "adjust", at: at("12:10"), date: "2025-10-22", project: "acme", delta: 600 },
  ]
  return new InMemoryEventLog(events)
}

test("QueryLog defaults to today and reconciles timed + adjusted = total", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const result = await new QueryLog(clock, seeded()).execute({})

  assert.equal(result.range.fromDate, "2025-10-23")
  assert.equal(result.query.project, null)
  assert.equal(result.totals.timedSeconds, 90 * 60)
  assert.equal(result.totals.adjustedSeconds, 3000 - 1800)
  assert.equal(result.totals.totalSeconds, result.totals.timedSeconds + result.totals.adjustedSeconds)
  assert.equal(result.items.length, 4)
})

test("QueryLog lists completed Entries then Adjustments", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const result = await new QueryLog(clock, seeded()).execute({})
  assert.deepEqual(result.items.map((item) => item.kind), ["timed", "timed", "adjust", "adjust"])
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["aaaaaaa1", "ccccccc3", "eeeeeee5", "fffffff6"],
  )
  const second = result.items[1]
  assert.equal(second?.kind, "timed")
  if (second?.kind === "timed") {
    assert.equal(second.durationSeconds, 66 * 60)
    assert.equal(second.description, "review")
  }
})

test("QueryLog filters by project case-insensitively", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const result = await new QueryLog(clock, seeded()).execute({ project: "ACME" })
  assert.deepEqual(result.items.map((item) => item.project), ["acme", "acme", "acme"])
  assert.equal(result.query.project, "ACME")
  assert.equal(result.totals.adjustedSeconds, 3000)
})

test("QueryLog honors an explicit --from/--to range", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const result = await new QueryLog(clock, seeded()).execute({
    from: "2025-10-22",
    to: "2025-10-22",
  })
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0]?.kind, "adjust")
  assert.equal(result.totals.adjustedSeconds, 600)
})

test("QueryLog --limit keeps the most recent items", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const result = await new QueryLog(clock, seeded()).execute({ limit: 2 })
  assert.deepEqual(result.items.map((item) => item.id), ["eeeeeee5", "fffffff6"])
})

test("QueryLog rejects a non-positive --limit", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  await assert.rejects(() => new QueryLog(clock, seeded()).execute({ limit: 0 }), UsageError)
})

test("QueryLog surfaces the skipped-line count", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const log = seeded()
  log.skipped = 2
  const result = await new QueryLog(clock, log).execute({})
  assert.equal(result.skipped, 2)
})
