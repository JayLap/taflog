import { test } from "node:test"
import assert from "node:assert/strict"
import { FakeClock, InMemoryEventLog } from "../support/fakes.ts"
import { StartTask } from "../../src/application/start-task.ts"
import { SwitchTask } from "../../src/application/switch-task.ts"
import { UsageError } from "../../src/application/errors.ts"
import { ForgottenTimerError } from "../../src/application/errors.ts"

test("SwitchTask while idle opens a Timer with a start event", async () => {
  const clock = new FakeClock("2025-10-23T09:36:00")
  const log = new InMemoryEventLog()
  const result = await new SwitchTask(clock, log).execute({ project: "beta", description: "emails" })

  assert.equal(result.closed, null)
  assert.equal(result.timer.project, "beta")
  assert.equal(result.timer.description, "emails")
  assert.equal(result.timer.start.getTime(), new Date("2025-10-23T09:36:00").getTime())
  assert.equal(log.events.length, 1)
  assert.equal(log.events[0]?.t, "start")
})

test("SwitchTask closes the open Entry and opens the next at the same instant", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme", description: "new parser" })
  clock.set("2025-10-23T09:36:00")
  const result = await new SwitchTask(clock, log).execute({ project: "beta", description: "emails" })

  assert.equal(log.events.length, 2)
  const switched = log.events[1]
  assert.equal(switched?.t, "switch")
  assert.equal(switched?.t === "switch" ? switched.from : null, result.closed?.id)
  assert.equal(result.closed?.project, "acme")
  assert.equal(result.closed?.description, "new parser")
  assert.equal(result.closed?.end.getTime(), new Date("2025-10-23T09:36:00").getTime())
  assert.equal(result.timer.project, "beta")
  assert.equal(result.timer.start.getTime(), new Date("2025-10-23T09:36:00").getTime())
})

test("SwitchTask trims the project and requires one", async () => {
  const clock = new FakeClock("2025-10-23T09:36:00")
  const log = new InMemoryEventLog()
  await new SwitchTask(clock, log).execute({ project: "  beta  " })
  assert.equal(log.events[0]?.t === "start" ? log.events[0].project : null, "beta")

  await assert.rejects(
    () => new SwitchTask(clock, log).execute({ project: "   " }),
    UsageError,
  )
})

test("SwitchTask refuses to close a forgotten Timer without force", async () => {
  const clock = new FakeClock("2025-10-23T09:00:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T18:00:00")

  await assert.rejects(
    () => new SwitchTask(clock, log).execute({ project: "beta" }),
    (error: unknown) => error instanceof ForgottenTimerError && /acme/.test(error.message),
  )
  assert.equal(log.events.length, 1)
})

test("SwitchTask closes a forgotten Timer with force", async () => {
  const clock = new FakeClock("2025-10-23T09:00:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T18:00:00")

  const result = await new SwitchTask(clock, log).execute({ project: "beta", force: true })
  assert.equal(result.closed?.project, "acme")
  assert.equal(result.timer.project, "beta")
  assert.equal(log.events.length, 2)
  assert.equal(log.events[1]?.t, "switch")
})

test("SwitchTask switches at an explicit time", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme", description: "new parser" })
  clock.set("2025-10-23T13:00:00")
  const result = await new SwitchTask(clock, log).execute({ project: "beta", time: "12:00" })

  const expected = new Date(2025, 9, 23, 12, 0)
  assert.equal(result.closed?.end.getTime(), expected.getTime())
  assert.equal(result.timer.start.getTime(), expected.getTime())
  assert.equal(result.event.at, expected.toISOString())
  assert.equal(log.events[1]?.at, expected.toISOString())
})

test("SwitchTask rejects an explicit time before the latest opening event", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T11:00:00")
  await new SwitchTask(clock, log).execute({ project: "beta" })
  clock.set("2025-10-23T13:00:00")

  await assert.rejects(
    () => new SwitchTask(clock, log).execute({ project: "gamma", time: "10:00" }),
    (error: unknown) => error instanceof UsageError && /before the timer started/.test(error.message),
  )
  assert.equal(log.events.length, 2)
})

test("SwitchTask rejects a future time and a time while idle", async () => {
  const clock = new FakeClock("2025-10-23T09:12:00")
  const log = new InMemoryEventLog()

  await assert.rejects(
    () => new SwitchTask(clock, log).execute({ project: "beta", time: "10:00" }),
    (error: unknown) =>
      error instanceof UsageError && /no Timer is running/.test(error.message),
  )
  assert.equal(log.events.length, 0)

  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T10:00:00")
  await assert.rejects(
    () => new SwitchTask(clock, log).execute({ project: "beta", time: "11:00" }),
    (error: unknown) => error instanceof UsageError && /in the future/.test(error.message),
  )
  assert.equal(log.events.length, 1)
})

test("SwitchTask applies the forgotten limit to the explicit end", async () => {
  const clock = new FakeClock("2025-10-23T09:00:00")
  const log = new InMemoryEventLog()
  await new StartTask(clock, log).execute({ project: "acme" })
  clock.set("2025-10-23T18:00:00")

  const result = await new SwitchTask(clock, log).execute({ project: "beta", time: "17:00" })
  assert.equal(result.closed?.end.getTime(), new Date(2025, 9, 23, 17, 0).getTime())

  const secondLog = new InMemoryEventLog()
  const secondClock = new FakeClock("2025-10-23T09:00:00")
  await new StartTask(secondClock, secondLog).execute({ project: "gamma" })
  secondClock.set("2025-10-23T18:00:00")
  await assert.rejects(
    () => new SwitchTask(secondClock, secondLog).execute({ project: "beta", time: "18:00" }),
    (error: unknown) => error instanceof ForgottenTimerError,
  )
})
