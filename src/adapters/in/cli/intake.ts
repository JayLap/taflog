import { createInterface, type Interface } from "node:readline"
import type { Readable, Writable } from "node:stream"
import type { LogCandidates } from "../../../application/log-candidates.ts"
import { UsageError } from "../../../application/errors.ts"
import type { ParsedArgs } from "./args.ts"

/** A Timer's opening input, gathered from operands or a prompt. */
export interface TimerDraft {
  project: string
  description?: string
}

/** An Adjustment's input, gathered from operands or a prompt. */
export interface AdjustmentDraft {
  project: string
  duration: string
}

/**
 * Resolves the operands a command needs, using the terminal only when they are
 * absent and prompting is allowed. Returns `null` when the user cancels
 * (Ctrl+C), so the caller exits 130 and writes no Event (SPEC §8.6).
 */
export interface Intake {
  timer(parsed: ParsedArgs, command: "start" | "switch"): Promise<TimerDraft | null>
  adjustment(parsed: ParsedArgs, command: "add" | "sub"): Promise<AdjustmentDraft | null>
}

export interface IntakeOptions {
  logCandidates: LogCandidates
  input: Readable
  output: Writable
  /** stdout is a terminal; required before prompting. */
  isTTY: boolean
  /** stdin is a terminal; required before prompting. */
  isInputTTY: boolean
}

/** Build the production Intake over the process streams. */
export function createIntake(options: IntakeOptions): Intake {
  return new TerminalIntake(options)
}

/**
 * The decision ("can we prompt?") and the readline mechanics live together so
 * `runCli` never repeats the TTY/JSON guard and `LinePrompt` stays private.
 */
class TerminalIntake implements Intake {
  private readonly logCandidates: LogCandidates
  private readonly input: Readable
  private readonly output: Writable
  private readonly interactive: boolean

  constructor(options: IntakeOptions) {
    this.logCandidates = options.logCandidates
    this.input = options.input
    this.output = options.output
    this.interactive = options.isTTY && options.isInputTTY
  }

  async timer(parsed: ParsedArgs, command: "start" | "switch"): Promise<TimerDraft | null> {
    const project = parsed.operands[0]
    if (project !== undefined) {
      const description = join(parsed.operands.slice(1))
      return { project, ...(description === undefined ? {} : { description }) }
    }
    if (!this.canPrompt(parsed)) throw new UsageError(`${command} requires a <project>`)

    const prompt = new LinePrompt(this.input, this.output)
    try {
      return await this.askTimer(prompt)
    } finally {
      prompt.close()
    }
  }

  async adjustment(parsed: ParsedArgs, command: "add" | "sub"): Promise<AdjustmentDraft | null> {
    const [project, duration, ...rest] = parsed.operands
    if (project !== undefined || duration !== undefined || rest.length > 0) {
      if (project === undefined || duration === undefined || rest.length > 0) {
        throw new UsageError(`${command} requires <project> <duration>`)
      }
      return { project, duration }
    }
    if (!this.canPrompt(parsed)) {
      throw new UsageError(`${command} requires <project> <duration>`)
    }

    const prompt = new LinePrompt(this.input, this.output)
    try {
      return await this.askAdjustment(prompt)
    } finally {
      prompt.close()
    }
  }

  /** `--json` and a non-TTY keep the scriptable, operand-only behaviour. */
  private canPrompt(parsed: ParsedArgs): boolean {
    return !parsed.options.json && this.interactive
  }

  private async askTimer(prompt: LinePrompt): Promise<TimerDraft | null> {
    const project = await askProject(prompt, this.logCandidates)
    if (project === null) return null

    prompt.setCandidates(
      (await this.logCandidates.execute({ kind: "description", project })).candidates,
    )
    const answer = await prompt.ask("Description (optional): ")
    if (answer === null) return null
    const description = answer.trim()
    return { project, ...(description === "" ? {} : { description }) }
  }

  private async askAdjustment(prompt: LinePrompt): Promise<AdjustmentDraft | null> {
    const project = await askProject(prompt, this.logCandidates)
    if (project === null) return null

    prompt.setCandidates([])
    let duration = ""
    while (duration === "") {
      const answer = await prompt.ask("Duration: ")
      if (answer === null) return null
      duration = answer.trim()
    }
    return { project, duration }
  }
}

/** Ask for a non-blank Project, with Projects as Tab candidates. */
async function askProject(prompt: LinePrompt, logCandidates: LogCandidates): Promise<string | null> {
  prompt.setCandidates((await logCandidates.execute({ kind: "project" })).candidates)
  let project = ""
  while (project === "") {
    const answer = await prompt.ask("Project: ")
    if (answer === null) return null
    project = answer.trim()
  }
  return project
}

function join(parts: string[]): string | undefined {
  const text = parts.join(" ").trim()
  return text === "" ? undefined : text
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
