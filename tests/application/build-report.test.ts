import { test } from "node:test"
import assert from "node:assert/strict"
import { FakeClock, InMemoryEventLog } from "../support/fakes.ts"
import { BuildReport } from "../../src/application/build-report.ts"
import type { Event } from "../../src/domain/events.ts"

const at = (date: string, time: string): string => `${date}T${time}:00.000Z`

function seeded(): InMemoryEventLog {
  return new InMemoryEventLog([
    { v: 1, id: "aaaaaaa1", t: "start", at: at("2025-10-20", "09:00"), project: "acme", description: "new parser" },
    { v: 1, id: "bbbbbbb2", t: "stop", at: at("2025-10-20", "10:00"), entry: "aaaaaaa1" },
    { v: 1, id: "ccccccc3", t: "start", at: at("2025-10-21", "09:00"), project: "beta", description: "emails" },
    { v: 1, id: "ddddddd4", t: "stop", at: at("2025-10-21", "09:30"), entry: "ccccccc3" },
    {
      v: 1,
      id: "eeeeeee5",
      t: "adjust",
      at: at("2025-10-22", "12:00"),
      date: "2025-10-22",
      project: "acme",
      delta: -1800,
    },
  ])
}

test("BuildReport defaults to this week and returns byProject and byDay", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const result = await new BuildReport(clock, seeded()).execute({})

  assert.equal(result.range.fromDate, "2025-10-20")
  assert.equal(result.range.toDate, "2025-10-26")
  assert.deepEqual(result.report.range, {
    from: "2025-10-20",
    to: "2025-10-26",
    weekStart: "monday",
  })
  assert.deepEqual(result.report.byProject.map((project) => project.project), ["acme", "beta"])
  assert.equal(result.report.byDay.length, 7)
})

test("BuildReport filters by project", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const result = await new BuildReport(clock, seeded()).execute({ project: "BETA" })
  assert.deepEqual(result.report.byProject.map((project) => project.project), ["beta"])
  assert.equal(result.report.byProject[0]?.totalSeconds, 1800)
  assert.equal(
    result.report.byDay.reduce((sum, day) => sum + day.totalSeconds, 0),
    1800,
  )
})

test("BuildReport honors --today and an explicit range", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const today = await new BuildReport(clock, seeded()).execute({ today: true })
  assert.equal(today.range.preset, "today")
  assert.deepEqual(today.report.byProject, [])

  const explicit = await new BuildReport(clock, seeded()).execute({
    from: "2025-10-20",
    to: "2025-10-21",
  })
  assert.equal(explicit.range.preset, "custom")
  assert.equal(explicit.report.byProject.length, 2)
})

test("BuildReport surfaces the skipped-line count", async () => {
  const clock = new FakeClock("2025-10-23T13:05:00")
  const log = seeded()
  log.skipped = 1
  const result = await new BuildReport(clock, log).execute({})
  assert.equal(result.skipped, 1)
})
