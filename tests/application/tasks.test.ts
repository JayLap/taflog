import { test } from "node:test"
import assert from "node:assert/strict"
import { FakeClock, InMemoryEventLog } from "../support/fakes.ts"
import { StartTask } from "../../src/application/start-task.ts"
import { StopTask } from "../../src/application/stop-task.ts"
import { ShowStatus } from "../../src/application/status.ts"
import { AlreadyRunningError, NothingRunningError } from "../../src/application/errors.ts"
import { ForgottenTimerError } from "../../src/application/errors.ts"
import { formatLocalDate } from "../../src/domain/datetime.ts"
import type { Event } from "../../src/domain/events.ts"

test("StartTask appends a start event and returns the Timer", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  const result = await new StartTask(clock, log).execute({ project: "acme", description: "new parser" })

  assert.equal(result.timer.project, "acme")
  assert.equal(result.timer.description, "new parser")
  assert.equal(log.events.length, 1)
  const event = log.events[0]
  assert.equal(event?.t, "start")
  assert.equal(event?.at, new Date("2025-10-23T09:12:00").toISOString())
  assert.match(result.event.id, /^[0-9a-z]{8}$/)
  assert.equal(result.skipped, 0)
})

test("StartTask trims the project and omits an empty description", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "  acme  " })
  assert.equal(log.events[0]?.project, "acme")
  assert.equal("description" in (log.events[0] ?? {}), false)
})

test("StartTask refuses to start while a Timer is running", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T09:36:00")
  await assert.rejects(
    () => new StartTask(clock, log).execute({ project: "beta" }),
    (error: unknown) => error instanceof AlreadyRunningError && /acme/.test(error.message),
  )
  assert.equal(log.events.length, 1)
})

test("StopTask closes the Timer and returns the Entry", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme", description: "new parser" })
  clock.set("2025-10-23T09:36:00")
  const result = await new StopTask(clock, log).execute({})

  assert.equal(result.entry.project, "acme")
  assert.equal(result.entry.description, "new parser")
  assert.equal(result.entry.end.getTime() - result.entry.start.getTime(), 24 * 60 * 1000)
  assert.equal(log.events[1]?.t, "stop")
})

test("StopTask applies a Description given at stop time", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme", description: "draft" })
  clock.set("2025-10-23T09:36:00")
  const result = await new StopTask(clock, log).execute({ description: "final" })
  assert.equal(result.entry.description, "final")
})

test("StopTask fails when nothing is running", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await assert.rejects(
    () => new StopTask(clock, log).execute({}),
    (error: unknown) => error instanceof NothingRunningError,
  )
})

test("StopTask refuses to close a forgotten Timer without force", async () => {
  const clock = new FakeClock("2025-10-23T09:00:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T18:00:00")
  await assert.rejects(
    () => new StopTask(clock, log).execute({}),
    (error: unknown) => error instanceof ForgottenTimerError && /acme/.test(error.message),
  )
  assert.equal(log.events.length, 1)
})

test("StopTask closes a forgotten Timer with force", async () => {
  const clock = new FakeClock("2025-10-23T09:00:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T18:00:00")
  const result = await new StopTask(clock, log).execute({ force: true })
  assert.equal(result.entry.project, "acme")
  assert.equal(log.events.length, 2)
})

test("ShowStatus reports the running Timer and today's timed total", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme", description: "new parser" })
  clock.set("2025-10-23T09:36:00")
  const result = await new ShowStatus(clock, log).execute()

  assert.equal(result.timer?.project, "acme")
  assert.equal(result.today.timedSeconds, 24 * 60)
  assert.equal(result.today.adjustedSeconds, 0)
  assert.equal(result.today.totalSeconds, 24 * 60)
})

test("ShowStatus reports idle with the last Entry and day totals", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme", description: "new parser" })
  clock.set("2025-10-23T09:36:00")
  await new StopTask(clock, log).execute({})
  clock.set("2025-10-23T10:42:00")
  const result = await new ShowStatus(clock, log).execute()

  assert.equal(result.timer, null)
  assert.equal(result.lastEntry?.project, "acme")
  assert.equal(result.today.timedSeconds, 24 * 60)
})

test("ShowStatus counts today's Adjustments toward the total", async () => {
  const clock = new FakeClock("2025-10-23T10:42:00")
  const log = new InMemoryEventLog()
  const today = formatLocalDate(clock.now())
  const adjustEvent: Event = {
    v: 1,
    id: "aaaaaaa1",
    t: "adjust",
    at: clock.now().toISOString(),
    date: today,
    project: "acme",
    delta: 3000,
  }
  log.events.push(adjustEvent)
  const result = await new ShowStatus(clock, log).execute()

  assert.equal(result.today.timedSeconds, 0)
  assert.equal(result.today.adjustedSeconds, 3000)
  assert.equal(result.today.totalSeconds, 3000)
})

test("ShowStatus ignores yesterday's Adjustments", async () => {
  const clock = new FakeClock("2025-10-23T10:42:00")
  const log = new InMemoryEventLog()
  log.events.push({
    v: 1,
    id: "aaaaaaa1",
    t: "adjust",
    at: clock.now().toISOString(),
    date: "2025-10-22",
    project: "acme",
    delta: 3000,
  })
  const result = await new ShowStatus(clock, log).execute()
  assert.equal(result.today.adjustedSeconds, 0)
})

test("ShowStatus surfaces the skipped-line count from the log", async () => {
  const clock = new FakeClock("2025-10-23T10:42:00")
  const log = new InMemoryEventLog([], 3)
  const result = await new ShowStatus(clock, log).execute()
  assert.equal(result.skipped, 3)
})
