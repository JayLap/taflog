import { createInterface, type Interface } from "node:readline"
import type { Readable, Writable } from "node:stream"
import type { CompleteStart } from "../../../application/complete-start.ts"

export interface TimerPromptAnswer {
  project: string
  description?: string
}

export interface AdjustmentPromptAnswer {
  project: string
  duration: string
}

export interface PromptOptions {
  completeStart: CompleteStart
  input: Readable
  output: Writable
}

/**
 * Interactive input for opening a Timer (`start` or `switch`). Projects and
 * Descriptions use Tab completion from the Log; Ctrl+C returns null (SPEC §8.6).
 */
export async function promptForTimer(
  options: PromptOptions,
): Promise<TimerPromptAnswer | null> {
  const prompt = new LinePrompt(options.input, options.output)
  try {
    const project = await askProject(prompt, options.completeStart)
    if (project === null) return null

    prompt.setCandidates(
      (await options.completeStart.execute({ kind: "description", project })).candidates,
    )
    const answer = await prompt.ask("Description (optional): ")
    if (answer === null) return null
    const description = answer.trim()
    return { project, ...(description === "" ? {} : { description }) }
  } finally {
    prompt.close()
  }
}

/**
 * Interactive input for `add`/`sub`. Projects use Tab completion; Duration is
 * freeform and validated by the Adjustment use case. Ctrl+C returns null.
 */
export async function promptForAdjustment(
  options: PromptOptions,
): Promise<AdjustmentPromptAnswer | null> {
  const prompt = new LinePrompt(options.input, options.output)
  try {
    const project = await askProject(prompt, options.completeStart)
    if (project === null) return null

    prompt.setCandidates([])
    let duration = ""
    while (duration === "") {
      const answer = await prompt.ask("Duration: ")
      if (answer === null) return null
      duration = answer.trim()
    }
    return { project, duration }
  } finally {
    prompt.close()
  }
}

async function askProject(prompt: LinePrompt, completeStart: CompleteStart): Promise<string | null> {
  prompt.setCandidates((await completeStart.execute({ kind: "project" })).candidates)
  let project = ""
  while (project === "") {
    const answer = await prompt.ask("Project: ")
    if (answer === null) return null
    project = answer.trim()
  }
  return project
}

/** One readline session whose completer candidates can change between prompts. */
class LinePrompt {
  private readonly rl: Interface
  private candidates: string[] = []

  constructor(input: Readable, output: Writable) {
    this.rl = createInterface({
      input,
      output,
      terminal: true,
      completer: (line: string): [string[], string] => {
        const query = line.trim().toLowerCase()
        const hits = this.candidates.filter((candidate) =>
          candidate.toLowerCase().startsWith(query),
        )
        return [hits, line]
      },
    })
    this.rl.on("SIGINT", () => this.rl.close())
  }

  setCandidates(candidates: string[]): void {
    this.candidates = candidates
  }

  ask(prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      const done = (answer: string | null): void => {
        this.rl.off("line", onLine)
        this.rl.off("close", onClose)
        resolve(answer)
      }
      const onLine = (line: string): void => done(line)
      const onClose = (): void => done(null)
      this.rl.once("line", onLine)
      this.rl.once("close", onClose)
      this.rl.setPrompt(prompt)
      this.rl.prompt()
    })
  }

  close(): void {
    this.rl.close()
  }
}
