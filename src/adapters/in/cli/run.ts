import type { AddAdjustment, SubAdjustment } from "../../../application/adjustment.ts"
import type { RemoveEntry } from "../../../application/remove-entry.ts"
import type { StartTask } from "../../../application/start-task.ts"
import type { ShowStatus } from "../../../application/status.ts"
import type { StopTask } from "../../../application/stop-task.ts"
import type { SwitchTask } from "../../../application/switch-task.ts"
import { UsageError } from "../../../application/errors.ts"
import { TaflogError } from "../../../domain/errors.ts"
import type { ParsedArgs } from "./args.ts"
import {
  renderAdjusted,
  renderRemoved,
  renderStarted,
  renderStatus,
  renderStopped,
  renderSwitched,
  statusJson,
} from "./present.ts"

/** Everything the CLI needs, injected by the composition root (ADR-0005). */
export interface CliDeps {
  startTask: StartTask
  stopTask: StopTask
  switchTask: SwitchTask
  showStatus: ShowStatus
  addAdjustment: AddAdjustment
  subAdjustment: SubAdjustment
  removeEntry: RemoveEntry
  version: string
  stdout: (chunk: string) => void
  stderr: (chunk: string) => void
}

export const USAGE = `taflog — minimalist CLI time tracker

Usage:
  taflog start <project> [description]
  taflog stop [description]
  taflog switch <project> [description]
  taflog status
  taflog log [filters]
  taflog report [filters]
  taflog add <project> <duration> [--date D] [--note N]
  taflog sub <project> <duration> [--date D] [--note N]
  taflog rm [<id>]
  taflog config [<key>]
  taflog set <key> <value>
  taflog export

Global flags:
  --dir <path>              data directory
  --json                    machine-readable output
  --no-color                disable colour
  --icons <auto|nerd|ascii> glyph profile
  --strict                  fail on unreadable log lines
  --force                   close a forgotten running Timer
  -h, --help                show this help
  -V, --version             show version

Docs: README.md · SPEC.md · PLAN.md · GLOSSARY.md
`

/**
 * Turn parsed arguments into use-case calls and rendered output. Returns the
 * process exit code; never calls `process.exit` (SPEC §8.4).
 */
export async function runCli(parsed: ParsedArgs, deps: CliDeps): Promise<number> {
  if (parsed.options.version) {
    deps.stdout(`${deps.version}\n`)
    return 0
  }
  if (parsed.options.help || parsed.command === "help") {
    deps.stdout(USAGE)
    return 0
  }

  const command = parsed.command ?? "status"
  try {
    switch (command) {
      case "status": {
        const result = await deps.showStatus.execute()
        warnSkipped(result.skipped, deps)
        deps.stdout(parsed.options.json ? statusJson(result) : renderStatus(result))
        return 0
      }
      case "start": {
        const project = parsed.operands[0]
        if (project === undefined) throw new UsageError("start requires a <project>")
        const description = joinOperands(parsed.operands.slice(1))
        const result = await deps.startTask.execute({
          project,
          ...(description === undefined ? {} : { description }),
        })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderStarted(result))
        return 0
      }
      case "stop": {
        const description = joinOperands(parsed.operands)
        const result = await deps.stopTask.execute({
          ...(description === undefined ? {} : { description }),
          ...(parsed.options.force ? { force: true } : {}),
        })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderStopped(result))
        return 0
      }
      case "switch": {
        const project = parsed.operands[0]
        if (project === undefined) throw new UsageError("switch requires a <project>")
        const description = joinOperands(parsed.operands.slice(1))
        const result = await deps.switchTask.execute({
          project,
          ...(description === undefined ? {} : { description }),
          ...(parsed.options.force ? { force: true } : {}),
        })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderSwitched(result))
        return 0
      }
      case "add":
      case "sub": {
        const [project, duration, ...rest] = parsed.operands
        if (project === undefined || duration === undefined || rest.length > 0) {
          throw new UsageError(`${command} requires <project> <duration>`)
        }
        const task = command === "add" ? deps.addAdjustment : deps.subAdjustment
        const result = await task.execute({
          project,
          duration,
          ...(parsed.options.date === null ? {} : { date: parsed.options.date }),
          ...(parsed.options.note === null ? {} : { note: parsed.options.note }),
        })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderAdjusted(result))
        return 0
      }
      case "rm": {
        if (parsed.operands.length > 1) throw new UsageError("rm takes at most one <id>")
        const id = parsed.operands[0]
        const result = await deps.removeEntry.execute(id === undefined ? {} : { id })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderRemoved(result))
        return 0
      }
      default:
        throw new UsageError(`unknown command: ${command}`)
    }
  } catch (error) {
    if (error instanceof TaflogError) {
      deps.stderr(`taflog: ${error.message}\n`)
      return error.exitCode
    }
    throw error
  }
}

function joinOperands(parts: string[]): string | undefined {
  const text = parts.join(" ").trim()
  return text === "" ? undefined : text
}

function warnSkipped(skipped: number, deps: CliDeps): void {
  if (skipped > 0) {
    deps.stderr(`warning: skipped ${skipped} unreadable line${skipped === 1 ? "" : "s"}\n`)
  }
}
