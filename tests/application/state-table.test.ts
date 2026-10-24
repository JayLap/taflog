import { test } from "node:test"
import assert from "node:assert/strict"
import { FakeClock, InMemoryEventLog } from "../support/fakes.ts"
import { StartTask } from "../../src/application/start-task.ts"
import { StopTask } from "../../src/application/stop-task.ts"
import { SwitchTask } from "../../src/application/switch-task.ts"
import { ShowStatus } from "../../src/application/status.ts"
import {
  AlreadyRunningError,
  ForgottenTimerError,
  NothingRunningError,
} from "../../src/application/errors.ts"

/**
 * SPEC §10, one test per row of the running-Timer state table. The correction
 * rows (`add`/`sub` while running, negative days, `rm` on the open Timer) live
 * with the corrections: `tests/application/adjustment.test.ts`,
 * `tests/application/remove-entry.test.ts`, and `tests/domain/summary.test.ts`.
 */

test("start while idle opens a Timer", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  const result = await new StartTask(clock, log).execute({ project: "acme" })
  assert.equal(result.timer.project, "acme")
  assert.equal(log.events[0]?.t, "start")
})

test("start while running is refused", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T09:36:00")
  await assert.rejects(
    () => new StartTask(clock, log).execute({ project: "beta" }),
    (error: unknown) => error instanceof AlreadyRunningError,
  )
})

test("switch while idle opens a Timer", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  const result = await new SwitchTask(clock, log).execute({ project: "beta" })
  assert.equal(result.closed, null)
  assert.equal(result.timer.project, "beta")
  assert.equal(log.events[0]?.t, "start")
})

test("switch while running closes and opens at the same instant", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T09:36:00")
  const result = await new SwitchTask(clock, log).execute({ project: "beta" })
  assert.equal(result.closed?.end.getTime(), result.timer.start.getTime())
  assert.equal(log.events.length, 2)
  assert.equal(log.events[1]?.t, "switch")
})

test("stop while idle is refused", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await assert.rejects(
    () => new StopTask(clock, log).execute({}),
    (error: unknown) => error instanceof NothingRunningError,
  )
})

test("stop [description] closes the Timer and sets its Description", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme", description: "draft" })
  clock.set("2025-10-23T09:36:00")
  const result = await new StopTask(clock, log).execute({ description: "final" })
  assert.equal(result.entry.description, "final")
})

test("an orphan Timer is never auto-closed and status shows it", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T09:36:00")
  const status = await new ShowStatus(clock, log).execute()
  assert.equal(status.timer?.project, "acme")
  // Replaying does not fabricate an end: the Timer is still open.
  assert.equal((await log.readAll()).events.length, 1)
})

test("over-age stop is refused without --force and closes with it", async () => {
  const clock = new FakeClock("2025-10-23T09:00:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T18:00:00")

  await assert.rejects(
    () => new StopTask(clock, log).execute({}),
    (error: unknown) => error instanceof ForgottenTimerError,
  )
  const forced = await new StopTask(clock, log).execute({ force: true })
  assert.equal(forced.entry.project, "acme")
})

test("over-age switch is refused without --force and closes with it", async () => {
  const clock = new FakeClock("2025-10-23T09:00:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T18:00:00")

  await assert.rejects(
    () => new SwitchTask(clock, log).execute({ project: "beta" }),
    (error: unknown) => error instanceof ForgottenTimerError,
  )
  const forced = await new SwitchTask(clock, log).execute({ project: "beta", force: true })
  assert.equal(forced.closed?.project, "acme")
  assert.equal(forced.timer.project, "beta")
})
