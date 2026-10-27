import { test } from "node:test"
import assert from "node:assert/strict"
import { PassThrough } from "node:stream"
import { LogCandidates } from "../../src/application/log-candidates.ts"
import { UsageError } from "../../src/application/errors.ts"
import type { Intake } from "../../src/adapters/in/cli/intake.ts"
import { createIntake } from "../../src/adapters/in/cli/intake.ts"
import { parseArgs } from "../../src/adapters/in/cli/args.ts"
import { InMemoryEventLog } from "../support/fakes.ts"
import type { Event } from "../../src/domain/events.ts"

const at = (time: string): string => `2025-10-23T${time}:00.000Z`

function seeded(): LogCandidates {
  const events: Event[] = [
    { v: 1, id: "aaaaaaa1", t: "start", at: at("09:00"), project: "acme", description: "new parser" },
    { v: 1, id: "bbbbbbb2", t: "stop", at: at("09:30"), entry: "aaaaaaa1" },
    { v: 1, id: "ccccccc3", t: "start", at: at("09:30"), project: "beta", description: "emails" },
    { v: 1, id: "ddddddd4", t: "stop", at: at("10:00"), entry: "ccccccc3" },
  ]
  return new LogCandidates(new InMemoryEventLog(events))
}

interface Fixture {
  intake: Intake
  input: PassThrough
  output: PassThrough
}

function makeIntake(interactive = true): Fixture {
  const input = new PassThrough()
  const output = new PassThrough()
  const intake = createIntake({
    logCandidates: seeded(),
    input,
    output,
    isTTY: interactive,
    isInputTTY: interactive,
  })
  return { intake, input, output }
}

/** Answer each prompt only once it has been written, in script order. */
function answerPrompts(
  input: PassThrough,
  output: PassThrough,
  answers: Array<{ prompt: string; line: string }>,
): void {
  let buffer = ""
  let next = 0
  output.on("data", (chunk: Buffer) => {
    buffer += chunk.toString()
    while (next < answers.length) {
      const answer = answers[next]!
      const index = buffer.indexOf(answer.prompt)
      if (index < 0) return
      buffer = buffer.slice(index + answer.prompt.length)
      input.write(answer.line)
      if (answer.line.endsWith("\t")) setTimeout(() => input.write("\n"), 10)
      next += 1
    }
  })
}

test("timer returns operands without prompting", async () => {
  const { intake } = makeIntake()
  const result = await intake.timer(parseArgs(["start", "acme", "new parser"]), "start")
  assert.deepEqual(result, { project: "acme", description: "new parser" })
})

test("timer requires a project when not interactive", async () => {
  const { intake } = makeIntake(false)
  await assert.rejects(
    () => intake.timer(parseArgs(["start"]), "start"),
    (error: unknown) => error instanceof UsageError && /requires a <project>/.test(error.message),
  )
})

test("timer never prompts under --json", async () => {
  const { intake } = makeIntake()
  await assert.rejects(() => intake.timer(parseArgs(["--json", "start"]), "start"), UsageError)
})

test("timer reads Project and Description", async () => {
  const { intake, input, output } = makeIntake()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "acme\n" },
    { prompt: "Description (optional): ", line: "new parser\n" },
  ])
  assert.deepEqual(await intake.timer(parseArgs(["start"]), "start"), {
    project: "acme",
    description: "new parser",
  })
})

test("timer Tab-completes a Description from history", async () => {
  const { intake, input, output } = makeIntake()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "acme\n" },
    { prompt: "Description (optional): ", line: "new p\t" },
  ])
  const result = await intake.timer(parseArgs(["start"]), "start")
  assert.deepEqual(result, { project: "acme", description: "new parser" })
})

test("timer accepts an empty Description and trims inputs", async () => {
  const { intake, input, output } = makeIntake()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "  acme  \n" },
    { prompt: "Description (optional): ", line: "\n" },
  ])
  assert.deepEqual(await intake.timer(parseArgs(["start"]), "start"), { project: "acme" })
})

test("timer returns null on Ctrl+C", async () => {
  const { intake, input, output } = makeIntake()
  answerPrompts(input, output, [{ prompt: "Project: ", line: "\x03" }])
  assert.equal(await intake.timer(parseArgs(["start"]), "start"), null)
})

test("timer re-prompts when the Project is blank", async () => {
  const { intake, input, output } = makeIntake()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "\n" },
    { prompt: "Project: ", line: "  \n" },
    { prompt: "Project: ", line: "beta\n" },
    { prompt: "Description (optional): ", line: "review\n" },
  ])
  assert.deepEqual(await intake.timer(parseArgs(["start"]), "start"), {
    project: "beta",
    description: "review",
  })
})

test("adjustment returns operands without prompting", async () => {
  const { intake } = makeIntake()
  assert.deepEqual(await intake.adjustment(parseArgs(["add", "acme", "30m"]), "add"), {
    project: "acme",
    duration: "30m",
  })
})

test("adjustment requires project and duration when not interactive", async () => {
  const { intake } = makeIntake(false)
  await assert.rejects(
    () => intake.adjustment(parseArgs(["add"]), "add"),
    (error: unknown) =>
      error instanceof UsageError && /requires <project> <duration>/.test(error.message),
  )
})

test("adjustment reads Project and Duration", async () => {
  const { intake, input, output } = makeIntake()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "acme\n" },
    { prompt: "Duration: ", line: "30m\n" },
  ])
  assert.deepEqual(await intake.adjustment(parseArgs(["add"]), "add"), {
    project: "acme",
    duration: "30m",
  })
})

test("adjustment re-prompts when the Duration is blank", async () => {
  const { intake, input, output } = makeIntake()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "beta\n" },
    { prompt: "Duration: ", line: "\n" },
    { prompt: "Duration: ", line: " 1h30m \n" },
  ])
  assert.deepEqual(await intake.adjustment(parseArgs(["add"]), "add"), {
    project: "beta",
    duration: "1h30m",
  })
})

test("completion candidates are stripped of terminal control sequences", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  const chunks: Buffer[] = []
  output.on("data", (chunk: Buffer) => chunks.push(chunk))
  const intake = createIntake({
    logCandidates: {
      execute: async () => ({ candidates: ["ac\u001b[31mme"] }),
    } as unknown as LogCandidates,
    input,
    output,
    isTTY: true,
    isInputTTY: true,
  })
  const pending = intake.timer(parseArgs(["start"]), "start")
  setTimeout(() => input.write("ac\t"), 20)
  setTimeout(() => input.write("\u0003"), 60)
  assert.equal(await pending, null)
  const text = Buffer.concat(chunks).toString("binary")
  assert.ok(!text.includes("\u001b[31m"), "candidate escape leaked to readline")
  assert.match(text, /ac\[31mme/)
})
