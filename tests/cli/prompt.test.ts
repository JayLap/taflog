import { test } from "node:test"
import assert from "node:assert/strict"
import { PassThrough } from "node:stream"
import { CompleteStart } from "../../src/application/complete-start.ts"
import { promptForAdjustment, promptForTimer } from "../../src/adapters/in/cli/prompt.ts"
import { InMemoryEventLog } from "../support/fakes.ts"
import type { Event } from "../../src/domain/events.ts"

const at = (time: string): string => `2025-10-23T${time}:00.000Z`

function seeded(): CompleteStart {
  const events: Event[] = [
    { v: 1, id: "aaaaaaa1", t: "start", at: at("09:00"), project: "acme", description: "new parser" },
    { v: 1, id: "bbbbbbb2", t: "stop", at: at("09:30"), entry: "aaaaaaa1" },
    { v: 1, id: "ccccccc3", t: "start", at: at("09:30"), project: "beta", description: "emails" },
    { v: 1, id: "ddddddd4", t: "stop", at: at("10:00"), entry: "ccccccc3" },
  ]
  return new CompleteStart(new InMemoryEventLog(events))
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

test("promptForTimer reads Project and Description", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "acme\n" },
    { prompt: "Description (optional): ", line: "new parser\n" },
  ])
  const result = promptForTimer({ completeStart: seeded(), input, output })
  assert.deepEqual(await result, { project: "acme", description: "new parser" })
})

test("promptForTimer Tab-completes a Description from history", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "acme\n" },
    { prompt: "Description (optional): ", line: "new p\t" },
  ])
  const result = promptForTimer({ completeStart: seeded(), input, output })
  assert.deepEqual(await result, { project: "acme", description: "new parser" })
})

test("promptForTimer accepts an empty Description and trims inputs", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "  acme  \n" },
    { prompt: "Description (optional): ", line: "\n" },
  ])
  const result = promptForTimer({ completeStart: seeded(), input, output })
  assert.deepEqual(await result, { project: "acme" })
})

test("promptForTimer returns null on Ctrl+C", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  answerPrompts(input, output, [{ prompt: "Project: ", line: "\x03" }])
  const result = promptForTimer({ completeStart: seeded(), input, output })
  assert.equal(await result, null)
})

test("promptForTimer re-prompts when the Project is blank", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "\n" },
    { prompt: "Project: ", line: "  \n" },
    { prompt: "Project: ", line: "beta\n" },
    { prompt: "Description (optional): ", line: "review\n" },
  ])
  const result = promptForTimer({ completeStart: seeded(), input, output })
  assert.deepEqual(await result, { project: "beta", description: "review" })
})
test("promptForAdjustment reads Project and Duration", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "acme\n" },
    { prompt: "Duration: ", line: "30m\n" },
  ])
  const result = promptForAdjustment({ completeStart: seeded(), input, output })
  assert.deepEqual(await result, { project: "acme", duration: "30m" })
})

test("promptForAdjustment re-prompts when the Duration is blank", async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  answerPrompts(input, output, [
    { prompt: "Project: ", line: "beta\n" },
    { prompt: "Duration: ", line: "\n" },
    { prompt: "Duration: ", line: " 1h30m \n" },
  ])
  const result = promptForAdjustment({ completeStart: seeded(), input, output })
  assert.deepEqual(await result, { project: "beta", duration: "1h30m" })
})
