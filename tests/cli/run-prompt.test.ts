import { test } from "node:test"
import assert from "node:assert/strict"
import { parseArgs } from "../../src/adapters/in/cli/args.ts"
import type { CliDeps } from "../../src/adapters/in/cli/run.ts"
import { runCli } from "../../src/adapters/in/cli/run.ts"
import { AddAdjustment, SubAdjustment } from "../../src/application/adjustment.ts"
import { StartTask } from "../../src/application/start-task.ts"
import { SwitchTask } from "../../src/application/switch-task.ts"
import { FakeClock, InMemoryEventLog } from "../support/fakes.ts"

function deps(
  log: InMemoryEventLog,
  timerPrompt: () => Promise<{ project: string; description?: string } | null>,
  interactive: boolean,
  adjustmentPrompt: () => Promise<{ project: string; duration: string } | null> = async () => null,
): { deps: CliDeps; stdout: string[] } {
  const stdout: string[] = []
  const clock = new FakeClock()
  const value = <T>(value: T) => ({ value, source: "default" as const })
  const deps = {
    startTask: new StartTask(clock, log),
    switchTask: new SwitchTask(clock, log),
    addAdjustment: new AddAdjustment(clock, log),
    subAdjustment: new SubAdjustment(clock, log),
    timerPrompt,
    adjustmentPrompt,
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
    isTTY: interactive,
    isInputTTY: interactive,
  } as unknown as CliDeps
  return { deps, stdout }
}

test("interactive start with no operands uses the prompt", async () => {
  const log = new InMemoryEventLog()
  const fixture = deps(log, async () => ({ project: "acme", description: "new parser" }), true)
  const code = await runCli(parseArgs(["start"]), fixture.deps)

  assert.equal(code, 0)
  assert.equal(log.events[0]?.t, "start")
  assert.equal(log.events[0]?.project, "acme")
  assert.equal(log.events[0]?.description, "new parser")
  assert.match(fixture.stdout.join(""), /acme/)
})

test("interactive switch with no operands uses the prompt", async () => {
  const log = new InMemoryEventLog([
    {
      v: 1,
      id: "aaaaaaa1",
      t: "start",
      at: "2025-10-23T09:00:00.000Z",
      project: "acme",
    },
  ])
  const fixture = deps(log, async () => ({ project: "beta", description: "emails" }), true)
  const code = await runCli(parseArgs(["switch"]), fixture.deps)

  assert.equal(code, 0)
  assert.equal(log.events[1]?.t, "switch")
  assert.equal(log.events[1]?.project, "beta")
  assert.equal(log.events[1]?.description, "emails")
  assert.match(fixture.stdout.join(""), /beta/)
})

test("interactive add with no operands prompts for Project and Duration", async () => {
  const log = new InMemoryEventLog()
  const fixture = deps(
    log,
    async () => null,
    true,
    async () => ({ project: "acme", duration: "30m" }),
  )
  const code = await runCli(parseArgs(["add"]), fixture.deps)

  assert.equal(code, 0)
  assert.equal(log.events[0]?.t, "adjust")
  assert.equal(log.events[0]?.project, "acme")
  assert.equal(log.events[0]?.delta, 1800)
  assert.match(fixture.stdout.join(""), /acme/)
})

test("interactive sub with no operands prompts for Project and Duration", async () => {
  const log = new InMemoryEventLog()
  const fixture = deps(
    log,
    async () => null,
    true,
    async () => ({ project: "beta", duration: "30m" }),
  )
  const code = await runCli(parseArgs(["sub"]), fixture.deps)

  assert.equal(code, 0)
  assert.equal(log.events[0]?.t, "adjust")
  assert.equal(log.events[0]?.project, "beta")
  assert.equal(log.events[0]?.delta, -1800)
  assert.match(fixture.stdout.join(""), /beta/)
})

test("cancelling the interactive prompt writes no Event and exits 130", async () => {
  const log = new InMemoryEventLog()
  const fixture = deps(log, async () => null, true)
  const code = await runCli(parseArgs(["start"]), fixture.deps)

  assert.equal(code, 130)
  assert.equal(log.events.length, 0)
})

test("non-interactive start with no operands never calls the prompt", async () => {
  const log = new InMemoryEventLog()
  let called = false
  const fixture = deps(
    log,
    async () => {
      called = true
      return { project: "acme" }
    },
    false,
  )
  const code = await runCli(parseArgs(["start"]), fixture.deps)

  assert.equal(code, 2)
  assert.equal(called, false)
  assert.equal(log.events.length, 0)
})
