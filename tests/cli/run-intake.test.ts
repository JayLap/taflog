import { test } from "node:test"
import assert from "node:assert/strict"
import { parseArgs } from "../../src/adapters/in/cli/args.ts"
import type { AdjustmentDraft, Intake, TimerDraft } from "../../src/adapters/in/cli/intake.ts"
import type { CliDeps } from "../../src/adapters/in/cli/run.ts"
import { runCli } from "../../src/adapters/in/cli/run.ts"
import { AddAdjustment, SubAdjustment } from "../../src/application/adjustment.ts"
import { StartTask } from "../../src/application/start-task.ts"
import { StopTask } from "../../src/application/stop-task.ts"
import { SwitchTask } from "../../src/application/switch-task.ts"
import { FakeClock, InMemoryEventLog } from "../support/fakes.ts"

function fakeIntake(answers: {
  timer?: TimerDraft | null
  adjustment?: AdjustmentDraft | null
}): Intake {
  return {
    timer: async () => answers.timer ?? null,
    adjustment: async () => answers.adjustment ?? null,
  }
}

function deps(log: InMemoryEventLog, intake: Intake): { deps: CliDeps; stdout: string[] } {
  const stdout: string[] = []
  const clock = new FakeClock()
  const value = <T>(value: T) => ({ value, source: "default" as const })
  const deps = {
    startTask: new StartTask(clock, log),
    stopTask: new StopTask(clock, log),
    switchTask: new SwitchTask(clock, log),
    addAdjustment: new AddAdjustment(clock, log),
    subAdjustment: new SubAdjustment(clock, log),
    intake,
    config: {
      version: value(1),
      dir: value("/tmp"),
      weekStart: value("monday" as const),
      maxTimerHours: value(8),
      color: value("never" as const),
      icons: value("ascii" as const),
    },
    version: "0.0.0",
    stdout: (chunk: string) => stdout.push(chunk),
    stderr: () => {},
    isTTY: true,
  } as unknown as CliDeps
  return { deps, stdout }
}

test("start with no operands uses the intake", async () => {
  const log = new InMemoryEventLog()
  const fixture = deps(
    log,
    fakeIntake({ timer: { project: "acme", description: "new parser" } }),
  )
  const code = await runCli(parseArgs(["start"]), fixture.deps)

  assert.equal(code, 0)
  assert.equal(log.events[0]?.t, "start")
  assert.equal(log.events[0]?.project, "acme")
  assert.equal(log.events[0]?.description, "new parser")
  assert.match(fixture.stdout.join(""), /acme/)
})

test("switch with no operands uses the intake", async () => {
  const log = new InMemoryEventLog([
    {
      v: 1,
      id: "aaaaaaa1",
      t: "start",
      at: "2025-10-23T09:00:00.000Z",
      project: "acme",
    },
  ])
  const fixture = deps(log, fakeIntake({ timer: { project: "beta", description: "emails" } }))
  const code = await runCli(parseArgs(["switch"]), fixture.deps)

  assert.equal(code, 0)
  assert.equal(log.events[1]?.t, "switch")
  assert.equal(log.events[1]?.project, "beta")
  assert.equal(log.events[1]?.description, "emails")
  assert.match(fixture.stdout.join(""), /beta/)
})

test("add with no operands uses the intake", async () => {
  const log = new InMemoryEventLog()
  const fixture = deps(log, fakeIntake({ adjustment: { project: "acme", duration: "30m" } }))
  const code = await runCli(parseArgs(["add"]), fixture.deps)

  assert.equal(code, 0)
  assert.equal(log.events[0]?.t, "adjust")
  assert.equal(log.events[0]?.project, "acme")
  assert.equal(log.events[0]?.delta, 1800)
  assert.match(fixture.stdout.join(""), /acme/)
})

test("sub with no operands uses the intake", async () => {
  const log = new InMemoryEventLog()
  const fixture = deps(log, fakeIntake({ adjustment: { project: "beta", duration: "30m" } }))
  const code = await runCli(parseArgs(["sub"]), fixture.deps)

  assert.equal(code, 0)
  assert.equal(log.events[0]?.t, "adjust")
  assert.equal(log.events[0]?.project, "beta")
  assert.equal(log.events[0]?.delta, -1800)
  assert.match(fixture.stdout.join(""), /beta/)
})

test("stop with an explicit time dispatches the parsed time", async () => {
  const log = new InMemoryEventLog([
    {
      v: 1,
      id: "aaaaaaa1",
      t: "start",
      at: new Date(2025, 9, 23, 9, 0).toISOString(),
      project: "acme",
    },
  ])
  const fixture = deps(log, fakeIntake({}))
  const code = await runCli(parseArgs(["stop", "09:05"]), fixture.deps)

  assert.equal(code, 0)
  assert.equal(log.events[1]?.t, "stop")
  assert.equal(log.events[1]?.at, new Date(2025, 9, 23, 9, 5).toISOString())
})

test("stop and switch reject --date", async () => {
  const log = new InMemoryEventLog()
  const fixture = deps(log, fakeIntake({}))

  assert.equal(await runCli(parseArgs(["stop", "09:05", "--date", "today"]), fixture.deps), 2)
  assert.equal(await runCli(parseArgs(["switch", "beta", "--date", "today"]), fixture.deps), 2)
  assert.equal(log.events.length, 0)
})

test("cancelling the intake writes no Event and exits 130", async () => {
  const log = new InMemoryEventLog()
  const fixture = deps(log, fakeIntake({ timer: null }))
  const code = await runCli(parseArgs(["start"]), fixture.deps)

  assert.equal(code, 130)
  assert.equal(log.events.length, 0)
})
