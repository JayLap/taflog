import { test } from "node:test"
import assert from "node:assert/strict"
import { FakeClock, InMemoryEventLog } from "../support/fakes.ts"
import { AddAdjustment, SubAdjustment } from "../../src/application/adjustment.ts"
import { StartTask } from "../../src/application/start-task.ts"
import { UsageError } from "../../src/application/errors.ts"
import { formatLocalDate } from "../../src/domain/datetime.ts"

const fixedId = (): string => "aaaaaaa1"

test("AddAdjustment appends a positive adjust event dated today", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const log = new InMemoryEventLog()
  const result = await new AddAdjustment(clock, log, fixedId).execute({
    project: "acme",
    duration: "90m",
    note: "forgot to start",
  })

  assert.equal(log.events.length, 1)
  assert.deepEqual(log.events[0], {
    v: 1,
    id: "aaaaaaa1",
    t: "adjust",
    at: new Date("2025-10-23T13:05:00").toISOString(),
    date: formatLocalDate(clock.now()),
    project: "acme",
    delta: 5400,
    note: "forgot to start",
  })
  assert.deepEqual(result.adjustment, {
    id: "aaaaaaa1",
    project: "acme",
    date: formatLocalDate(clock.now()),
    delta: 5400,
    note: "forgot to start",
  })
})

test("SubAdjustment appends a negative delta for the same duration", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const log = new InMemoryEventLog()
  const result = await new SubAdjustment(clock, log, fixedId).execute({
    project: "beta",
    duration: "1h30m",
  })
  assert.equal(log.events[0]?.t, "adjust")
  assert.equal((log.events[0] as { delta: number }).delta, -5400)
  assert.equal(result.adjustment.delta, -5400)
})

test("AddAdjustment resolves --date against the clock and trims the project", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const log = new InMemoryEventLog()
  const result = await new AddAdjustment(clock, log, fixedId).execute({
    project: "  acme  ",
    duration: "1.5h",
    date: "yesterday",
  })
  assert.equal(result.adjustment.project, "acme")
  assert.equal(result.adjustment.date, "2025-10-22")
  assert.equal(result.adjustment.delta, 5400)
})

test("AddAdjustment omits an empty note", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const log = new InMemoryEventLog()
  const result = await new AddAdjustment(clock, log, fixedId).execute({
    project: "acme",
    duration: "30m",
    note: "",
  })
  assert.equal("note" in (log.events[0] ?? {}), false)
  assert.equal("note" in result.adjustment, false)
})

test("AddAdjustment rejects a blank project, bad duration, or bad date", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const log = new InMemoryEventLog()
  const task = new AddAdjustment(clock, log, fixedId)

  await assert.rejects(() => task.execute({ project: "   ", duration: "30m" }), UsageError)
  await assert.rejects(() => task.execute({ project: "acme", duration: "nope" }), UsageError)
  await assert.rejects(
    () => task.execute({ project: "acme", duration: "30m", date: "2025-02-30" }),
    UsageError,
  )
  assert.equal(log.events.length, 0)
})

test("an Adjustment is allowed while a Timer is running", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log, fixedId).execute({ project: "acme" })
  await new AddAdjustment(clock, log, () => "bbbbbbb2").execute({ project: "beta", duration: "30m" })

  assert.equal(log.events.length, 2)
  assert.equal(log.events[1]?.t, "adjust")
})

test("AddAdjustment surfaces the skipped-line count from the log", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const log = new InMemoryEventLog([], 2)
  const result = await new AddAdjustment(clock, log, fixedId).execute({
    project: "acme",
    duration: "30m",
  })
  assert.equal(result.skipped, 2)
})